// quick contact sheet of any pngs: bun src/peek.ts out.png a.png b.png ...
import sharp, { type OverlayOptions } from "sharp"

const [target, ...files] = process.argv.slice(2)
if (!target || !files.length) throw new Error("usage: peek out.png files...")
const cell = Number(process.env.CELL ?? 200)
const cols = Number(process.env.COLS ?? 5)
const layers: OverlayOptions[] = []
for (const [i, f] of files.entries())
  layers.push({
    input: await sharp(f).resize(cell, cell, { kernel: "nearest", fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
    left: (i % cols) * cell,
    top: Math.floor(i / cols) * cell,
  })
await sharp({ create: { width: cols * cell, height: Math.ceil(files.length / cols) * cell, channels: 4, background: "#b8c8b0" } })
  .composite(layers)
  .png()
  .toFile(target)
