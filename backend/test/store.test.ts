import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { flushWrites, saver, writeAtomic } from "../src/store";

describe("store", () => {
  test("atomic write leaves no tmp files and the saver ends on the newest state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "benchmon-"));
    await writeAtomic(join(dir, "a.json"), "1");
    expect(await Bun.file(join(dir, "a.json")).text()).toBe("1");
    let state = 0;
    const save = saver(join(dir, "s.json"), () => String(state));
    for (let i = 1; i <= 20; i++) {
      state = i;
      save();
    }
    await flushWrites();
    expect(await Bun.file(join(dir, "s.json")).text()).toBe("20");
    expect((await readdir(dir)).sort()).toEqual(["a.json", "s.json"]);
  });
});
