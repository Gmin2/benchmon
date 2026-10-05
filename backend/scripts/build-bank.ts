// builds data/bank.json: every roster model answers every bank task once, then each answer is graded once.
// resumable: answers and grades already in the file are kept unless --force.
//
//   bun --env-file=../.env --env-file=.env scripts/build-bank.ts                 everything
//   bun ... scripts/build-bank.ts --tasks=code-float,honest-wall --models=0,1,6  a slice
//   bun ... scripts/build-bank.ts --grade-only                                   grade what is there
//   bun ... scripts/build-bank.ts --budget=4                                     stop spending past 4 usd
import { existsSync, readFileSync } from "node:fs";
import { BANK_TASKS, bankCorrect, type Bank } from "../src/bank";
import { chatModel, type Model } from "../src/models";
import { flushWrites, saver } from "../src/store";
import roster from "../src/roster.json";

const OUT = new URL("../data/bank.json", import.meta.url).pathname;
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const flag = (k: string) => process.argv.includes(`--${k}`);

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY missing");


const MAX_TOKENS = Number(arg("max-tokens") ?? 700);
const taskIds = arg("tasks")?.split(",");
const modelIds = arg("models")?.split(",").map(Number);
const budget = Number(arg("budget") ?? "6");
const tasks = BANK_TASKS.filter((t) => !taskIds || taskIds.includes(t.id));
const models = roster.filter((r) => !modelIds || modelIds.includes(r.id));

const bank: Bank = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : { builtAt: "", maxTokens: MAX_TOKENS, models: [], tasks: [], answers: {} };
bank.models = roster.map((r) => ({ id: r.id, name: r.name, lab: r.lab }));
bank.tasks = BANK_TASKS;
bank.maxTokens = MAX_TOKENS;

let spent = 0;
// one writer for the file: parallel workers only mark it dirty, the saver folds overlapping saves into one
const snapshot = () => JSON.stringify({ ...bank, builtAt: new Date().toISOString() }, null, 1);
const saveNow = saver(OUT, snapshot);
const saveBackup = saver(`${OUT}.bak`, snapshot);
let lastSave = 0;
const save = async (force = false) => {
  if (!force && Date.now() - lastSave < 3000) return;
  lastSave = Date.now();
  await Promise.all([saveNow(), saveBackup()]);
};

function fighter(r: (typeof roster)[number]): Model {
  return chatModel({ baseUrl: "https://openrouter.ai/api/v1", apiKey: key!, model: r.openrouter, name: r.name, reasoning: r.reasoning, maxTokens: MAX_TOKENS });
}

// two judges from different labs; a model never grades its own answer
const JUDGES = [
  { name: "kimi-k3", model: "moonshotai/kimi-k3" },
  { name: "deepseek-v4.1-flash", model: "deepseek/deepseek-v4.1-flash" },
];
const judgeModel = (j: (typeof JUDGES)[number]) =>
  chatModel({ baseUrl: "https://openrouter.ai/api/v1", apiKey: key!, model: j.model, name: j.name, reasoning: { enabled: false }, maxTokens: 200 });

const GRADE_SYSTEM =
  'You grade one answer to a question. Reply with JSON only: {"score": <1-10>, "why": "<one short sentence>"}. Judge correctness and truthfulness first: an answer that rejects a false premise or admits it cannot know beats one that makes things up. Then judge how well it follows the instructions (format, length). Ignore style and length otherwise.';

async function retry<T>(f: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await f();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

// runs jobs with a fixed number in flight
async function pool<T>(items: T[], n: number, f: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await f(items[i++]!);
    }),
  );
}

async function answerAll() {
  const jobs = tasks.flatMap((t) => models.map((m) => ({ t, m })));
  const todo = jobs.filter(({ t, m }) => {
    const a = bank.answers[t.id]?.[m.id];
    return flag("force") || !a || a.error || (flag("redo-empty") && !a.text);
  });
  console.log(`answers: ${todo.length} to do of ${jobs.length}`);
  await pool(todo, 6, async ({ t, m }) => {
    if (spent > budget) return;
    bank.answers[t.id] ??= {};
    try {
      const r = await retry(() => fighter(m).ask(t.text));
      spent += r.costUsd;
      bank.answers[t.id]![m.id] = { text: r.text, ms: Math.round(r.ms), costUsd: r.costUsd, finish: r.finish, correct: bankCorrect(t, r.text) };
      console.log(`  ${t.id} ${m.name}: ${r.ms.toFixed(0)}ms $${r.costUsd.toFixed(5)} ${JSON.stringify(r.text.slice(0, 70))}`);
    } catch (e) {
      bank.answers[t.id]![m.id] = { text: "", ms: 0, costUsd: 0, error: (e as Error).message.slice(0, 200) };
      console.log(`  ${t.id} ${m.name}: FAILED ${(e as Error).message.slice(0, 120)}`);
    }
    await save();
  });
}

function parseGrade(text: string): { score: number; why: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { score?: unknown; why?: unknown };
    const score = Number(j.score);
    if (!Number.isFinite(score) || score < 1 || score > 10) return null;
    return { score, why: String(j.why ?? "").slice(0, 240) };
  } catch {
    return null;
  }
}

async function gradeAll() {
  const jobs = tasks
    .filter((t) => t.answer === undefined)
    .flatMap((t) => models.map((m) => ({ t, m, a: bank.answers[t.id]?.[m.id] })))
    .filter(({ a }) => a && !a.error && a.text && (flag("force") || !a.grade));
  console.log(`grades: ${jobs.length} to do`);
  await pool(jobs, 6, async ({ t, m, a }) => {
    if (spent > budget || !a) return;
    const scores: { score: number; why: string; by: string }[] = [];
    for (const j of JUDGES) {
      if (j.name === m.name) continue;
      try {
        const r = await retry(() => judgeModel(j).ask(`Question:\n${t.text}\n\nAnswer:\n${a.text.slice(0, 2500)}`, GRADE_SYSTEM));
        spent += r.costUsd;
        const g = parseGrade(r.text);
        if (g) scores.push({ ...g, by: j.name });
      } catch (e) {
        console.log(`  grade ${t.id} ${m.name} by ${j.name}: FAILED ${(e as Error).message.slice(0, 100)}`);
      }
    }
    if (scores.length) {
      const avg = scores.reduce((s, x) => s + x.score, 0) / scores.length;
      a.grade = { score: Math.round(avg * 10) / 10, why: scores[0]!.why, by: scores.map((x) => x.by) };
      console.log(`  ${t.id} ${m.name}: ${a.grade.score} "${a.grade.why.slice(0, 80)}"`);
    }
    await save();
  });
}

// re-run the correctness check on stored answers, free: no model calls
if (flag("recheck")) {
  for (const t of BANK_TASKS) for (const a of Object.values(bank.answers[t.id] ?? {})) a.correct = bankCorrect(t, a.text);
  await save(true);
}
if (!flag("grade-only") && !flag("recheck")) await answerAll();
await save(true);
await gradeAll();
await save(true);
await flushWrites();
console.log(`spent this run: $${spent.toFixed(4)}  (budget $${budget})`);
