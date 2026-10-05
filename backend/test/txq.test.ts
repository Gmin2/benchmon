import { describe, expect, test } from "bun:test";
import type { Hex } from "viem";
import { serial, txQueue } from "../src/txq";

describe("serial", () => {
  test("runs one job at a time in order, a failure does not block the rest", async () => {
    const q = serial();
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    const job = (n: number, fail = false) => async () => {
      running++;
      peak = Math.max(peak, running);
      await Bun.sleep(5);
      order.push(n);
      running--;
      if (fail) throw new Error("boom");
      return n;
    };
    const all = await Promise.allSettled([q.run(job(1)), q.run(job(2, true)), q.run(job(3))]);
    expect(peak).toBe(1);
    expect(order).toEqual([1, 2, 3]);
    expect(all.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});

describe("txQueue", () => {
  const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;

  test("concurrent sends get consecutive nonces and never overlap", async () => {
    let asked = 0;
    let inFlight = 0;
    let peak = 0;
    const send = txQueue({
      nonce: async () => (asked++, 7),
      wait: async () => {
        await Bun.sleep(3);
        inFlight--;
        return "success";
      },
    }).send;
    const write = async (nonce: number) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      return hash(nonce);
    };
    const sent = await Promise.all([send(write), send(write), send(write)]);
    expect(sent.map((s) => BigInt(s.hash))).toEqual([7n, 8n, 9n]);
    expect(peak).toBe(1);
    expect(asked).toBe(1);
  });

  test("a failed send makes the next one ask the chain for the nonce again", async () => {
    let chainNonce = 3;
    const q = txQueue({ nonce: async () => chainNonce, wait: async () => "success" });
    expect(BigInt((await q.send(async (n) => hash(n))).hash)).toBe(3n);
    await expect(q.send(async () => Promise.reject(new Error("nonce too low")))).rejects.toThrow("nonce too low");
    chainNonce = 10;
    expect(BigInt((await q.send(async (n) => hash(n))).hash)).toBe(10n);
  });
});
