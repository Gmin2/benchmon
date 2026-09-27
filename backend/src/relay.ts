import { mkdir } from "node:fs/promises";
import { encodeAbiParameters, isAddress, keccak256, type Address, type Hex } from "viem";
import { duelAbi } from "./abi";
import { pub, wallet } from "./chain";
import { config } from "./config";

// picks handed over by players after they commit. the backend reveals them once both sides have committed,
// so a player whose tab is closed or in the background still reveals on time.
export type Pick = { id: bigint; round: number; player: Address; card: number; salt: Hex };

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const picks = new Map<string, Pick>();
const file = `${config.duelsDir}../picks.json`;
const keyOf = (p: Pick) => `${p.id}:${p.round}:${p.player.toLowerCase()}`;

function commitHash(p: Pick): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }],
      [p.id, p.round, p.player, p.card, p.salt],
    ),
  );
}

async function persist() {
  await mkdir(config.duelsDir, { recursive: true });
  await Bun.write(file, JSON.stringify([...picks.values()], (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export async function loadPicks() {
  const f = Bun.file(file);
  if (!(await f.exists())) return;
  for (const p of (await f.json()) as (Omit<Pick, "id"> & { id: string })[]) picks.set(keyOf({ ...p, id: BigInt(p.id) }), { ...p, id: BigInt(p.id) });
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
  picks.set(keyOf(p), p);
  await persist();
  return null;
}

async function relayOne(k: string, p: Pick) {
  const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [p.id] });
  const isA = m.a.toLowerCase() === p.player.toLowerCase();
  const revealed = isA ? m.revealedA : m.revealedB;
  if (m.state !== 1 || m.round !== p.round || revealed) {
    picks.delete(k);
    await persist();
    return;
  }
  if (m.awaitingVerdict || m.commitA === ZERO || m.commitB === ZERO) return;
  if ((isA ? m.commitA : m.commitB) !== commitHash(p)) {
    picks.delete(k);
    await persist();
    return;
  }
  const hash = await wallet.writeContract({
    address: config.contracts.duel,
    abi: duelAbi,
    functionName: "revealFor",
    args: [p.id, p.player, p.card, p.salt],
    gas: 350_000n,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`revealed for ${p.player.slice(0, 8)} match ${p.id} round ${p.round}: ${r.status} ${hash}`);
  picks.delete(k);
  await persist();
}

export async function relayLoop() {
  const busy = new Set<string>();
  for (;;) {
    for (const [k, p] of picks) {
      if (busy.has(k)) continue;
      busy.add(k);
      relayOne(k, p)
        .catch((e) => console.error(`relay ${k}: ${(e as Error).message.split("\n")[0]}`))
        .finally(() => busy.delete(k));
    }
    await Bun.sleep(1200);
  }
}
