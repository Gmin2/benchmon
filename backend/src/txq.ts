import type { Hex } from "viem";

// runs one job at a time in the order they came in; a failed job does not stop the ones behind it
export function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  let queued = 0;
  return {
    run<T>(job: () => Promise<T>): Promise<T> {
      queued++;
      const p = tail.then(job).finally(() => queued--);
      tail = p.then(
        () => {},
        () => {},
      );
      return p;
    },
    get size() {
      return queued;
    },
    idle: () => tail,
  };
}

export type Sent = { hash: Hex; status: "success" | "reverted" };

type Chain = {
  nonce: () => Promise<number>;
  wait: (hash: Hex) => Promise<"success" | "reverted">;
};

// every write from one account goes through here: one tx at a time, each waits for its receipt before the
// next goes out, and the nonce is kept locally. any failure throws the nonce away so the next send asks the chain.
export function txQueue(chain: Chain) {
  const q = serial();
  let next: number | undefined;
  const send = (write: (nonce: number) => Promise<Hex>) =>
    q.run(async (): Promise<Sent> => {
      next ??= await chain.nonce();
      let hash: Hex;
      try {
        hash = await write(next);
      } catch (e) {
        next = undefined;
        throw e;
      }
      next++;
      try {
        return { hash, status: await chain.wait(hash) };
      } catch (e) {
        next = undefined;
        throw e;
      }
    });
  return { send, idle: q.idle, get size() { return q.size; } };
}
