// first slice: everything except measured speed, to check every source resolves for every card
import { collectRaw, computeStats } from "../src/stats";
import roster from "../src/roster.json";
const fakeSpeed = Object.fromEntries(roster.map((r) => [r.id, 50]));
const { raw, missing, estimated, published } = await collectRaw(fakeSpeed);
console.log("published", published, "missing", missing, "estimated", estimated);
const stats = computeStats(raw);
for (const [i, r] of roster.entries()) {
  const x = raw[i]!;
  console.log(`${String(r.id).padStart(2)} ${r.name.padEnd(20)} code ${x.code.toFixed(0)} math ${x.math.toFixed(0)} reason ${x.reasoning.toFixed(0)} cost $${x.cost.toFixed(2)}/M honesty ${x.honesty.toFixed(0)} -> ${stats[i]!.join(",")}`);
}
