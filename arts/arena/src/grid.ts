// atlas viewer: draws a region of a sheet with a 32px grid and tile coords
// bun src/grid.ts <sheet> <x> <y> <w> <h> <out>   (all in tiles)
import sharp from "sharp"

const [sheet, tx, ty, tw, th, out] = process.argv.slice(2)
const T = 32, S = 3
const x = Number(tx) * T, y = Number(ty) * T, w = Number(tw) * T, h = Number(th) * T
const img = await sharp(sheet).extract({ left: x, top: y, width: w, height: h }).resize(w * S, h * S, { kernel: "nearest" }).png().toBuffer()
let lines = ""
for (let i = 0; i <= Number(tw); i++) lines += `<line x1="${i * T * S}" y1="0" x2="${i * T * S}" y2="${h * S}" stroke="#ff00aa" stroke-opacity=".5"/>`
for (let j = 0; j <= Number(th); j++) lines += `<line x1="0" y1="${j * T * S}" x2="${w * S}" y2="${j * T * S}" stroke="#ff00aa" stroke-opacity=".5"/>`
let labels = ""
for (let i = 0; i < Number(tw); i++)
  for (let j = 0; j < Number(th); j++)
    labels += `<text x="${i * T * S + 3}" y="${j * T * S + 12}" font-size="11" font-family="Menlo" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">${Number(tx) + i},${Number(ty) + j}</text>`
await sharp({ create: { width: w * S, height: h * S, channels: 4, background: "#556" } })
  .composite([{ input: img }, { input: Buffer.from(`<svg width="${w * S}" height="${h * S}">${lines}${labels}</svg>`) }])
  .png()
  .toFile(out)
