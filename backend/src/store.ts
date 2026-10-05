import { mkdir, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

// DUELS_DIR is an azure files (smb) share in prod: no locks, so every file is written whole to a tmp name and
// renamed over the old one. readers never see half a file. only one backend instance may write here.
async function put(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await Bun.write(tmp, text);
  try {
    await rename(tmp, path);
  } catch {
    // some smb mounts refuse to rename over an existing file
    await unlink(path).catch(() => {});
    await rename(tmp, path);
  }
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  const f = Bun.file(path);
  if (!(await f.exists())) return undefined;
  return (await f.json()) as T;
}

const writing = new Set<Promise<void>>();

// tracked so shutdown can wait for it
export function writeAtomic(path: string, text: string) {
  const p = put(path, text);
  writing.add(p);
  p.then(
    () => writing.delete(p),
    () => writing.delete(p),
  );
  return p;
}

// saves a snapshot of some in memory state. calls that land while a write runs fold into one more write,
// so the newest state is always the last one on disk
export function saver(path: string, snapshot: () => string) {
  let running: Promise<void> | null = null;
  let again = false;
  const run = async () => {
    do {
      again = false;
      await put(path, snapshot());
    } while (again);
  };
  return () => {
    if (running) {
      again = true;
      return running;
    }
    const p = run().finally(() => {
      running = null;
      writing.delete(p);
    });
    running = p;
    writing.add(p);
    return p;
  };
}

export const flushWrites = () => Promise.allSettled([...writing]);
