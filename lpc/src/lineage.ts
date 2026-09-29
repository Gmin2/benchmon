// builds every release of every model line, plus three stat tiers for the roster
// bun src/lineage.ts
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { composeCard, type CardSpec, type LayerSpec } from "./compose"
import { withMarks, save, type Canvas } from "./marks"
import { aura, dark, sparkles } from "./fx"

type Family = { lab: string; main: string; accent: string; metal: string; wings: LayerSpec }
type LadderLayer = LayerSpec & { replaces?: string[] }
type Release = {
  name: string
  step: number
  roster?: boolean
  next?: boolean
  drop?: string[]
  add?: LayerSpec[]
  recolor?: Record<string, string>
}
type Line = { id: string; family: string; from: string; releases: Release[] }
type Lineage = { families: Record<string, Family>; ladder: LadderLayer[][]; lines: Line[] }

const root = new URL("..", import.meta.url).pathname
const out = join(root, "out")
const lineage: Lineage = JSON.parse(readFileSync(join(root, "lineage.json"), "utf8"))
const { cards } = JSON.parse(readFileSync(join(root, "cards.json"), "utf8")) as { cards: (CardSpec & { lab: string })[] }

const FRAME = 64

function fill(color: string | string[] | undefined, fam: Family) {
  const one = (c: string) => (c === "$main" ? fam.main : c === "$accent" ? fam.accent : c === "$metal" ? fam.metal : c)
  if (color === undefined) return undefined
  return Array.isArray(color) ? color.map(one) : one(color)
}

export function releaseSpec(line: Line, release: Release): CardSpec & { lab: string } {
  const base = cards.find(c => c.name === line.from)
  if (!base) throw new Error(`no card ${line.from}`)
  const fam = lineage.families[line.family]!
  let layers: LayerSpec[] = base.layers
    .filter(l => !(release.drop ?? []).some(d => l.item.includes(d)))
    .map(l => {
      const hit = Object.entries(release.recolor ?? {}).find(([k]) => l.item.includes(k))
      return hit ? { ...l, color: hit[1] } : { ...l }
    })
  for (let step = 1; step <= release.step; step++)
    for (const { replaces, ...layer } of lineage.ladder[step] ?? []) {
      if (replaces) layers = layers.filter(l => !replaces.some(r => l.item.includes(r)))
      layers.push({ ...layer, color: fill(layer.color, fam) })
    }
  layers.push(...(release.add ?? []))
  return { ...base, name: release.name, lab: fam.lab, layers }
}

const toCanvas = (px: Uint8Array): Canvas => ({ w: FRAME, h: FRAME, data: Buffer.from(px) })

async function render(spec: CardSpec & { lab: string }, tier: 1 | 2 | 3, fam: Family) {
  const layers = tier === 3 ? [...spec.layers, fam.wings] : spec.layers
  const c = toCanvas(await composeCard({ ...spec, layers }))
  if (tier === 2) aura(c, dark(fam.main) ? fam.accent : fam.main, [230, 110])
  if (tier === 3) {
    aura(c, "#ffd84a", [240, 140, 60])
    sparkles(c, spec.name)
  }
  return withMarks(c, spec.lab)
}

const index: { line: string; family: string; releases: { name: string; step: number; roster: boolean; next: boolean }[] }[] = []

for (const line of lineage.lines) {
  const fam = lineage.families[line.family]!
  const dir = join(out, "lineage", line.id)
  for (const release of line.releases) {
    const spec = releaseSpec(line, release)
    const { full, bust } = await render(spec, 1, fam)
    await save(full, dir, release.name)
    await save(bust, dir, `${release.name}-bust`)

    if (release.roster)
      for (const tier of [1, 2, 3] as const) {
        const t = await render(spec, tier, fam)
        await save(t.full, join(out, "tiers"), `${release.name}-t${tier}`)
        await save(t.bust, join(out, "tiers"), `${release.name}-t${tier}-bust`)
      }
  }
  index.push({
    line: line.id,
    family: line.family,
    releases: line.releases.map(r => ({ name: r.name, step: r.step, roster: !!r.roster, next: !!r.next })),
  })
  console.log(`${line.id}: ${line.releases.map(r => r.name).join(" -> ")}`)
}

writeFileSync(join(out, "lineage.json"), JSON.stringify(index, null, 2))
