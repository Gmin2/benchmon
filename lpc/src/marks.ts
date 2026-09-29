import sharp from "sharp"
import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { logos, minis, pixels } from "../../logos"
import { BUST } from "./compose"

const root = new URL("..", import.meta.url).pathname
const outDir = join(root, "out")
const markedDir = join(outDir, "marked")
const INK = "#140c18"
const FRAME = 64

type Canvas = { w: number; h: number; data: Buffer }

const hex = (s: string) => {
  const n = parseInt(s.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

function put(c: Canvas, x: number, y: number, color: string) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const i = (y * c.w + x) * 4
  const [r, g, b] = hex(color)
  c.data[i] = r
  c.data[i + 1] = g
  c.data[i + 2] = b
  c.data[i + 3] = 255
}

export function mark(lab: string, size: "badge" | "mini") {
  const logo = logos[lab]
  if (!logo) throw new Error(`no logo for ${lab}`)
  const grid = size === "badge" ? logo.badge : minis[lab]!
  const w = Math.max(...grid.map(r => r.length)) + 2
  const h = grid.length + 2
  const c: Canvas = { w, h, data: Buffer.alloc(w * h * 4) }
  const px = pixels(grid, logo.colors)
  const filled = new Set(px.map(p => `${p.x},${p.y}`))
  for (const p of px)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      if (!filled.has(`${p.x + dx},${p.y + dy}`)) put(c, p.x + 1 + dx, p.y + 1 + dy, INK)
  for (const p of px) put(c, p.x + 1, p.y + 1, p.color)
  return c
}

function stamp(dst: Canvas, src: Canvas, dx: number, dy: number) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4
      if (!src.data[si + 3]) continue
      const tx = dx + x, ty = dy + y
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue
      src.data.copy(dst.data, (ty * dst.w + tx) * 4, si, si + 4)
    }
}

// top of the head and how far right it reaches in the first rows
function headBox(c: Canvas) {
  const alpha = (x: number, y: number) => c.data[(y * c.w + x) * 4 + 3]!
  let top = 0
  while (top < c.h && ![...Array(c.w).keys()].some(x => alpha(x, top))) top++
  let right = 0
  for (let y = top; y < top + 16 && y < c.h; y++)
    for (let x = c.w - 1; x > right; x--) if (alpha(x, y)) right = x
  return { top, right }
}

async function load(path: string): Promise<Canvas> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

async function save(c: Canvas, name: string, scale = 8) {
  const img = () => sharp(c.data, { raw: { width: c.w, height: c.h, channels: 4 } })
  await img().png().toFile(join(markedDir, `${name}@1x.png`))
  await img().resize(c.w * scale, c.h * scale, { kernel: "nearest" }).png().toFile(join(markedDir, `${name}@${scale}x.png`))
}

const { cards } = JSON.parse(readFileSync(join(root, "cards.json"), "utf8")) as { cards: { name: string; lab: string }[] }
mkdirSync(markedDir, { recursive: true })

for (const card of cards) {
  const full = await load(join(outDir, `${card.name}@1x.png`))
  const { top, right } = headBox(full)

  const big = mark(card.lab, "badge")
  stamp(full, big, Math.min(right + 1, FRAME - big.w), Math.max(0, top + 1))
  await save(full, card.name)

  const bust = await load(join(outDir, `${card.name}-bust@1x.png`))
  const small = mark(card.lab, "mini")
  const bx = Math.min(right + 1 - BUST.left, bust.w - small.w)
  stamp(bust, small, bx, Math.max(0, top - BUST.top + 1))
  await save(bust, `${card.name}-bust`)
}

console.log(`marked ${cards.length} cards -> ${markedDir}`)
