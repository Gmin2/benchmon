// plays one real match against the deployed contracts and the live backend: create, join, commit both picks,
// hand them to the backend relay, let it reveal, pick arenas, and wait for the live duel verdict if it gets there.
// usage: BACKEND=https://... bun --env-file=../.env scripts/e2e-live.ts
import { createPublicClient, createWalletClient, encodeAbiParameters, http, keccak256, parseEther, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { duelAbi } from "../src/abi";

const BACKEND = process.env.BACKEND!;
const DUEL = "0xC110B9Ee0845Ed76D722Ccec3111302D56d1cA61" as Address;
const MARKET = "0x52CE235DCF1Afa5d4AF427BE9Df039c7797Fa35B" as Address;
const rpc = process.env.ALCHEMY_RPC ?? `https://monad-testnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}`;
const chain = { id: 10143, name: "monad testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as const;
const pub = createPublicClient({ chain, transport: http(rpc) });
const players = [process.env.DEPLOYER_KEY, process.env.PLAYER_B_KEY].map((k) => {
  const account = privateKeyToAccount(k as Hex);
  return { account, w: createWalletClient({ account, chain, transport: http(rpc) }) };
});
const [A, B] = players as [typeof players[0], typeof players[0]];
const decks = [[0, 3, 4, 13, 14], [5, 6, 9, 10, 7]];
const stake = parseEther("0.01");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${s}`);

async function send(p: typeof A, functionName: string, args: readonly unknown[], value?: bigint) {
  const hash = await p.w.writeContract({ address: DUEL, abi: duelAbi, functionName: functionName as never, args: args as never, value } as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted ${hash}`);
  return r;
}
const get = (id: bigint) => pub.readContract({ address: DUEL, abi: duelAbi, functionName: "getMatch", args: [id] }) as Promise<any>;

for (const p of players) log(`${p.account.address} has ${Number(await pub.getBalance({ address: p.account.address })) / 1e18} MON`);
log(`backend health: ${JSON.stringify(await (await fetch(`${BACKEND}/health`)).json()).slice(0, 120)}`);

// MATCH=<id> resumes a match this script already started
let id: bigint;
if (process.env.MATCH) {
  id = BigInt(process.env.MATCH);
  log(`resuming match ${id}`);
} else {
  await send(A, "create", [decks[0]], stake);
  id = ((await pub.readContract({ address: DUEL, abi: duelAbi, functionName: "matchCount" })) as bigint) - 1n;
  log(`created match ${id}`);
  await send(B, "join", [id, decks[1]], stake);
  log(`b joined, match ${id} is live`);
}

// cards already played come back from the used bitmaps
const m0 = await get(id);
const used = [m0.usedA, m0.usedB].map((u: bigint) => new Set([...Array(16).keys()].filter((c) => (u & (1n << BigInt(c))) !== 0n)));
let marketSeen = false;
let lastNote = "";
while (Date.now() - t0 < 20 * 60_000) {
  const m = await get(id);
  if (!marketSeen) {
    const mk = (await pub.readContract({ address: MARKET, abi: [{ type: "function", name: "markets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256", name: "b" }] }] as const, functionName: "markets", args: [id] }).catch(() => 0n)) as bigint;
    if (mk > 0n) { marketSeen = true; log(`house opened the market (b = ${Number(mk) / 1e18} MON)`); }
  }
  if (Number(m.state) === 2) {
    log(`done: result ${m.result} (1 a, 2 b, 3 draw), wins a ${m.winsA}, wins b ${m.winsB}`);
    break;
  }
  const note = `round ${m.round} arena ${m.arena} picker ${m.picker} verdict ${m.awaitingVerdict}`;
  if (note !== lastNote) { log(note); lastNote = note; }
  if (m.awaitingVerdict) { await sleep(5000); continue; }
  if (m.picker !== "0x0000000000000000000000000000000000000000") {
    const p = m.picker.toLowerCase() === A.account.address.toLowerCase() ? A : B;
    const arena = [0, 1, 2, 3, 4, 5].find((a) => (Number(m.offer) & (1 << a)) !== 0)!;
    await send(p, "pickArena", [id, arena]);
    log(`${p === A ? "a" : "b"} picked arena ${arena} from offer ${Number(m.offer).toString(2)}`);
    continue;
  }
  for (const [i, p] of players.entries()) {
    const committed = i === 0 ? m.commitA : m.commitB;
    if (committed !== "0x0000000000000000000000000000000000000000000000000000000000000000") continue;
    const card = decks[i]!.find((c) => !used[i]!.has(c))!;
    used[i]!.add(card);
    const salt = keccak256(toHex(crypto.getRandomValues(new Uint8Array(32))));
    const c = keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }], [id, Number(m.round), p.account.address, card, salt]));
    await send(p, "commit", [id, c]);
    const r = await fetch(`${BACKEND}/pick`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id.toString(), round: Number(m.round), player: p.account.address, card, salt }) });
    log(`${i ? "b" : "a"} committed card ${card}, relay said ${r.status} ${(await r.text()).slice(0, 60)}`);
  }
  await sleep(2500);
}
const tr = await fetch(`${BACKEND}/duel/${id}`);
log(`transcript /duel/${id}: ${tr.status} ${tr.ok ? (await tr.text()).slice(0, 300) : ""}`);
