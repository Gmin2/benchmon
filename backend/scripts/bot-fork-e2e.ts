// plays one full match against the house bot on a local anvil fork: a scripted human creates, the backend
// bot joins after BOT_JOIN_AFTER and both play to the end. never point this at a real rpc.
//   RPC_URL=http://127.0.0.1:8599 HUMAN_KEY=0x... bun scripts/bot-fork-e2e.ts
import { createPublicClient, createWalletClient, defineChain, encodeAbiParameters, formatEther, http, keccak256, parseEther, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { duelAbi } from "../src/abi";

const rpc = process.env.RPC_URL!;
const local = /127\.0\.0\.1|localhost/.test(rpc);
// a real chain only with ALLOW_TESTNET=1: then nothing is warped, the real judge and the real bot play it out
if (!local && !process.env.ALLOW_TESTNET) throw new Error("this script only runs against a local fork unless ALLOW_TESTNET=1");
const DUEL = "0xC110B9Ee0845Ed76D722Ccec3111302D56d1cA61" as const;
const chain = defineChain({ id: 10143, name: "fork", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const pub = createPublicClient({ chain, transport: http(rpc) });
const human = privateKeyToAccount(process.env.HUMAN_KEY as Hex);
const wallet = createWalletClient({ account: human, chain, transport: http(rpc) });
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const NOBODY = "0x0000000000000000000000000000000000000000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

async function tx(functionName: string, args: readonly unknown[], value?: bigint) {
  const hash = await wallet.writeContract({ address: DUEL, abi: duelAbi, functionName: functionName as never, args: args as never, gas: 500_000n, ...(value ? { value } : {}) });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
}

const deck = (process.env.HUMAN_DECK ?? "3,4,9,13,14").split(",").map(Number);
// STALL_ROUND: the human commits that round and then walks away, so the bot has to claim the timeout
const stallRound = process.env.STALL_ROUND ? Number(process.env.STALL_ROUND) : -1;
const id = await pub.readContract({ address: DUEL, abi: duelAbi, functionName: "matchCount" });
const stake = process.env.STAKE ?? "0.01";
await tx("create", [deck], parseEther(stake));
log(`human created match ${id} with ${stake} MON, waiting for the bot`);
// EXPECT_NO_BOT: the stake is over the bot cap, so the seat must stay open; then the human cancels
if (process.env.EXPECT_NO_BOT) {
  await sleep(25_000);
  const m = await pub.readContract({ address: DUEL, abi: duelAbi, functionName: "getMatch", args: [id] });
  log(m.state === 0 ? "PASS the bot left the over cap seat open" : `FAIL the bot joined an over cap match (state ${m.state})`);
  await tx("cancel", [id]);
  const owed = await pub.readContract({ address: DUEL, abi: duelAbi, functionName: "owed", args: [human.address] });
  log(`cancelled, the human is owed ${formatEther(owed)} MON back`);
  process.exit(0);
}

const t0 = Date.now();
const picks = new Map<number, { card: number; salt: Hex }>();
const used = new Set<number>();
let warped = false;
for (;;) {
  const m = await pub.readContract({ address: DUEL, abi: duelAbi, functionName: "getMatch", args: [id] });
  if (m.state === 0) {
    if (Date.now() - t0 > 90_000) throw new Error("the bot never joined");
    if (!local && (Date.now() - t0) % 10_000 < 1000) log("still open, waiting for the house bot");
    await sleep(1000);
    continue;
  }
  if (m.state === 2) {
    const winner = m.result === 1 ? "human" : m.result === 2 ? "bot" : "draw";
    log(`match over after ${((Date.now() - t0) / 1000).toFixed(0)}s: ${winner} (${m.winsA}-${m.winsB}), bot was ${m.b}`);
    break;
  }
  if (m.awaitingVerdict) {
    if (!warped && local) {
      // the judge is off in this test: jump past the verdict deadline so the bot settles the live round by stats
      log("live round, no judge here: warping time past the verdict deadline");
      await pub.request({ method: "evm_increaseTime" as never, params: [700] as never });
      await pub.request({ method: "evm_mine" as never, params: [] as never });
      warped = true;
    }
    await sleep(1500);
    continue;
  }
  if (m.round !== stallRound) warped = false;
  if (m.picker !== NOBODY) {
    if (m.picker.toLowerCase() === human.address.toLowerCase()) {
      const arena = [0, 1, 2, 3, 4, 5].find((a) => (m.offer & (1 << a)) !== 0)!;
      await tx("pickArena", [id, arena]);
      log(`human picked arena ${arena}`);
    }
    await sleep(1000);
    continue;
  }
  if (m.commitA === ZERO) {
    const card = deck.find((c) => !used.has(c))!;
    const salt = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;
    const c = keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }], [id, m.round, human.address, card, salt]));
    await tx("commit", [id, c]);
    picks.set(m.round, { card, salt });
    used.add(card);
    log(`human committed round ${m.round + 1} (arena ${m.arena})`);
  } else if (m.round === stallRound) {
    if (!warped && local) {
      log(`human walks away in round ${m.round + 1}: warping past the move deadline`);
      await pub.request({ method: "evm_increaseTime" as never, params: [200] as never });
      await pub.request({ method: "evm_mine" as never, params: [] as never });
      warped = true;
    }
  } else if (m.commitB !== ZERO && !m.revealedA) {
    const p = picks.get(m.round)!;
    await tx("reveal", [id, p.card, p.salt]);
    log(`human revealed card ${p.card} in round ${m.round + 1}`);
  }
  await sleep(1000);
}
const owed = await pub.readContract({ address: DUEL, abi: duelAbi, functionName: "owed", args: [human.address] });
log(`human is owed ${formatEther(owed)} MON`);
