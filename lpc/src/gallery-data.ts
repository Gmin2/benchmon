// writes ../gallery-data.js so gallery.html can open straight from disk
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const read = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"))
const data = {
  lineage: read("out/lineage.json"),
  classes: read("out/classes/index.json"),
  families: read("lineage.json").families,
}
writeFileSync(join(root, "..", "gallery-data.js"), `window.DATA = ${JSON.stringify(data)}\n`)
