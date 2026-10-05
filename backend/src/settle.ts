import { keccak256, toHex } from "viem";
import { duelAbi } from "./abi";
import { fitGas, pub, signer } from "./chain";
import { config } from "./config";

export type Verdict = { outcome: 0 | 1 | 2; transcript: string };

// posts the verdict with a hash of everything the judge saw, after checking the match still waits for it
export async function settle(id: bigint, v: Verdict) {
  const m = await pub.readContract({ address: config.contracts.duel, abi: duelAbi, functionName: "getMatch", args: [id] });
  if (!m.awaitingVerdict) return { skipped: true as const };
  const duelHash = keccak256(toHex(v.transcript));
  const judge = signer("judge");
  const call = { address: config.contracts.duel, abi: duelAbi, functionName: "settleLive", args: [id, v.outcome, duelHash] } as const;
  const gas = await fitGas(judge.address, call);
  const r = await judge.send((nonce) => judge.wallet.writeContract({ ...call, gas, nonce }));
  return { skipped: false as const, tx: r.hash, status: r.status, duelHash };
}
