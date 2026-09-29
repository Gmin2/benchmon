import sharp from "sharp"
import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { logos, minis, pixels } from "../../logos"

const root = new URL("..", import.meta.url).pathname
const outDir = join(root, "out")
const markedDir = join(outDir, "marked")
const INK = "#140c18"
const FRAME = 64

export type Canvas = { w: number; h: number; data: Buffer }

const hex = (s: string) => {
  const n = parseInt(s.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

export function put(c: Canvas, x: number, y: number, color: string) {
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
  const [r, g, b] = hex(logo.colors["1"]!)
  const edge = r + g + b < 180 ? "#f4f1ea" : INK
  const filled = new Set(px.map(p => `${p.x},${p.y}`))
  for (const p of px)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      if (!filled.has(`${p.x + dx},${p.y + dy}`)) put(c, p.x + 1 + dx, p.y + 1 + dy, edge)
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

// wider than the plain bust so the mark gets its own space
export const BUST = { left: 10, top: 2, width: 44, height: 44 }

// top of the head and how far it reaches left and right in the first rows
function headBox(c: Canvas) {
  const alpha = (x: number, y: number) => c.data[(y * c.w + x) * 4 + 3]!
  let top = 0
  while (top < c.h && ![...Array(c.w).keys()].some(x => alpha(x, top))) top++
  let left = c.w, right = 0
  for (let y = top; y < top + 16 && y < c.h; y++)
    for (let x = 0; x < c.w; x++)
      if (alpha(x, y)) {
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
  return { top, left, right }
}

// right of the head if it fits inside the window, else left of it
function spot(box: ReturnType<typeof headBox>, w: number, minX: number, maxX: number) {
  if (box.right + 1 + w <= maxX) return box.right + 1
  if (box.left - w >= minX) return box.left - w
  return maxX - w
}

function crop(c: Canvas, r: typeof BUST): Canvas {
  const out: Canvas = { w: r.width, h: r.height, data: Buffer.alloc(r.width * r.height * 4) }
  for (let y = 0; y < r.height; y++) {
    const si = ((r.top + y) * c.w + r.left) * 4
    c.data.copy(out.data, y * r.width * 4, si, si + r.width * 4)
  }
  return out
}

export async function load(path: string): Promise<Canvas> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

export async function save(c: Canvas, dir: string, name: string, scale = 8) {
  mkdirSync(dir, { recursive: true })
  const img = () => sharp(c.data, { raw: { width: c.w, height: c.h, channels: 4 } })
  await img().png().toFile(join(dir, `${name}@1x.png`))
  await img().resize(c.w * scale, c.h * scale, { kernel: "nearest" }).png().toFile(join(dir, `${name}@${scale}x.png`))
}

// full frame with the big mark by the head, plus the wider bust with the small one
export function withMarks(plain: Canvas, lab: string) {
  const box = headBox(plain)
  const full = { ...plain, data: Buffer.from(plain.data) }
  const big = mark(lab, "badge")
  stamp(full, big, spot(box, big.w, 0, FRAME), Math.max(0, box.top + 1))

  const wide = { ...plain, data: Buffer.from(plain.data) }
  const small = mark(lab, "mini")
  stamp(wide, small, spot(box, small.w, BUST.left, BUST.left + BUST.width), Math.max(BUST.top, box.top + 1))
  return { full, bust: crop(wide, BUST) }
}

if (import.meta.main) {
  const { cards } = JSON.parse(readFileSync(join(root, "cards.json"), "utf8")) as { cards: { name: string; lab: string }[] }
  for (const card of cards) {
    const { full, bust } = withMarks(await load(join(outDir, `${card.name}@1x.png`)), card.lab)
    await save(full, markedDir, card.name)
    await save(bust, markedDir, `${card.name}-bust`)
  }
  console.log(`marked ${cards.length} cards -> ${markedDir}`)
}
