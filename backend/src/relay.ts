import { encodeAbiParameters, isAddress, keccak256, type Address, type Hex } from "viem";
import { duelAbi } from "./abi";
import { fitGas, pub, signer } from "./chain";
import { config, file } from "./config";
import { readJson, saver } from "./store";
import { errMsg, loop } from "./util";

// picks handed over by players after they commit. the backend reveals them once both sides have committed,
// so a player whose tab is closed or in the background still reveals on time.
export type Pick = { id: bigint; round: number; player: Address; card: number; salt: Hex };

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const picks = new Map<string, Pick>();
const fails = new Map<string, number>();
const MAX_PICKS = 5000;
const slotOf = (p: Pick) => `${p.id}:${p.round}:${p.player.toLowerCase()}:`;
// keyed by the commit too: anyone can post a pick for any player before the commit lands, so a bogus one
// must not replace the real one. the relay drops whichever does not match once the commit is onchain
const keyOf = (p: Pick) => slotOf(p) + commitHash(p);

function commitHash(p: Pick): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }],
      [p.id, p.round, p.player, p.card, p.salt],
    ),
  );
}

const persist = saver(file("picks.json"), () => JSON.stringify([...picks.values()], (_, v) => (typeof v === "bigint" ? v.toString() : v)));

export async function loadPicks() {
  const list = await readJson<(Omit<Pick, "id"> & { id: string })[]>(file("picks.json"));
  for (const p of list ?? []) picks.set(keyOf({ ...p, id: BigInt(p.id) }), { ...p, id: BigInt(p.id) });
}

export function parsePick(body: unknown): Pick | string {
  const b = body as Record<string, unknown>;
  if (typeof b?.id !== "string" || !/^\d+$/.test(b.id)) return "bad id";
  if (typeof b.round !== "number" || b.round < 0 || b.round > 2) return "bad round";
  if (typeof b.player !== "string" || !isAddress(b.player)) return "bad player";
  if (typeof b.card !== "number" || b.card < 0 || b.card > 255) return "bad card";
  if (typeof b.salt !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(b.salt)) return "bad salt";
  return { id: BigInt(b.id), round: b.round, player: b.player as Address, card: b.card, salt: b.salt as Hex };
}

// accepts a pick only if it matches the player's commit onchain, or the commit has not landed yet
export async function addPick(p: Pick): Promise<string | null> {
  const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [p.id] });
  const isA = m.a.toLowerCase() === p.player.toLowerCase();
  if (!isA && m.b.toLowerCase() !== p.player.toLowerCase()) return "not a player in this match";
  if (m.state !== 1 || m.round !== p.round) return "match is not on that round";
  const onchain = isA ? m.commitA : m.commitB;
  if (onchain !== ZERO && onchain !== commitHash(p)) return "does not match the commit onchain";
  const k = keyOf(p);
  if (!picks.has(k)) {
    if (picks.size >= MAX_PICKS) return "too many pending picks, try again soon";
    const slot = slotOf(p);
    if ([...picks.keys()].filter((x) => x.startsWith(slot)).length >= 4) return "too many picks for this round";
  }
  picks.set(k, p);
  await persist();
  return null;
}

async function drop(k: string) {
  picks.delete(k);
  fails.delete(k);
  await persist();
}

async function relayOne(k: string, p: Pick) {
  const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [p.id] });
  const isA = m.a.toLowerCase() === p.player.toLowerCase();
  const revealed = isA ? m.revealedA : m.revealedB;
  if (m.state !== 1 || m.round !== p.round || revealed) return drop(k);
  if (m.awaitingVerdict || m.commitA === ZERO || m.commitB === ZERO) return;
  if ((isA ? m.commitA : m.commitB) !== commitHash(p)) return drop(k);
  const relayer = signer("relayer");
  const call = { address: config.contracts.duel, abi: duelAbi, functionName: "revealFor", args: [p.id, p.player, p.card, p.salt] } as const;
  const gas = await fitGas(relayer.address, call);
  const r = await relayer.send((nonce) => relayer.wallet.writeContract({ ...call, gas, nonce }));
  console.log(`revealed for ${p.player.slice(0, 8)} match ${p.id} round ${p.round}: ${r.status} ${r.hash}`);
  await drop(k);
}

// reveals go out one by one through the relayer queue. if every pick failed the rpc is probably down and the loop
// backs off; a single pick that keeps failing while others go through is given up after a few tries
async function tick() {
  const failed: [string, string][] = [];
  const tried = picks.size;
  for (const [k, p] of [...picks]) {
    try {
      await relayOne(k, p);
      fails.delete(k);
    } catch (e) {
      failed.push([k, errMsg(e)]);
    }
  }
  if (!failed.length) return;
  const last = `${failed.at(-1)![0]}: ${failed.at(-1)![1]}`;
  if (failed.length === tried) throw new Error(`${failed.length} failed, last ${last}`);
  console.error(`relay: ${failed.length} of ${tried} failed, last ${last}`);
  for (const [k, msg] of failed) {
    const n = (fails.get(k) ?? 0) + 1;
    fails.set(k, n);
    if (n < 5) continue;
    console.error(`relay ${k} gave up after ${n} tries: ${msg}`);
    await drop(k);
  }
}

export const relayLoop = () => loop("relay", tick, 1200);
