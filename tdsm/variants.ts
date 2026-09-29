import sharp, { type OverlayOptions } from "sharp"
import { readFileSync, mkdirSync } from "node:fs"
import { compose, badge, blank, draw, put, hex, toSharp, type Img, type Spec } from "./compose.ts"
import { logos, minis, pixels } from "../logos.ts"

const dir = new URL("./out/variants/", import.meta.url).pathname
mkdirSync(dir, { recursive: true })
const cards: Spec[] = JSON.parse(readFileSync(new URL("./cards.json", import.meta.url), "utf8"))

const W = 48, H = 48, OX = 4, OY = 4
const INK = "#1c1c24"

function mark(lab: string, outline: boolean, only?: string): Img {
  const logo = logos[lab]!
  const grid = minis[lab]!
  const w = Math.max(...grid.map(r => r.length)) + 2
  const img = blank(w, grid.length + 2)
  const px = pixels(grid, logo.colors, only)
  if (outline) {
    const filled = new Set(px.map(p => `${p.x},${p.y}`))
    for (const p of px)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        if (!filled.has(`${p.x + dx},${p.y + dy}`)) put(img, p.x + 1 + dx, p.y + 1 + dy, INK)
  }
  for (const p of px) put(img, p.x + 1, p.y + 1, p.color)
  return img
}

function fade(img: Img, alpha: number): Img {
  const out = { ...img, data: Buffer.from(img.data) }
  for (let i = 3; i < out.data.length; i += 4) if (out.data[i]) out.data[i] = alpha
  return out
}

function double(img: Img): Img {
  const out = blank(img.w * 2, img.h * 2)
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const si = (Math.floor(y / 2) * img.w + Math.floor(x / 2)) * 4
      img.data.copy(out.data, (y * out.w + x) * 4, si, si + 4)
    }
  return out
}

function darken(color: string, k: number) {
  const [r, g, b] = hex(color)
  return "#" + [r, g, b].map(c => Math.round(c * k).toString(16).padStart(2, "0")).join("")
}

function ellipse(img: Img, cx: number, cy: number, rx: number, ry: number, fill: string, edge: string) {
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry)
      if (d <= 1) put(img, cx + x, cy + y, d > 0.7 ? edge : fill)
    }
}

type Variant = { id: string; title: string; render: (sprite: Img, lab: string) => Img }

const main = (lab: string) => logos[lab]!.colors["1"]!
const plain = (sprite: Img) => {
  const c = blank(W, H)
  draw(c, sprite, OX, OY)
  return c
}

const variants: Variant[] = [
  { id: "a-chest", title: "a  chest emblem only", render: s => plain(s) },
  {
    id: "b-held", title: "b  holding the mark",
    render: (s, lab) => {
      const c = plain(s)
      draw(c, mark(lab, true), OX + 23, OY + 25)
      return c
    },
  },
  {
    id: "c-standee", title: "c  mark standing beside",
    render: (s, lab) => {
      const c = plain(s)
      const b = badge(lab, INK)!
      draw(c, b, W - b.w, OY + 35 - b.h)
      return c
    },
  },
  {
    id: "d-halo", title: "d  big mark behind",
    render: (s, lab) => {
      const c = blank(W, H)
      const b = double(badge(lab, INK)!)
      draw(c, fade(b, 80), OX + 20 - Math.floor(b.w / 2), OY + 22 - Math.floor(b.h / 2))
      draw(c, s, OX, OY)
      return c
    },
  },
  {
    id: "e-platform", title: "e  standing on the mark",
    render: (s, lab) => {
      const c = blank(W, H)
      const color = main(lab)
      ellipse(c, OX + 20, OY + 37, 14, 5, darken(color, 0.9), darken(color, 0.55))
      const m = mark(lab, false, "#f8f8f8")
      draw(c, m, OX + 20 - Math.floor(m.w / 2), OY + 40 - Math.floor(m.h / 2) + 1)
      draw(c, s, OX, OY)
      return c
    },
  },
  {
    id: "f-partner", title: "f  mark floating by the head",
    render: (s, lab) => {
      const c = plain(s)
      draw(c, mark(lab, true), OX + 25, OY + 12)
      return c
    },
  },
  {
    id: "g-flag", title: "g  carrying a flag",
    render: (s, lab) => {
      const c = plain(s)
      const x = OX + 26
      for (let y = OY + 10; y <= OY + 32; y++) put(c, x, y, "#5a3a22")
      put(c, x, OY + 9, "#f8d040")
      const m = mark(lab, false)
      const fw = m.w + 2, fh = m.h + 2
      for (let y = 0; y < fh; y++) for (let fx = 0; fx < fw; fx++) {
        const edge = y === 0 || y === fh - 1 || fx === fw - 1
        put(c, x + 1 + fx, OY + 10 + y, edge ? INK : "#f8f4ec")
      }
      draw(c, m, x + 2, OY + 11)
      return c
    },
  },
]

const scale = 5
const cell = W * scale
const label = 26
const bg = "#b8c8b0"

async function tile(img: Img) {
  return toSharp(img).resize(img.w * scale, img.h * scale, { kernel: "nearest" }).png().toBuffer()
}

const text = (s: string, w: number, h: number, size = 13, anchor = "middle") =>
  Buffer.from(`<svg width="${w}" height="${h}"><text x="${anchor === "middle" ? "50%" : "8"}" y="${h - 9}" font-family="Menlo, monospace" font-size="${size}" fill="#2a2a2a" text-anchor="${anchor}">${s}</text></svg>`)

const sprites = new Map<string, Img>()
for (const card of cards) sprites.set(card.name, await compose(card))

for (const v of variants) {
  const cols = 5, rows = Math.ceil(cards.length / cols)
  const layers: OverlayOptions[] = [{ input: text(v.title, cols * cell, 36, 18, "start"), left: 0, top: 0 }]
  for (const [i, card] of cards.entries()) {
    const x = (i % cols) * cell, y = 36 + Math.floor(i / cols) * (cell + label)
    const img = v.render(sprites.get(card.name)!, card.lab!)
    mkdirSync(`${dir}${v.id}`, { recursive: true })
    await toSharp(img).png().toFile(`${dir}${v.id}/${card.name}.png`)
    layers.push({ input: await tile(img), left: x, top: y })
    layers.push({ input: text(card.name, cell, label), left: x, top: y + cell })
  }
  await sharp({ create: { width: cols * cell, height: 36 + rows * (cell + label), channels: 4, background: bg } })
    .composite(layers).png().toFile(`${dir}${v.id}.png`)
}

const picks = ["claude-opus-5.5", "deepseek-v4.1-flash", "kimi-k3", "grok-4.20", "mistral-medium-3.5"]
const titleW = 260
const layers: OverlayOptions[] = []
for (const [r, v] of variants.entries()) {
  const y = r * cell
  layers.push({ input: text(v.title, titleW, cell / 2 + 10, 15, "start"), left: 0, top: y })
  for (const [i, name] of picks.entries()) {
    const card = cards.find(c => c.name === name)!
    layers.push({ input: await tile(v.render(sprites.get(name)!, card.lab!)), left: titleW + i * cell, top: y })
  }
}
await sharp({ create: { width: titleW + picks.length * cell, height: variants.length * cell, channels: 4, background: bg } })
  .composite(layers).png().toFile(`${dir}overview.png`)

console.log(`${variants.length} variants -> ${dir}`)
