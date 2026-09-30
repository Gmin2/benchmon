import { put, type Canvas } from "./marks"

export function dark(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 180
}

// soft rings around the silhouette, the stronger one right on the edge
export function aura(c: Canvas, color: string, rings: number[]) {
  const n = parseInt(color.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  let solid = new Set<number>()
  for (let i = 0; i < c.w * c.h; i++) if (c.data[i * 4 + 3]) solid.add(i)
  const layers: { idx: number[]; alpha: number }[] = []
  for (const alpha of rings) {
    const ring: number[] = []
    for (const i of solid) {
      const x = i % c.w, y = Math.floor(i / c.w)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = x + dx, ty = y + dy
        if (tx < 0 || ty < 0 || tx >= c.w || ty >= c.h) continue
        const j = ty * c.w + tx
        if (!solid.has(j) && !ring.includes(j)) ring.push(j)
      }
    }
    layers.push({ idx: ring, alpha })
    solid = new Set([...solid, ...ring])
  }
  for (const { idx, alpha } of layers)
    for (const i of idx) {
      c.data[i * 4] = rgb[0]!
      c.data[i * 4 + 1] = rgb[1]!
      c.data[i * 4 + 2] = rgb[2]!
      c.data[i * 4 + 3] = alpha
    }
}

// little four point glints scattered around the figure, same spots every run
export function sparkles(c: Canvas, seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const rand = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000
  const spots = [[8, 14], [54, 20], [10, 40], [55, 46], [6, 26], [57, 32]]
  for (const [bx, by] of spots) {
    if (rand() < 0.25) continue
    const x = bx! + Math.round(rand() * 2), y = by! + Math.round(rand() * 2)
    put(c, x, y, "#fff6c8")
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(c, x + dx, y + dy, "#ffd84a")
  }
}
