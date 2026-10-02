import sharp, { type OverlayOptions } from "sharp"
import { readFileSync } from "node:fs"
import { writeSprite, badge, toSharp, type Spec } from "./compose.ts"
import { mkdirSync } from "node:fs"

const dir = new URL("./out/", import.meta.url).pathname
const cards: Spec[] = JSON.parse(readFileSync(new URL("./cards.json", import.meta.url), "utf8"))

const scale = 6
const cell = 40 * scale
const label = 28
const cols = 5
const rows = Math.ceil(cards.length / cols)

const tiles: OverlayOptions[] = []
for (const [i, card] of cards.entries()) {
  await writeSprite(card, dir)
  const x = (i % cols) * cell
  const y = Math.floor(i / cols) * (cell + label)
  tiles.push({ input: await sharp(`${dir}${card.name}@8x.png`).resize(cell, cell, { kernel: "nearest" }).toBuffer(), left: x, top: y })
  const mark = card.lab ? badge(card.lab) : null
  if (mark) {
    const s = 4
    tiles.push({ input: await toSharp(mark).resize(mark.w * s, mark.h * s, { kernel: "nearest" }).png().toBuffer(), left: x + cell - mark.w * s - 12, top: y + 12 })
  }
  const text = `<svg width="${cell}" height="${label}"><text x="50%" y="18" font-family="Menlo, monospace" font-size="14" fill="#2a2a2a" text-anchor="middle">${card.name}</text></svg>`
  tiles.push({ input: Buffer.from(text), left: x, top: y + cell })
}

await sharp({ create: { width: cols * cell, height: rows * (cell + label), channels: 4, background: "#b8c8b0" } })
  .composite(tiles)
  .png()
  .toFile(`${dir}sheet.png`)

mkdirSync(`${dir}logos`, { recursive: true })
for (const lab of new Set(cards.map(c => c.lab).filter((l): l is string => !!l))) {
  const mark = badge(lab)
  if (!mark) continue
  await toSharp(mark).png().toFile(`${dir}logos/${lab}@1x.png`)
  await toSharp(mark).resize(mark.w * 8, mark.h * 8, { kernel: "nearest" }).png().toFile(`${dir}logos/${lab}@8x.png`)
}

console.log(`${cards.length} sprites -> ${dir}`)
