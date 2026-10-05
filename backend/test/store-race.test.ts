import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAtomic } from "../src/store";

test("many writes to one file at the same moment leave a whole file and no tmp files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bm-store-"));
  const path = join(dir, "x.json");
  await Promise.all(Array.from({ length: 50 }, (_, i) => writeAtomic(path, JSON.stringify({ i }))));
  const v = JSON.parse(readFileSync(path, "utf8")) as { i: number };
  expect(v.i).toBeGreaterThanOrEqual(0);
  expect(readdirSync(dir)).toEqual(["x.json"]);
});
