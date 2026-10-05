// the house bot takes an empty seat: if nobody joins an open match within BOT_JOIN_AFTER seconds it joins
// with a legal deck and plays it out like a person. its picks go through the relay, so they are saved
// before the commit lands and revealed even across a restart.
import { encodeAbiParameters, formatEther, keccak256, toHex, type Address, type Hex } from "viem";
import { cardStatsAbi, duelAbi } from "./abi";
import { pub, signer } from "./chain";
import { config, parseAmount } from "./config";
import { addPick } from "./relay";
import { botArena, botCard, botDeck, idsOf, type CardStat } from "./botplay";
import type { Stats } from "./rules";
import { boundedSet, errMsg, loop } from "./util";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const NOBODY = "0x0000000000000000000000000000000000000000";
const firstSeen = new Map<string, number>();
const done = boundedSet(5000);
const fails = new Map<string, number>();

type M = Awaited<ReturnType<typeof getMatch>>;
const getMatch = (id: bigint) => pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [id] });

async function statsAt(ids: number[], v: bigint): Promise<CardStat[]> {
  const res = await pub.multicall({
    contracts: ids.map((id) => ({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "statsAt", args: [BigInt(id), v] }) as const),
    allowFailure: false,
  });
  return ids.map((id, i) => ({ id, stats: res[i] as unknown as Stats }));
}

async function allCards(): Promise<{ cards: CardStat[]; v: bigint }> {
  const [n, v] = await Promise.all([
    pub.readContract({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "cardCount" }),
    pub.readContract({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "version" }),
  ]);
  return { cards: await statsAt([...Array(Number(n)).keys()], v), v };
}

const send = (functionName: string, args: readonly unknown[], extra: { value?: bigint; gas?: bigint } = {}) => {
  const bot = signer("bot");
  return bot.send((nonce) =>
    bot.wallet.writeContract({ address: config.contracts.duel, abi: duelAbi, functionName: functionName as never, args: args as never, nonce, gas: extra.gas ?? 300_000n, ...(extra.value ? { value: extra.value } : {}) }),
  );
};

async function join(id: bigint, m: M) {
  const cap = Number(await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "deckCap" }));
  const { cards } = await allCards();
  const deck = botDeck(cards, cap);
  const r = await send("join", [id, deck], { value: m.stake, gas: 400_000n });
  console.log(`bot joined match ${id} for ${formatEther(m.stake)} MON with ${deck.join(",")}: ${r.status} ${r.hash}`);
}

// `now` is the chain's clock, the one the contract checks deadlines against
async function play(id: bigint, m: M, me: Address, now: bigint) {
  const isA = m.a.toLowerCase() === me.toLowerCase();
  const left = async () => statsAt(idsOf((isA ? m.deckA : m.deckB) & ~(isA ? m.usedA : m.usedB)), m.statsVersion);

  if (m.awaitingVerdict) {
    // the judge never answered in time: anyone can settle the live round by stats
    if (now > m.deadline) {
      const r = await send("settleLiveByStats", [id]);
      console.log(`bot settled the live round of match ${id} by stats: ${r.status}`);
    }
    return;
  }
  if (m.picker !== NOBODY) {
    if (m.picker.toLowerCase() === me.toLowerCase()) {
      const arena = botArena(await left(), m.offer);
      const r = await send("pickArena", [id, arena]);
      console.log(`bot picked arena ${arena} in match ${id}: ${r.status}`);
    } else if (now > m.deadline) {
      await send("skipPick", [id]);
    }
    return;
  }
  const mine = isA ? m.commitA : m.commitB;
  const theirs = isA ? m.commitB : m.commitA;
  if (mine === ZERO) {
    const card = botCard(await left(), m.arena);
    const salt = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;
    // handed to the relay first, so the pick is saved and revealed even if the commit lands while we restart
    const err = await addPick({ id, round: m.round, player: me, card, salt });
    if (err) throw new Error(`relay refused the bot pick: ${err}`);
    const c = keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "uint16" }, { type: "bytes32" }], [id, m.round, me, card, salt]));
    const r = await send("commit", [id, c]);
    console.log(`bot committed round ${m.round + 1} of match ${id}: ${r.status}`);
    return;
  }
  // the other side has not moved and the clock ran out: the bot moved, so it takes the match
  const stalled = theirs === ZERO || !(isA ? m.revealedB : m.revealedA);
  if (stalled && now > m.deadline) {
    const r = await send("claimTimeout", [id]);
    console.log(`bot claimed a timeout in match ${id}: ${r.status}`);
  }
}

async function tick() {
  const bot = signer("bot");
  const me = bot.address;
  const maxStake = parseAmount(config.botMaxStake);
  const [count, block] = await Promise.all([pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "matchCount" }), pub.getBlock()]);
  const now = block.timestamp;
  let active = 0;
  const failed: string[] = [];
  for (let id = count > 40n ? count - 40n : 0n; id < count; id++) {
    const key = id.toString();
    if (done.has(key)) continue;
    try {
      const m = await getMatch(id);
      if (m.state === 2) {
        done.add(key);
        continue;
      }
      const mine = m.a.toLowerCase() === me.toLowerCase() || m.b.toLowerCase() === me.toLowerCase();
      if (m.state === 1) {
        if (mine) {
          active++;
          await play(id, m, me, now);
        } else done.add(key);
        continue;
      }
      // open: wait for a human first, then take the seat if the stake is small enough
      if (m.a.toLowerCase() === me.toLowerCase()) continue;
      const seen = firstSeen.get(key) ?? Date.now();
      firstSeen.set(key, seen);
      if (Date.now() - seen < config.botJoinAfter * 1000 || m.stake > maxStake || active >= config.botMaxActive) continue;
      const balance = await pub.getBalance({ address: me });
      if (balance < m.stake + parseAmount("0.02")) {
        console.log(`bot skips match ${id}: balance ${formatEther(balance)} MON is too low for the stake`);
        continue;
      }
      await join(id, m);
      active++;
      fails.delete(key);
    } catch (e) {
      const n = (fails.get(key) ?? 0) + 1;
      fails.set(key, n);
      failed.push(`${key}: ${errMsg(e)}`);
      if (n >= 6) done.add(key);
    }
  }
  // winnings and refunds sit in the contract until withdrawn
  const owed = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "owed", args: [me] });
  if (owed > parseAmount("0.005")) {
    const r = await send("withdraw", []);
    console.log(`bot withdrew ${formatEther(owed)} MON: ${r.status}`);
  }
  if (failed.length) console.log(`bot: ${failed.length} match(es) failed this pass, first: ${failed[0]}`);
}

export const botLoop = () => loop("bot", tick, 3000);
