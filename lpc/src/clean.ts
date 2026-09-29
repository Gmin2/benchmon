// flattens lpc sprites: fewer colours, no lone speckle pixels, crisp dark edge
import type { Canvas } from "./marks"

type Lab = [number, number, number]

function toLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

const dist = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

// k-means in oklab, seeded from the most common colours so results are stable
function palette(colors: Map<number, number>, k: number): number[] {
  const entries = [...colors.entries()].sort((a, b) => b[1] - a[1])
  const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const
  const labs = new Map(entries.map(([c]) => [c, toLab(...rgb(c))]))
  const centers: Lab[] = []
  for (const [c] of entries) {
    const lab = labs.get(c)!
    if (centers.every(x => dist(x, lab) > 0.0025)) centers.push(lab)
    if (centers.length === k) break
  }
  let assign = new Map<number, number>()
  for (let iter = 0; iter < 12; iter++) {
    assign = new Map()
    const sums = centers.map(() => [0, 0, 0, 0])
    for (const [c, n] of entries) {
      const lab = labs.get(c)!
      let best = 0
      for (let i = 1; i < centers.length; i++) if (dist(lab, centers[i]!) < dist(lab, centers[best]!)) best = i
      assign.set(c, best)
      const s = sums[best]!
      s[0]! += lab[0] * n
      s[1]! += lab[1] * n
      s[2]! += lab[2] * n
      s[3]! += n
    }
    sums.forEach((s, i) => {
      if (s[3]) centers[i] = [s[0]! / s[3], s[1]! / s[3], s[2]! / s[3]]
    })
  }
  // each cluster takes the real sprite colour closest to its centre, no invented colours
  const reps = centers.map(center => {
    let best = entries[0]![0]
    for (const [c] of entries) if (dist(labs.get(c)!, center) < dist(labs.get(best)!, center)) best = c
    return best
  })
  return entries.map(([c]) => reps[assign.get(c)!]!)
}

export type CleanOptions = { colors: number; despeckle?: number; edge?: boolean }

export function clean(src: Canvas, { colors, despeckle = 1, edge = true }: CleanOptions): Canvas {
  const c = { ...src, data: Buffer.from(src.data) }
  const n = c.w * c.h
  const key = (i: number) => (c.data[i * 4]! << 16) | (c.data[i * 4 + 1]! << 8) | c.data[i * 4 + 2]!
  const solid = (i: number) => c.data[i * 4 + 3]! > 0

  const counts = new Map<number, number>()
  for (let i = 0; i < n; i++) if (solid(i)) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1)
  const order = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const mapped = palette(counts, colors)
  const lookup = new Map(order.map((k, i) => [k, mapped[i]!]))
  const set = (i: number, col: number) => {
    c.data[i * 4] = (col >> 16) & 255
    c.data[i * 4 + 1] = (col >> 8) & 255
    c.data[i * 4 + 2] = col & 255
    c.data[i * 4 + 3] = 255
  }
  for (let i = 0; i < n; i++) if (solid(i)) set(i, lookup.get(key(i))!)

  // a pixel that matches none of its four neighbours takes the colour most of its eight neighbours share
  for (let pass = 0; pass < despeckle; pass++) {
    const next = Buffer.from(c.data)
    for (let y = 1; y < c.h - 1; y++)
      for (let x = 1; x < c.w - 1; x++) {
        const i = y * c.w + x
        if (!solid(i)) continue
        const me = key(i)
        const four = [i - 1, i + 1, i - c.w, i + c.w]
        if (four.some(j => solid(j) && key(j) === me)) continue
        const tally = new Map<number, number>()
        for (const dy of [-1, 0, 1])
          for (const dx of [-1, 0, 1]) {
            const j = i + dy * c.w + dx
            if (j === i || !solid(j)) continue
            tally.set(key(j), (tally.get(key(j)) ?? 0) + 1)
          }
        const [top, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [me, 0]
        if (count >= 4) {
          next[i * 4] = (top >> 16) & 255
          next[i * 4 + 1] = (top >> 8) & 255
          next[i * 4 + 2] = top & 255
        }
      }
    next.copy(c.data)
  }

  if (edge) {
    const next = Buffer.from(c.data)
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const i = y * c.w + x
        if (!solid(i)) continue
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const tx = x + dx!, ty = y + dy!
          return tx < 0 || ty < 0 || tx >= c.w || ty >= c.h || !solid(ty * c.w + tx)
        })
        if (open) next.set([24, 16, 30, 255], i * 4)
      }
    next.copy(c.data)
  }
  return c
}

// same idea on a single lpc layer before stacking, so each part keeps its own colours
export function flattenLayer(data: Uint8Array, size: number, colors: number, despeckle = 1) {
  const c: Canvas = { w: size, h: size, data: Buffer.from(data.buffer, data.byteOffset, data.byteLength) }
  const out = clean(c, { colors, despeckle, edge: false })
  data.set(out.data)
}
