// arena backdrops, one per arena stat, composed from lpc tiles at 1x then scaled up
// bun src/build.ts
import sharp, { type OverlayOptions } from "sharp"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const out = join(root, "out")
const T = 32
const W = 384
const H = 216
const WALL = 104 // floor starts here

const SHEETS = {
  obj: "vendor/Atlas2/obj_misk_atlas.png",
  int: "vendor/LPC_house_interior_0/LPC_house_interior/interior.png",
  floor: "vendor/lpc-floors/lpc-floors/floors.png",
} as const
type Sheet = keyof typeof SHEETS

type Tile = { sheet: Sheet; tx: number; ty: number; tw?: number; th?: number }
type Prop = Tile & { x: number; y?: number; flip?: boolean }
type Arena = {
  id: string
  title: string
  wall: Tile
  wallTint: number
  floor: Tile
  floorTint: number
  rug?: Tile
  props: Prop[]
  front?: Prop[]
  sky?: [string, string]
  lanes?: boolean
  light: string
}

const cache = new Map<string, Buffer>()
async function cut({ sheet, tx, ty, tw = 1, th = 1 }: Tile, flip = false) {
  const key = `${sheet}:${tx}:${ty}:${tw}:${th}:${flip}`
  const hit = cache.get(key)
  if (hit) return hit
  let img = sharp(join(root, SHEETS[sheet])).extract({ left: tx * T, top: ty * T, width: tw * T, height: th * T })
  if (flip) img = img.flop()
  const buf = await img.png().toBuffer()
  cache.set(key, buf)
  return buf
}

// stretches a rug sideways: first and last columns stay, the middle ones repeat
async function stage(rug: Tile, cols: number) {
  const tw = rug.tw ?? 1, th = rug.th ?? 1
  const layers: OverlayOptions[] = []
  for (let c = 0; c < cols; c++) {
    const src = c === 0 ? 0 : c === cols - 1 ? tw - 1 : 1 + ((c - 1) % Math.max(1, tw - 2))
    layers.push({ input: await cut({ sheet: rug.sheet, tx: rug.tx + src, ty: rug.ty, th }), left: c * T, top: 0 })
  }
  return sharp({ create: { width: cols * T, height: th * T, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .modulate({ brightness: 0.85 })
    .png()
    .toBuffer()
}

async function tiled(tile: Tile, width: number, height: number, tint: number) {
  const unit = await cut(tile)
  const tw = (tile.tw ?? 1) * T, th = (tile.th ?? 1) * T
  const layers: OverlayOptions[] = []
  for (let y = 0; y < height; y += th) for (let x = 0; x < width; x += tw) layers.push({ input: unit, left: x, top: y })
  return sharp({ create: { width, height, channels: 4, background: "#000" } })
    .composite(layers)
    .modulate({ brightness: tint })
    .png()
    .toBuffer()
}

// soft pixel light from above plus a dark edge, so cards on top stay the brightest thing
function lightSvg(color: string) {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="v" cx="50%" cy="58%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".72"/></radialGradient>
      <radialGradient id="l" cx="50%" cy="0%" r="70%"><stop offset="0%" stop-color="${color}" stop-opacity=".28"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="${W}" height="${WALL}" fill="url(#s)" opacity=".5"/>
    <rect width="${W}" height="${H}" fill="url(#l)"/>
    <rect width="${W}" height="${H}" fill="url(#v)"/>
  </svg>`)
}

// the two spots the cards land on, drawn as pixel rings
function spotsSvg() {
  const ring = (cx: number, color: string) => {
    let r = ""
    const rx = 34, ry = 9, cy = 170
    for (let x = -rx; x <= rx; x++)
      for (let y = -ry; y <= ry; y++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry)
        if (d <= 1 && d > 0.72) r += `<rect x="${cx + x}" y="${cy + y}" width="1" height="1" fill="${color}"/>`
        else if (d <= 0.72) r += `<rect x="${cx + x}" y="${cy + y}" width="1" height="1" fill="#000" fill-opacity=".22"/>`
      }
    return r
  }
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${ring(112, "#cdf462")}${ring(272, "#ff6b5e")}</svg>`)
}

function lanesSvg() {
  let r = ""
  for (const y of [132, 164, 196]) for (let x = 0; x < W; x += 24) r += `<rect x="${x}" y="${y}" width="12" height="2" fill="#f4f1ea" fill-opacity=".55"/>`
  r += `<rect x="0" y="${WALL + 6}" width="${W}" height="2" fill="#f4f1ea" fill-opacity=".7"/>`
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${r}</svg>`)
}

const ARENAS: Arena[] = [
  {
    id: "code",
    title: "server room",
    wall: { sheet: "floor", tx: 24, ty: 39, tw: 2, th: 2 },
    wallTint: 0.55,
    floor: { sheet: "floor", tx: 24, ty: 35, tw: 2, th: 2 },
    floorTint: 0.6,
    rug: { sheet: "floor", tx: 20, ty: 26, tw: 3, th: 2 },
    light: "#6bc8ff",
    props: [
      { sheet: "obj", tx: 21, ty: 18, th: 2, x: 8 },
      { sheet: "obj", tx: 21, ty: 18, th: 2, x: 40 },
      { sheet: "obj", tx: 21, ty: 18, th: 2, x: 72 },
      { sheet: "obj", tx: 23, ty: 5, tw: 3, th: 3, x: 144 },
      { sheet: "obj", tx: 21, ty: 18, th: 2, x: 280 },
      { sheet: "obj", tx: 21, ty: 18, th: 2, x: 312 },
      { sheet: "obj", tx: 20, ty: 14, tw: 2, th: 2, x: 340, y: WALL - 56 },
    ],
  },
  {
    id: "math",
    title: "chalk hall",
    wall: { sheet: "floor", tx: 6, ty: 39, tw: 2, th: 2 },
    wallTint: 0.7,
    floor: { sheet: "floor", tx: 0, ty: 37, tw: 2, th: 2 },
    floorTint: 0.75,
    rug: { sheet: "floor", tx: 16, ty: 30, tw: 4, th: 3 },
    light: "#cdf462",
    props: [
      { sheet: "obj", tx: 14, ty: 4, th: 3, x: 16 },
      { sheet: "obj", tx: 15, ty: 4, th: 3, x: 48 },
      { sheet: "obj", tx: 20, ty: 16, tw: 3, th: 2, x: 120 },
      { sheet: "obj", tx: 20, ty: 16, tw: 3, th: 2, x: 216 },
      { sheet: "int", tx: 1, ty: 10, x: 330 },
      { sheet: "obj", tx: 14, ty: 4, th: 3, x: 352 },
    ],
  },
  {
    id: "reasoning",
    title: "library",
    wall: { sheet: "floor", tx: 6, ty: 41, tw: 2, th: 1 },
    wallTint: 0.75,
    floor: { sheet: "floor", tx: 6, ty: 40, tw: 2, th: 1 },
    floorTint: 0.7,
    rug: { sheet: "floor", tx: 20, ty: 30, tw: 4, th: 3 },
    light: "#b9a4ff",
    props: [
      { sheet: "obj", tx: 14, ty: 4, th: 3, x: 0 },
      { sheet: "obj", tx: 15, ty: 4, th: 3, x: 32 },
      { sheet: "obj", tx: 13, ty: 11, th: 3, x: 64 },
      { sheet: "obj", tx: 14, ty: 11, th: 3, x: 96 },
      { sheet: "obj", tx: 8, ty: 30, th: 2, x: 132 },
      { sheet: "obj", tx: 8, ty: 30, th: 2, x: 220 },
      { sheet: "obj", tx: 14, ty: 11, th: 3, x: 256 },
      { sheet: "obj", tx: 13, ty: 11, th: 3, x: 288 },
      { sheet: "obj", tx: 15, ty: 4, th: 3, x: 320 },
      { sheet: "obj", tx: 14, ty: 4, th: 3, x: 352 },
    ],
  },
  {
    id: "speed",
    title: "night track",
    wall: { sheet: "floor", tx: 24, ty: 37, tw: 2, th: 2 },
    wallTint: 0.45,
    floor: { sheet: "floor", tx: 26, ty: 39, tw: 2, th: 2 },
    floorTint: 0.4,
    lanes: true,
    light: "#ffd84a",
    props: [
      { sheet: "obj", tx: 23, ty: 21, th: 3, x: 20, y: WALL - 96 + 8 },
      { sheet: "obj", tx: 20, ty: 22, tw: 2, x: 70, y: 50 },
      { sheet: "obj", tx: 20, ty: 21, tw: 2, x: 170, y: 40 },
      { sheet: "obj", tx: 22, ty: 21, x: 250, y: 56 },
      { sheet: "obj", tx: 23, ty: 20, x: 300, y: WALL + 2 },
      { sheet: "obj", tx: 23, ty: 21, th: 3, x: 344, y: WALL - 96 + 8 },
      { sheet: "obj", tx: 23, ty: 20, x: 350, y: WALL + 2 },
    ],
  },
  {
    id: "cost",
    title: "market",
    wall: { sheet: "floor", tx: 0, ty: 39, tw: 2, th: 2 },
    wallTint: 0.6,
    floor: { sheet: "floor", tx: 24, ty: 35, tw: 2, th: 2 },
    floorTint: 0.75,
    rug: { sheet: "floor", tx: 24, ty: 30, tw: 4, th: 3 },
    light: "#7be0a8",
    props: [
      { sheet: "obj", tx: 5, ty: 16, tw: 3, th: 3, x: 0 },
      { sheet: "obj", tx: 8, ty: 20, th: 2, x: 104 },
      { sheet: "obj", tx: 9, ty: 20, th: 2, x: 136 },
      { sheet: "obj", tx: 13, ty: 20, th: 2, x: 216 },
      { sheet: "obj", tx: 14, ty: 20, th: 2, x: 248 },
      { sheet: "obj", tx: 5, ty: 16, tw: 3, th: 3, x: 288 },
    ],
    front: [
      { sheet: "obj", tx: 0, ty: 15, tw: 2, th: 2, x: 0, y: H - 52 },
      { sheet: "obj", tx: 3, ty: 15, tw: 2, th: 2, x: 320, y: H - 52 },
    ],
  },
  {
    id: "honesty",
    title: "court",
    wall: { sheet: "floor", tx: 0, ty: 35, tw: 2, th: 2 },
    wallTint: 0.72,
    floor: { sheet: "int", tx: 0, ty: 4 },
    floorTint: 0.72,
    rug: { sheet: "floor", tx: 12, ty: 30, tw: 4, th: 3 },
    light: "#fff3b0",
    props: [
      { sheet: "obj", tx: 27, ty: 0, th: 4, x: 24 },
      { sheet: "obj", tx: 18, ty: 28, th: 4, x: 56 },
      { sheet: "obj", tx: 21, ty: 30, th: 2, x: 104 },
      { sheet: "obj", tx: 27, ty: 0, th: 4, x: 132 },
      { sheet: "obj", tx: 27, ty: 0, th: 4, x: 220 },
      { sheet: "obj", tx: 21, ty: 30, th: 2, x: 248 },
      { sheet: "obj", tx: 18, ty: 28, th: 4, x: 296, flip: true },
      { sheet: "obj", tx: 27, ty: 0, th: 4, x: 328 },
    ],
  },
]

async function build(a: Arena) {
  const layers: OverlayOptions[] = []
  layers.push({ input: await tiled(a.wall, W, WALL, a.wallTint), left: 0, top: 0 })
  layers.push({ input: await tiled(a.floor, W, H - WALL, a.floorTint), left: 0, top: WALL })
  // baseboard where wall meets floor
  layers.push({
    input: Buffer.from(`<svg width="${W}" height="6"><rect width="${W}" height="4" fill="#1a1410"/><rect y="4" width="${W}" height="2" fill="#000" fill-opacity=".35"/></svg>`),
    left: 0,
    top: WALL - 2,
  })
  if (a.lanes) layers.push({ input: lanesSvg(), left: 0, top: 0 })
  if (a.rug) layers.push({ input: await stage(a.rug, 8), left: (W - 8 * T) / 2, top: WALL + Math.round((H - WALL - (a.rug.th ?? 1) * T) / 2) })
  for (const p of a.props) {
    const img = await cut(p, p.flip)
    const ph = (p.th ?? 1) * T
    layers.push({ input: img, left: p.x, top: p.y ?? WALL - ph + 4 })
  }
  layers.push({ input: spotsSvg(), left: 0, top: 0 })
  for (const p of a.front ?? []) layers.push({ input: await cut(p, p.flip), left: p.x, top: p.y ?? H - (p.th ?? 1) * T })
  layers.push({ input: lightSvg(a.light), left: 0, top: 0 })

  const flat = await sharp({ create: { width: W, height: H, channels: 4, background: "#000" } })
    .composite(layers)
    .modulate({ brightness: 0.85, saturation: 0.85 })
    .png()
    .toBuffer()
  await sharp(flat).toFile(join(out, `${a.id}@1x.png`))
  await sharp(flat).resize(W * 4, H * 4, { kernel: "nearest" }).png().toFile(join(out, `${a.id}@4x.png`))
}

mkdirSync(out, { recursive: true })
for (const a of ARENAS) {
  await build(a)
  console.log(`${a.id} · ${a.title}`)
}
