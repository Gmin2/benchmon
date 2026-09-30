import sharp from "sharp"
import { readFileSync, mkdirSync } from "node:fs"
import { logos, pixels } from "../logos.ts"

const BASES = new URL("./pok3/bases/", import.meta.url).pathname
const FRAME = 40
const HEAD = 20

type Rgb = [number, number, number]

export type Spec = {
  name: string
  lab?: string
  emblem?: string
  body: "male" | "female"
  head?: string
  eyes?: string
  hair?: string
  hat?: string
  outfit?: string
  skin: string
  hairColor: string
  brows?: string
  eyeColor?: string
  hairAcc?: string[]
  hatColors?: string[]
  top?: string[]
  bottom?: string[]
  shoes?: string[]
}

export type Img = { w: number; h: number; data: Buffer }

const SKIN = { base: "#b8f8b8", ramp: ["#b8f8b8", "#98e898", "#70d870"] }
const OUTLINE = ["#557840", "#364030"]
const HAIR = { base: "#b0b0f8", ramp: ["#b0b0f8", "#8080f0", "#4848c8", "#303070"] }
const IRIS = { base: "#ff0000", ramp: ["#ff0000", "#884848"] }
const EYE_WHITE = { base: "#00ffff", ramp: ["#00ffff", "#a8d8d8"] }
const CLOTH = [
  { base: "#f08080", ramp: ["#f08080", "#f8b0b0", "#c84848", "#703030"] },
  { base: "#f0b880", ramp: ["#f0b880", "#f8d4b0", "#c88848", "#705030"] },
  { base: "#f0f080", ramp: ["#f0f080", "#f8f8b0", "#c8c848", "#707030"] },
  { base: "#b8f080", ramp: ["#b8f080", "#d4f8b0", "#88c848", "#507030"] },
]

export const hex = (s: string): Rgb => {
  const n = parseInt(s.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const key = (c: Rgb) => (c[0] << 16) | (c[1] << 8) | c[2]

function toHsv([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const d = max - min
  let h = 0
  if (d) {
    if (max === r / 255) h = ((g - b) / 255 / d) % 6
    else if (max === g / 255) h = (b - r) / 255 / d + 2
    else h = (r - g) / 255 / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, max ? d / max : 0, max]
}

function fromHsv([h, s, v]: Rgb): Rgb {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
  const [r, g, b] = ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as Rgb[])[((i % 6) + 6) % 6]!
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))

// same trick tdsm uses: keep the shading of the template ramp, take hue from the chosen colour
function shade(input: Rgb, base: Rgb, chosen: Rgb, outline = false): Rgb {
  const i = toHsv(input), b = toHsv(base), c = toHsv(chosen)
  const s = b[1] ? clamp((c[1] * i[1]) / b[1]) : c[1]
  const v = clamp((c[2] * i[2]) / b[2])
  let h = c[0]
  if (outline) h = (((c[0] - (b[0] - i[0])) % 1) + 1) % 1
  return fromHsv([h, s, v])
}

function recolorMap(spec: Spec, cloth: string[]) {
  const map = new Map<number, Rgb>()
  const add = (fam: { base: string; ramp: string[] }, chosen: string) =>
    fam.ramp.forEach(c => map.set(key(hex(c)), shade(hex(c), hex(fam.base), hex(chosen))))
  add(SKIN, spec.skin)
  OUTLINE.forEach(c => map.set(key(hex(c)), shade(hex(c), hex(SKIN.base), hex(spec.skin), true)))
  add(HAIR, spec.hairColor)
  add(IRIS, spec.eyeColor ?? "#442525")
  add(EYE_WHITE, "#f8f8f8")
  CLOTH.forEach((fam, i) => add(fam, cloth[i] ?? cloth[0] ?? "#989090"))
  return map
}

async function load(layer: string, id: string): Promise<Img | null> {
  const path = `${BASES}${layer}/${id}.png`
  try {
    readFileSync(path)
  } catch {
    return null
  }
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

export function blank(w: number, h: number): Img {
  return { w, h, data: Buffer.alloc(w * h * 4) }
}

function crop(src: Img, x0: number, y0: number, w: number, h: number): Img {
  const out = blank(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * src.w + x0 + x) * 4
      if (x0 + x >= src.w || y0 + y >= src.h) continue
      src.data.copy(out.data, (y * w + x) * 4, si, si + 4)
    }
  return out
}

function recolor(img: Img, map: Map<number, Rgb>): Img {
  const out = { ...img, data: Buffer.from(img.data) }
  for (let i = 0; i < out.data.length; i += 4) {
    if (!out.data[i + 3]) continue
    const c = map.get(key([out.data[i]!, out.data[i + 1]!, out.data[i + 2]!]))
    if (c) [out.data[i], out.data[i + 1], out.data[i + 2]] = c
  }
  return out
}

function mask(img: Img, m: Img | null): Img {
  if (!m) return img
  const out = { ...img, data: Buffer.from(img.data) }
  for (let i = 0; i < out.data.length; i += 4) if (m.data[i + 3]) out.data[i + 3] = 0
  return out
}

export function draw(dst: Img, src: Img, dx: number, dy: number) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4
      if (!src.data[si + 3]) continue
      const tx = dx + x, ty = dy + y
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue
      src.data.copy(dst.data, (ty * dst.w + tx) * 4, si, si + 4)
    }
}

export function put(img: Img, x: number, y: number, color: string) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return
  const i = (y * img.w + x) * 4
  const [r, g, b] = hex(color)
  img.data[i] = r
  img.data[i + 1] = g
  img.data[i + 2] = b
  img.data[i + 3] = 255
}

export function badge(lab: string, outline = "#1c1c24"): Img | null {
  const logo = logos[lab]
  if (!logo) return null
  const w = Math.max(...logo.badge.map(r => r.length)) + 2
  const h = logo.badge.length + 2
  const img = blank(w, h)
  const px = pixels(logo.badge, logo.colors)
  const filled = new Set(px.map(p => `${p.x + 1},${p.y + 1}`))
  for (const p of px)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${p.x + 1 + dx},${p.y + 1 + dy}`
      if (!filled.has(k)) put(img, p.x + 1 + dx, p.y + 1 + dy, outline)
    }
  for (const p of px) put(img, p.x + 1, p.y + 1, p.color)
  return img
}

// front facing idle: column 1, row 0 on the 40px body sheets, column 0 on the 20px head sheets
const bodyFrame = (img: Img | null) => (img ? crop(img, FRAME, 0, FRAME, FRAME) : null)
const headFrame = (img: Img | null) => (img ? crop(img, 0, 0, HEAD, HEAD) : null)

export async function compose(spec: Spec): Promise<Img> {
  const sex = spec.body === "male" ? "dm" : "df"
  const hair = spec.hair ?? "cowlick"
  const hairAcc = spec.hairAcc ?? []
  const hat = spec.hat
  const hatMap = recolorMap(spec, spec.hatColors ?? [])
  const hairMap = recolorMap(spec, hairAcc)
  const skinMap = recolorMap({ ...spec, hairColor: spec.brows ?? spec.hairColor }, [])

  const out = blank(FRAME, FRAME)
  const hx = 10, hy = 12

  if (hat) {
    const back = headFrame(await load("hat-back", hat))
    if (back) draw(out, recolor(back, hatMap), hx, hy)
  }
  const hairBack = headFrame(await load("hair-back", hair))
  if (hairBack) {
    const m = hat ? headFrame(await load("hat-back-mask", hat)) : null
    draw(out, mask(recolor(hairBack, hairMap), m), hx, hy)
  }

  const body = bodyFrame(await load("body", `default-${spec.body}`))
  if (body) draw(out, recolor(body, skinMap), 0, 0)

  const articles: [string, string, string[] | undefined][] = spec.outfit
    ? [[`${sex}-outfit`, spec.outfit, spec.top]]
    : [
        [`${sex}-bottom`, "pants", spec.bottom],
        [`${sex}-shoes`, "simple", spec.shoes],
        [`${sex}-top`, "t-shirt", spec.top],
      ]
  for (const [layer, id, colors] of articles) {
    const img = bodyFrame(await load(layer, id))
    if (img) draw(out, recolor(img, recolorMap(spec, colors ?? [])), 0, 0)
  }

  const logo = spec.lab ? logos[spec.lab] : undefined
  if (logo) for (const p of pixels(logo.chest, logo.colors, spec.emblem ?? "#f8f8f8")) put(out, 18 + p.x, 28 + p.y, p.color)

  const head = headFrame(await load("head", spec.head ?? "standard-head"))
  if (head) draw(out, recolor(head, skinMap), hx, hy)
  const eyes = headFrame(await load("eyes", spec.eyes ?? "default"))
  if (eyes) draw(out, recolor(eyes, skinMap), hx, hy)

  const hairImg = headFrame(await load("hair", hair))
  if (hairImg) {
    const m = hat ? headFrame(await load("hat-mask", hat)) : null
    draw(out, mask(recolor(hairImg, hairMap), m), hx, hy)
  }
  if (hat) {
    const h = headFrame(await load("hat", hat))
    if (h) draw(out, recolor(h, hatMap), hx, hy)
  }
  const front = headFrame(await load("hair-front", hair))
  if (front) draw(out, recolor(front, hairMap), hx, hy)

  return out
}

export function toSharp(img: Img) {
  return sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
}

export async function writeSprite(spec: Spec, dir: string, scale = 8) {
  mkdirSync(dir, { recursive: true })
  const img = await compose(spec)
  await toSharp(img).png().toFile(`${dir}/${spec.name}@1x.png`)
  await toSharp(img).resize(img.w * scale, img.h * scale, { kernel: "nearest" }).png().toFile(`${dir}/${spec.name}@${scale}x.png`)
  return img
}
