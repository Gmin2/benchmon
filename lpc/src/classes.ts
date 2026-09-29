// player avatars: pick a class, a body, a look and a colour. rank adds gear.
// bun src/classes.ts   -> demo set in out/classes
import { join } from "node:path"
import { writeFileSync } from "node:fs"
import { composeCard, type BodyType, type LayerSpec } from "./compose"
import { save, put, type Canvas } from "./marks"
import { aura, sparkles } from "./fx"

export type ClassId = "researcher" | "hacker" | "trader" | "builder" | "sage" | "athlete" | "scout" | "validator"
export const RANKS = ["rookie", "trainer", "ace", "champion"] as const
export type Rank = (typeof RANKS)[number]

export type Player = {
  cls: ClassId
  body: BodyType
  skin: string
  eyes: string
  hair: string
  hairColor: string
  color: string
  accent: string
  rank: Rank
}

type ClassDef = {
  title: string
  blurb: string
  helmet?: boolean
  outfit: (p: Player) => LayerSpec[]
  glyph: string[]
}

const DARK = "#2e2e38"
const top = (p: Player, female: string, male: string) => (p.body === "female" ? female : male)

export const CLASSES: Record<ClassId, ClassDef> = {
  researcher: {
    title: "researcher",
    blurb: "runs the evals, trusts the data",
    outfit: p => [
      { item: "torso/shirts/longsleeve/torso_clothes_longsleeve2_buttoned", color: p.color },
      { item: "torso/aprons/torso_aprons_apron", color: "#f2efe6" },
      { item: "legs/pants/legs_formal", color: DARK },
      { item: "feet/shoes/feet_shoes_basic", color: "black" },
      { item: "headwear/accessories/glasses/facial_glasses_round", variant: "black" },
      { item: "weapons/magic/weapon_magic_crystal", variant: "blue" },
    ],
    glyph: ["..111..", "..1.1..", "..1.1..", ".1...1.", "1.222.1", "1.222.1", ".11111."],
  },
  hacker: {
    title: "hacker",
    blurb: "finds the jailbreak first",
    outfit: p => [
      { item: "torso/shirts/longsleeve/torso_clothes_longsleeve2", color: p.color },
      { item: "headwear/coverings/hoods/hat_hood_cloth", color: p.color },
      { item: "legs/pants/legs_pants", color: DARK },
      { item: "feet/shoes/feet_shoes_revised", color: p.accent },
      { item: "headwear/accessories/glasses/facial_glasses_sunglasses", variant: "sunglasses" },
    ],
    glyph: ["1111111", "1.....1", "12....1", "1.2...1", "12.22.1", "1.....1", "1111111"],
  },
  trader: {
    title: "trader",
    blurb: "reads the market, backs the winner",
    outfit: p => [
      { item: "torso/shirts/longsleeve/torso_clothes_longsleeve2_polo", color: "#f2efe6" },
      { item: "headwear/neck/neck_necktie", color: p.accent },
      { item: top(p, "torso/jacket/torso_jacket_tabard", "torso/jacket/torso_jacket_collared"), variant: "black", color: p.color },
      { item: "legs/pants/legs_formal_striped", color: DARK },
      { item: "feet/shoes/feet_shoes_basic", color: "black" },
      { item: "headwear/hats/formal/hat_formal_bowler", color: DARK },
    ],
    glyph: [".....11", "....1.1", "1..1...", "11.1...", "1.1....", "1......", "1111111"],
  },
  builder: {
    title: "builder",
    blurb: "ships the agent, fixes it live",
    outfit: p => [
      { item: "torso/shirts/shortsleeve/torso_clothes_tshirt", color: "#f2efe6" },
      { item: "torso/aprons/torso_aprons_overalls", variant: "blue", color: p.color },
      { item: "headwear/coverings/bandana/hat_bandana2", color: p.accent },
      { item: "arms/arms_gloves", color: "#6b4a32" },
      { item: "legs/pants/legs_pants", color: p.color },
      { item: "feet/boots/feet_boots_basic", color: "brown" },
      { item: "tools/tool_hammer" },
    ],
    glyph: ["1111...", "11111..", "1111...", "..11...", "...11..", "....11.", ".....11"],
  },
  sage: {
    title: "sage",
    blurb: "whispers the perfect prompt",
    outfit: p => [
      p.body === "female"
        ? { item: "torso/shirts/torso_clothes_robe", color: p.color }
        : { item: "torso/shirts/longsleeve/torso_clothes_longsleeve", color: p.color },
      { item: "torso/waist/belt_robe", color: p.accent },
      { item: "headwear/coverings/headbands/hat_headband_hairtie_rune", color: p.accent },
      { item: "torso/cape/cape_tattered", color: p.color },
      { item: "legs/pants/legs_pants", color: p.color },
      { item: "feet/feet_sandals", color: "tan" },
      { item: "weapons/magic/weapon_magic_s", variant: "medium" },
    ],
    glyph: ["...1...", "..121..", "1122211", ".12221.", "..121..", ".1.1.1.", "1.....1"],
  },
  athlete: {
    title: "athlete",
    blurb: "speedruns every benchmark",
    outfit: p => [
      { item: "torso/shirts/sleeveless/torso_clothes_sleeveless2", color: p.color },
      { item: "headwear/coverings/headbands/hat_headband_tied", color: p.accent },
      { item: "legs/shorts/legs_shorts_short", color: DARK },
      { item: "feet/socks/feet_socks_high", color: "white" },
      { item: "feet/shoes/feet_shoes_revised", color: p.color },
    ],
    glyph: ["..111..", "...1...", ".11111.", "1..1..1", "1..11.1", "1.....1", ".11111."],
  },
  scout: {
    title: "scout",
    blurb: "finds new models before launch",
    outfit: p => [
      { item: "torso/shirts/longsleeve/torso_clothes_longsleeve", color: p.accent },
      { item: "torso/armour/torso_armour_leather", color: p.color },
      { item: "torso/backpack/backpack_squarepack", variant: "tan" },
      { item: "torso/backpack/backpack_straps", variant: "tan" },
      { item: "headwear/hats/caps/hat_cap_leather", color: p.color },
      { item: "legs/pants/legs_pants2", color: "#6b4a32" },
      { item: "feet/boots/feet_boots_basic", color: "brown" },
      { item: "weapons/polearm/weapon_polearm_spear" },
    ],
    glyph: ["..111..", ".1...1.", "1...2.1", "1..2..1", "1.2...1", ".1...1.", "..111.."],
  },
  validator: {
    title: "validator",
    blurb: "guards the chain, checks every move",
    helmet: true,
    outfit: p => [
      { item: "torso/armour/torso_armour_plate", color: "#9aa3ad" },
      { item: "arms/arms_armour", color: "#9aa3ad" },
      { item: "legs/legs_armour", color: "#9aa3ad" },
      { item: "feet/feet_armour", color: "#9aa3ad" },
      { item: "headwear/helmets/helmets/hat_helmet_barbuta_simple", color: "#9aa3ad" },
      { item: "weapons/shields/shield_kite", color: p.color },
    ],
    glyph: ["1111111", "1222221", "1222221", "1222221", ".12221.", "..121..", "...1..."],
  },
}

function rankGear(p: Player): LayerSpec[] {
  const level = RANKS.indexOf(p.rank)
  const gear: LayerSpec[] = []
  if (level >= 1) gear.push({ item: "headwear/neck/neck_scarf", color: p.accent })
  if (level === 2) gear.push({ item: "arms/shoulders/shoulders_epaulets", color: "#c9ccd6" })
  if (level >= 3) gear.push({ item: "arms/shoulders/shoulders_epaulets", color: "#e8b430" }, { item: "torso/cape/cape_trim", color: p.color })
  return gear
}

function glyph(cls: ClassId, color: string): Canvas {
  const grid = CLASSES[cls].glyph
  const w = grid[0]!.length + 2, h = grid.length + 2
  const c: Canvas = { w, h, data: Buffer.alloc(w * h * 4) }
  const filled = new Set<string>()
  grid.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && filled.add(`${x},${y}`)))
  for (const k of filled) {
    const [x, y] = k.split(",").map(Number) as [number, number]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      if (!filled.has(`${x + dx},${y + dy}`)) put(c, x + 1 + dx, y + 1 + dy, "#140c18")
  }
  grid.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && put(c, x + 1, y + 1, ch === "2" ? "#f4f1ea" : color)))
  return c
}

function stamp(dst: Canvas, src: Canvas, dx: number, dy: number) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4
      if (!src.data[si + 3]) continue
      src.data.copy(dst.data, ((dy + y) * dst.w + dx + x) * 4, si, si + 4)
    }
}

export async function renderPlayer(p: Player): Promise<Canvas> {
  const def = CLASSES[p.cls]
  const layers: LayerSpec[] = [
    { item: p.body === "female" ? "head/heads/human/heads_human_female" : "head/heads/human/heads_human_male" },
    ...(def.helmet ? [] : [{ item: p.hair, color: p.hairColor }]),
    ...def.outfit(p),
    ...rankGear(p),
  ]
  // champions get their class headwear in gold, or a crown if they wear none
  if (p.rank === "champion") {
    const hat = layers.find(l => /hat_|hood|helmet/.test(l.item) && !l.item.includes("headband"))
    if (hat) hat.color = "#e8b430"
    else layers.push({ item: "headwear/hats/formal/hat_formal_crown", variant: "crown_gold", shift: [0, 4] })
  }
  const px = await composeCard({ name: `${p.cls}-${p.body}-${p.rank}`, body: p.body, skin: p.skin, eyes: p.eyes, layers })
  const c: Canvas = { w: 64, h: 64, data: Buffer.from(px) }
  if (p.rank === "champion") {
    aura(c, "#ffd84a", [230, 110])
    sparkles(c, p.cls + p.color)
  }
  stamp(c, glyph(p.cls, p.color), 44, 10)
  return c
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
  const dir = join(new URL("..", import.meta.url).pathname, "out", "classes")
  const looks: Record<ClassId, [Omit<Player, "cls" | "rank">, Omit<Player, "cls" | "rank">]> = {
    researcher: [
      { body: "male", skin: "light", eyes: "brown", hair: "hair/short/hair_parted", hairColor: "chestnut", color: "#3d7de0", accent: "#f4d35e" },
      { body: "female", skin: "bronze", eyes: "brown", hair: "hair/bob/hair_bob", hairColor: "black", color: "#2f9e9e", accent: "#f4d35e" },
    ],
    hacker: [
      { body: "male", skin: "taupe", eyes: "green", hair: "hair/short/hair_messy2", hairColor: "black", color: "#3a3a44", accent: "#5fe08a" },
      { body: "female", skin: "light", eyes: "purple", hair: "hair/long/hair_long_straight", hairColor: "purple", color: "#6b5bd6", accent: "#e85d9a" },
    ],
    trader: [
      { body: "male", skin: "olive", eyes: "brown", hair: "hair/short/hair_plain", hairColor: "dark_brown", color: "#1f6f4a", accent: "#e0564a" },
      { body: "female", skin: "light", eyes: "blue", hair: "hair/braids/hair_high_ponytail", hairColor: "blonde", color: "#7a1f2b", accent: "#f4d35e" },
    ],
    builder: [
      { body: "male", skin: "brown", eyes: "brown", hair: "hair/short/hair_cowlick", hairColor: "black", color: "#f0a030", accent: "#e0564a" },
      { body: "female", skin: "amber", eyes: "green", hair: "hair/pigtails/hair_pigtails", hairColor: "ginger", color: "#3d7de0", accent: "#f4d35e" },
    ],
    sage: [
      { body: "male", skin: "light", eyes: "gray", hair: "hair/long/hair_long_messy", hairColor: "white", color: "#6b5bd6", accent: "#f4d35e" },
      { body: "female", skin: "olive", eyes: "orange", hair: "hair/xlong/hair_xlong_wavy", hairColor: "red", color: "#1f6f4a", accent: "#f4d35e" },
    ],
    athlete: [
      { body: "male", skin: "bronze", eyes: "brown", hair: "hair/short/hair_bedhead", hairColor: "dark_brown", color: "#e0564a", accent: "#f2efe6" },
      { body: "female", skin: "light", eyes: "blue", hair: "hair/braids/hair_high_ponytail", hairColor: "chestnut", color: "#e85d9a", accent: "#f2efe6" },
    ],
    scout: [
      { body: "male", skin: "amber", eyes: "brown", hair: "hair/short/hair_bangsshort", hairColor: "ginger", color: "#5fb86c", accent: "#f2efe6" },
      { body: "female", skin: "taupe", eyes: "green", hair: "hair/bob/hair_bob", hairColor: "dark_brown", color: "#8a5a3c", accent: "#f4d35e" },
    ],
    validator: [
      { body: "male", skin: "light", eyes: "blue", hair: "hair/short/hair_plain", hairColor: "black", color: "#3d7de0", accent: "#f4d35e" },
      { body: "female", skin: "brown", eyes: "brown", hair: "hair/short/hair_plain", hairColor: "black", color: "#e0564a", accent: "#f4d35e" },
    ],
  }
  const index: { cls: string; title: string; blurb: string; looks: string[] }[] = []
  for (const cls of Object.keys(CLASSES) as ClassId[]) {
    const names: string[] = []
    for (const look of looks[cls]) {
      for (const rank of RANKS) {
        const c = await renderPlayer({ ...look, cls, rank })
        const name = `${cls}-${look.body}-${rank}`
        await save(c, dir, name)
        await save(bust(c), dir, `${name}-bust`)
      }
      names.push(`${cls}-${look.body}`)
    }
    index.push({ cls, title: CLASSES[cls].title, blurb: CLASSES[cls].blurb, looks: names })
    console.log(cls)
  }
  writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 2))
}
