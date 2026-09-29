// player avatars: seeded from a wallet address, a species, an outfit and a rank
// bun src/players.ts            -> demo set in out/players
// bun src/players.ts 0xabc...   -> that one player, every rank
import { join } from "node:path"
import { writeFileSync } from "node:fs"
import { composeCard, type BodyType, type CardSpec, type LayerSpec } from "./compose"
import { save, type Canvas } from "./marks"
import { aura, sparkles } from "./fx"

type Species = {
  id: string
  heads: Partial<Record<BodyType, string>>
  skins: string[]
  extra?: LayerSpec[]
  hair?: boolean
}

const SPECIES: Species[] = [
  { id: "human", heads: { male: "head/heads/human/heads_human_male", female: "head/heads/human/heads_human_female" }, skins: ["light", "amber", "olive", "taupe", "bronze", "brown"], hair: true },
  { id: "wolf", heads: { male: "head/heads/beast/heads_wolf_male", female: "head/heads/beast/heads_wolf_female" }, skins: ["fur_grey", "fur_brown", "fur_black", "fur_white", "fur_tan"], extra: [{ item: "body/tails/tail_wolf_fluffy" }] },
  { id: "orc", heads: { male: "head/heads/fantasy/heads_orc_male", female: "head/heads/fantasy/heads_orc_female" }, skins: ["green", "dark_green", "pale_green"], hair: true },
  { id: "lizard", heads: { male: "head/heads/reptile/heads_lizard_male", female: "head/heads/reptile/heads_lizard_female" }, skins: ["bright_green", "green", "blue", "lavender"], extra: [{ item: "body/tails/tail_lizard_alt" }] },
  { id: "goblin", heads: { male: "head/heads/fantasy/heads_goblin", female: "head/heads/fantasy/heads_goblin" }, skins: ["green", "pale_green", "bright_green"], hair: true },
  { id: "rabbit", heads: { male: "head/heads/farm/heads_rabbit", female: "head/heads/farm/heads_rabbit" }, skins: ["fur_white", "fur_tan", "fur_brown", "fur_grey"] },
  { id: "mouse", heads: { male: "head/heads/farm/heads_mouse", female: "head/heads/farm/heads_mouse" }, skins: ["fur_grey", "fur_brown", "fur_tan"] },
  { id: "minotaur", heads: { male: "head/heads/beast/heads_minotaur", female: "head/heads/beast/heads_minotaur_female" }, skins: ["fur_brown", "fur_black", "fur_copper"] },
  { id: "alien", heads: { male: "head/heads/reptile/heads_alien", female: "head/heads/reptile/heads_alien" }, skins: ["lavender", "pale_green", "blue"] },
  { id: "skeleton", heads: { male: "head/heads/undead/heads_skeleton", female: "head/heads/undead/heads_skeleton" }, skins: ["light"] },
  { id: "vampire", heads: { male: "head/heads/undead/heads_vampire", female: "head/heads/undead/heads_vampire" }, skins: ["light"], hair: true },
  { id: "pumpkin", heads: { male: "head/heads/undead/heads_jack", female: "head/heads/undead/heads_jack" }, skins: ["light", "taupe"] },
]

const HAIR = ["hair/short/hair_parted", "hair/short/hair_messy1", "hair/short/hair_messy2", "hair/short/hair_bangsshort", "hair/short/hair_cowlick", "hair/short/hair_bedhead", "hair/long/hair_long_straight", "hair/long/hair_long_messy", "hair/bob/hair_bob", "hair/pigtails/hair_pigtails", "hair/braids/hair_high_ponytail", "hair/spiky/hair_spiked_liberty", "hair/xlong/hair_xlong_wavy"]
const HAIR_COLORS = ["black", "dark_brown", "chestnut", "blonde", "gold", "ginger", "platinum", "white", "red", "pink", "purple", "blue", "green", "navy"]
const EYES = ["brown", "blue", "green", "gray", "purple", "orange", "red"]
const CLOTH = ["#e0564a", "#f0a030", "#f4d35e", "#5fb86c", "#2f9e9e", "#3d7de0", "#6b5bd6", "#c04ec2", "#e85d9a", "#8a5a3c", "#f2efe6", "#3a3a44", "#9aa3ad", "#1f6f4a", "#7a1f2b"]
const TOPS = ["torso/shirts/shortsleeve/torso_clothes_tshirt", "torso/shirts/longsleeve/torso_clothes_longsleeve", "torso/shirts/longsleeve/torso_clothes_longsleeve2", "torso/shirts/longsleeve/torso_clothes_longsleeve2_polo", "torso/shirts/longsleeve/torso_clothes_longsleeve2_vneck", "torso/shirts/sleeveless/torso_clothes_sleeveless2"]
const BOTTOMS = ["legs/pants/legs_pants", "legs/pants/legs_pants2", "legs/shorts/legs_shorts", "legs/leggings/legs_leggings", "legs/skirts/legs_skirts_plain"]
const SHOES = ["feet/shoes/feet_shoes_basic", "feet/boots/feet_boots_basic", "feet/shoes/feet_shoes_revised"]
const HATS: LayerSpec[] = [
  { item: "headwear/coverings/bandana/hat_bandana" },
  { item: "headwear/coverings/headbands/hat_headband_tied" },
  { item: "headwear/coverings/headbands/hat_headband_thick" },
]
const GLASSES: LayerSpec[] = [
  { item: "headwear/accessories/glasses/facial_glasses_round", variant: "black" },
  { item: "headwear/accessories/glasses/facial_glasses_nerd", variant: "black" },
  { item: "headwear/accessories/glasses/facial_glasses_sunglasses", variant: "sunglasses" },
]

export const RANKS = ["rookie", "trainer", "ace", "champion"] as const
export type Rank = (typeof RANKS)[number]

function rng(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function playerSpec(address: string, rank: Rank, attempt = 0): CardSpec & { species: string } {
  // species and body stay fixed for a wallet, only the parts get rerolled
  const who = rng(address.toLowerCase())
  const species = SPECIES[Math.floor(who() * SPECIES.length)]!
  const firstBody: BodyType = who() < 0.5 ? "male" : "female"
  const body: BodyType = attempt < 6 ? firstBody : firstBody === "male" ? "female" : "male"
  const r = rng(`${address.toLowerCase()}:${attempt}`)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!
  const top = pick(CLOTH)
  const accent = pick(CLOTH.filter(c => c !== top))

  const layers: LayerSpec[] = [{ item: species.heads[body]! }, ...(species.extra ?? [])]
  if (species.hair && r() < 0.85) layers.push({ item: pick(HAIR), color: pick(HAIR_COLORS) })
  const hat = r() < 0.35 ? { ...pick(HATS), color: accent } : null
  if (hat) layers.push(hat)
  if (r() < 0.2) layers.push(pick(GLASSES))
  layers.push({ item: pick(TOPS), color: top })
  layers.push({ item: pick(BOTTOMS), color: pick(["#3a3a44", "#2b3a5c", "#6b4a32", accent, "#9aa3ad"]) })
  layers.push({ item: pick(SHOES), color: pick(["brown", "black", "#f2efe6", accent]) })

  const level = RANKS.indexOf(rank)
  if (level >= 1) layers.push({ item: "torso/backpack/backpack_straps", variant: "tan" }, { item: "headwear/neck/neck_scarf", color: accent })
  if (level >= 2) {
    const jacket = body === "male" ? { item: "torso/jacket/torso_jacket_collared", variant: "black" } : { item: "torso/jacket/torso_jacket_tabard" }
    layers.push({ ...jacket, color: accent }, { item: "arms/arms_gloves", color: "#3a3a44" })
  }
  if (level >= 3) {
    layers.push({ item: "arms/shoulders/shoulders_epaulets", color: "#e8b430" }, { item: "torso/cape/cape_trim", color: accent })
    if (hat) layers.splice(layers.indexOf(hat), 1)
    layers.push({ item: "headwear/hats/formal/hat_formal_crown", variant: "crown_gold", shift: [0, 4] })
  }

  return { name: `${address.slice(0, 10)}-${rank}`, body, skin: pick(species.skins), eyes: pick(EYES), species: species.id, layers }
}

export async function renderPlayer(address: string, rank: Rank): Promise<{ canvas: Canvas; spec: CardSpec & { species: string } }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const spec = playerSpec(address, rank, attempt)
    try {
      const px = await composeCard(spec)
      const canvas: Canvas = { w: 64, h: 64, data: Buffer.from(px) }
      if (rank === "champion") {
        aura(canvas, "#ffd84a", [230, 110])
        sparkles(canvas, address)
      }
      return { canvas, spec }
    } catch {
      // some parts dont exist for every head or body, roll the next look
    }
  }
  throw new Error(`no valid look for ${address}`)
}

const BUST = { left: 10, top: 2, width: 44, height: 44 }
function bust(c: Canvas): Canvas {
  const out: Canvas = { w: BUST.width, h: BUST.height, data: Buffer.alloc(BUST.width * BUST.height * 4) }
  for (let y = 0; y < BUST.height; y++) {
    const si = ((BUST.top + y) * c.w + BUST.left) * 4
    c.data.copy(out.data, y * BUST.width * 4, si, si + BUST.width * 4)
  }
  return out
}

if (import.meta.main) {
  const dir = join(new URL("..", import.meta.url).pathname, "out", "players")
  const given = process.argv[2]
  const addresses = given
    ? [given]
    : Array.from({ length: 30 }, (_, i) => {
        const r = rng(`demo-${i}`)
        return "0x" + [...Array(40)].map(() => Math.floor(r() * 16).toString(16)).join("")
      })
  const index: { address: string; species: string; ranks: string[] }[] = []
  for (const address of addresses) {
    let species = ""
    for (const rank of RANKS) {
      const { canvas, spec } = await renderPlayer(address, rank)
      species = spec.species
      await save(canvas, dir, `${address.slice(0, 10)}-${rank}`)
      await save(bust(canvas), dir, `${address.slice(0, 10)}-${rank}-bust`)
    }
    index.push({ address, species, ranks: [...RANKS] })
    console.log(`${address.slice(0, 10)} ${species}`)
  }
  if (!given) writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 2))
}
