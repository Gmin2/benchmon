// first line of an error, rpc errors carry pages of detail
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0]!;

// a set that forgets its oldest entries past max
export function boundedSet(max: number) {
  const s = new Set<string>();
  return {
    has: (k: string) => s.has(k),
    add(k: string) {
      s.delete(k);
      s.add(k);
      while (s.size > max) s.delete(s.values().next().value!);
    },
    delete: (k: string) => s.delete(k),
    get size() {
      return s.size;
    },
  };
}

export const life = { stopping: false };

// runs tick forever with a pause in between. an error is logged as one line and the pause doubles, up to 30s
export async function loop(name: string, tick: () => Promise<void>, everyMs: number, maxMs = 30_000) {
  let wait = everyMs;
  while (!life.stopping) {
    try {
      await tick();
      wait = everyMs;
    } catch (e) {
      wait = Math.min(wait * 2, maxMs);
      console.error(`${name}: ${errMsg(e)} (retry in ${Math.round(wait / 1000)}s)`);
    }
    await Bun.sleep(wait);
  }
}
