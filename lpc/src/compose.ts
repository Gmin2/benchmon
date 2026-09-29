import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { hexToRgb, lightness, rampFrom, rgbToHex, type Rgb } from "./color";

const root = resolve(import.meta.dir, "..");
const vendor = join(root, "vendor");
const outDir = process.env.OUT ? resolve(process.env.OUT) : join(root, "out");
const cardsFile = process.env.CARDS ? resolve(process.env.CARDS) : join(root, "cards.json");

const FRAME = 64;
// walk sheet: 9 columns, rows are up / left / down / right. column 0 is the
// standing pose, row 2 faces the camera.
const DOWN_ROW = 2;

export type BodyType = "male" | "female" | "teen" | "child" | "muscular";

export type LayerSpec = {
  item: string;
  variant?: string;
  color?: string | string[];
  shift?: [number, number];
};

export type CardSpec = {
  name: string;
  body: BodyType;
  skin: string;
  eyes?: string;
  outline?: "none" | "dark" | "thick";
  shades?: 3;
  layers: LayerSpec[];
};

type LayerDef = { zPos?: number } & Record<string, string | number | undefined>;

type RecolorEntry = {
  material: string;
  base?: string;
  source?: string[];
  type_name?: string;
};

type SheetDef = {
  name: string;
  match_body_color?: boolean;
  variants?: string[];
  recolors?: RecolorEntry | Record<string, RecolorEntry>;
  [layer: `layer_${number}`]: LayerDef | undefined;
};

type PaletteMeta = { default: string; base: string };

type Pixels = { data: Uint8Array; width: number; height: number };

type DrawCall = { z: number; frame: Pixels; file: string };

const json = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const defCache = new Map<string, SheetDef>();
function loadDef(item: string): SheetDef {
  let def = defCache.get(item);
  if (!def) {
    def = json<SheetDef>(join(vendor, "sheet_definitions", `${item}.json`));
    defCache.set(item, def);
  }
  return def;
}

const paletteCache = new Map<string, Record<string, string[]>>();
function loadPalette(material: string, version: string): Record<string, string[]> {
  const key = `${material}_${version}`;
  let pal = paletteCache.get(key);
  if (!pal) {
    const file = join(vendor, "palette_definitions", material, `${key}.json`);
    pal = existsSync(file) ? json<Record<string, string[]>>(file) : {};
    paletteCache.set(key, pal);
  }
  return pal;
}

function paletteMeta(material: string): PaletteMeta {
  return json<PaletteMeta>(join(vendor, "palette_definitions", material, `meta_${material}.json`));
}

function recolorEntries(def: SheetDef): RecolorEntry[] {
  const r = def.recolors;
  if (!r) return [];
  if ("material" in r && typeof r.material === "string") return [r as RecolorEntry];
  return Object.keys(r)
    .sort()
    .map((k) => (r as Record<string, RecolorEntry>)[k]);
}

function sourceRamp(entry: RecolorEntry): string[] {
  if (entry.source) return entry.source;
  const meta = paletteMeta(entry.material);
  let version = meta.default;
  let name = meta.base;
  if (entry.base) {
    const parts = entry.base.split(".");
    if (parts.length === 2) [version, name] = parts;
    else name = parts[0];
  }
  const ramp = loadPalette(entry.material, version)[name] ?? loadPalette(entry.material, "ulpc")[name];
  if (!ramp) throw new Error(`no source ramp for ${entry.material} ${name}`);
  return ramp;
}

// a colour is either a hex, or a named palette colour like "gray",
// "lpcr.gray" or "hair.platinum"
// when the source ramp was guessed from the pixels rather than a known palette,
// a named colour is reduced to its main tone and rebuilt on the guessed ramp
function targetRamp(material: string, color: string, source: string[], frame: Pixels, guessed = false): string[] {
  const anchor = mainTone(source, frame);
  if (color.startsWith("#")) return rampFrom(source, color, anchor);
  const named = namedRamp(material, color);
  if (guessed) return rampFrom(source, named[Math.round((named.length - 1) * 0.6)], anchor);
  return fit(named, source.length);
}

// index of the ramp colour that covers the most pixels, skipping the darkest
// entry which is usually the outline
function mainTone(ramp: string[], { data }: Pixels): number {
  if (!ramp.length) return -1;
  const rgbs = ramp.map(hexToRgb);
  const counts = new Array<number>(ramp.length).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const k = rgbs.findIndex((c) => near(c, data, i));
    if (k >= 0) counts[k]++;
  }
  const order = ramp.map((c, i) => ({ i, L: lightness(hexToRgb(c)) })).sort((a, b) => a.L - b.L);
  const darkest = order[0].i;
  let best = -1;
  counts.forEach((n, i) => {
    if (i !== darkest && (best < 0 || n > counts[best])) best = i;
  });
  return counts[best] > 0 ? best : -1;
}

function namedRamp(material: string, color: string): string[] {
  let mat = material;
  let name = color;
  const parts = color.split(".");
  if (parts.length === 2) [mat, name] = parts;
  const lookups: [string, string][] = [
    [mat, "ulpc"],
    [mat, "lpcr"],
    [material, mat],
    ["all", "lpcr"],
    ["cloth", "ulpc"],
  ];
  for (const [m, v] of lookups) {
    const ramp = loadPalette(m, v)[name];
    if (ramp) return ramp;
  }
  throw new Error(`unknown colour ${color} for ${material}`);
}

// lpcr ramps can be longer than the ulpc source, resample by lightness order
function fit(ramp: string[], length: number): string[] {
  if (ramp.length === length) return ramp;
  return Array.from({ length }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / Math.max(1, length - 1))]);
}

// for items that ship pre-coloured variant files, find the ramp the file was
// painted in so it can be swapped for a lab colour
function variantRamp(variant: string, pixels: Pixels): { ramp: string[]; guessed: boolean } {
  const name = variant.replace(/ /g, "_");
  for (const [m, v] of [
    ["cloth", "ulpc"],
    ["metal", "ulpc"],
    ["hair", "ulpc"],
    ["all", "lpcr"],
  ]) {
    const ramp = loadPalette(m, v)[name] ?? loadPalette(m, v)[variant];
    if (ramp && coverage(ramp, pixels) > 0.6) return { ramp, guessed: false };
  }
  return { ramp: dominantRamp(pixels), guessed: true };
}

function coverage(ramp: string[], { data }: Pixels): number {
  const rgbs = ramp.map(hexToRgb);
  let hit = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    total++;
    if (rgbs.some((c) => near(c, data, i))) hit++;
  }
  return total ? hit / total : 0;
}

function dominantRamp({ data }: Pixels): string[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const hex = rgbToHex([data[i], data[i + 1], data[i + 2]]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => hex)
    .sort((a, b) => lightness(hexToRgb(a)) - lightness(hexToRgb(b)));
}

function near(c: Rgb, data: Uint8Array, i: number): boolean {
  return Math.abs(c[0] - data[i]) <= 1 && Math.abs(c[1] - data[i + 1]) <= 1 && Math.abs(c[2] - data[i + 2]) <= 1;
}

// gen 3 parts use an outline plus three tones. keep the darkest entry, the main
// tone and its direct neighbours, and snap everything else to the nearest one.
function collapse(ramp: string[], anchor: number): string[] {
  if (ramp.length <= 4 || anchor < 0) return ramp;
  const order = ramp.map((c, i) => ({ i, L: lightness(hexToRgb(c)) })).sort((a, b) => a.L - b.L);
  const pos = order.findIndex((o) => o.i === anchor);
  const keep = new Set([order[0].i, anchor, order[Math.max(1, pos - 1)].i, order[Math.min(order.length - 1, pos + 1)].i]);
  const kept = order.filter((o) => keep.has(o.i));
  return ramp.map((c, i) => {
    if (keep.has(i)) return c;
    const L = lightness(hexToRgb(c));
    const nearest = kept.filter((k) => k.i !== order[0].i).reduce((a, b) => (Math.abs(b.L - L) < Math.abs(a.L - L) ? b : a));
    return ramp[nearest.i];
  });
}

function recolor(pixels: Pixels, pairs: [string[], string[]][]) {
  const maps = pairs.map(([from, to]) => ({ from: from.map(hexToRgb), to: to.map(hexToRgb) }));
  const { data } = pixels;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (const { from, to } of maps) {
      const k = from.findIndex((c) => near(c, data, i));
      if (k >= 0) {
        data[i] = to[k][0];
        data[i + 1] = to[k][1];
        data[i + 2] = to[k][2];
        break;
      }
    }
  }
}

function layerFile(base: string, variant: string | undefined): string | null {
  const dir = join(vendor, "spritesheets", base);
  const v = variant?.replace(/ /g, "_");
  const candidates = [
    v && join(dir, "walk", `${v}.png`),
    join(dir, "walk.png"),
    v && join(dir, `${v}.png`),
    v && base.endsWith("walk/") ? join(dir, `${v}.png`) : null,
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

const creditFiles = new Set<string>();

async function readFrame(file: string): Promise<Pixels> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .extract({ left: 0, top: DOWN_ROW * FRAME, width: FRAME, height: FRAME })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

function colorsFor(layer: LayerSpec): string[] {
  if (!layer.color) return [];
  return Array.isArray(layer.color) ? layer.color : [layer.color];
}

async function layerCalls(card: CardSpec, layer: LayerSpec): Promise<DrawCall[]> {
  const def = loadDef(layer.item);
  const entries = recolorEntries(def);
  const wanted = colorsFor(layer);
  const calls: DrawCall[] = [];

  for (const key of Object.keys(def).filter((k) => k.startsWith("layer_"))) {
    const ld = def[key as `layer_${number}`];
    if (!ld || ld.custom_animation) continue;
    const base = ld[card.body];
    if (typeof base !== "string") {
      if (key === "layer_1") console.warn(`  ${card.name}: ${layer.item} has no ${card.body} version`);
      continue;
    }
    const variant = layer.variant ?? def.variants?.[0];
    const file = layerFile(base, variant);
    if (!file) {
      console.warn(`  ${card.name}: no walk frame for ${layer.item} (${key}) at ${base}`);
      continue;
    }
    const frame = await readFrame(file);

    const pairs: [string[], string[]][] = [];
    entries.forEach((entry, i) => {
      let color = wanted[i];
      if (!color && i === 0 && def.match_body_color) color = card.skin;
      if (!color && entry.material === "eye" && card.eyes) color = card.eyes;
      if (!color) return;
      let from = sourceRamp(entry);
      let guessed = false;
      if (entries.length === 1 && coverage(from, frame) < 0.5) {
        from = dominantRamp(frame);
        guessed = true;
      }
      pairs.push([from, targetRamp(entry.material, color, from, frame, guessed)]);
    });
    if (!entries.length && wanted[0]) {
      const { ramp, guessed } = variantRamp(variant ?? "", frame);
      pairs.push([ramp, targetRamp("cloth", wanted[0], ramp, frame, guessed)]);
    }
    const live = pairs
      .filter(([from]) => from.length > 0)
      .map(([from, to]): [string[], string[]] => [from, card.shades === 3 ? collapse(to, mainTone(from, frame)) : to]);
    if (live.length) recolor(frame, live);
    if (layer.shift) shift(frame, layer.shift);

    creditFiles.add(file.slice(join(vendor, "spritesheets").length + 1));
    calls.push({ z: typeof ld.zPos === "number" ? ld.zPos : 100, frame, file });
  }
  return calls;
}

function shift(frame: Pixels, [dx, dy]: [number, number]) {
  const copy = frame.data.slice();
  frame.data.fill(0);
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= FRAME || sy >= FRAME) continue;
      const s = (sy * FRAME + sx) * 4;
      const d = (y * FRAME + x) * 4;
      frame.data.set(copy.subarray(s, s + 4), d);
    }
  }
}

function over(dst: Uint8Array, src: Uint8Array) {
  for (let i = 0; i < dst.length; i += 4) {
    const a = src[i + 3] / 255;
    if (a === 0) continue;
    const b = dst[i + 3] / 255;
    const out = a + b * (1 - a);
    for (let c = 0; c < 3; c++) {
      dst[i + c] = Math.round((src[i + c] * a + dst[i + c] * b * (1 - a)) / out);
    }
    dst[i + 3] = Math.round(out * 255);
  }
}

export async function composeCard(card: CardSpec): Promise<Uint8Array> {
  const layers: LayerSpec[] = [{ item: "body/body" }, ...card.layers];
  const calls = (await Promise.all(layers.map((l) => layerCalls(card, l)))).flat();
  // stable sort keeps spec order for equal z
  calls.sort((a, b) => a.z - b.z);
  const canvas = new Uint8Array(FRAME * FRAME * 4);
  for (const call of calls) over(canvas, call.frame.data);
  return card.outline === "none" ? canvas : ink(canvas, card.outline ?? "dark");
}

const INK: Rgb = [20, 12, 24];

// gen 3 sprites sit inside a near black silhouette line. "dark" pulls the
// existing lpc edge pixels toward ink, "thick" adds a new 1px ring outside.
function ink(src: Uint8Array, mode: "dark" | "thick"): Uint8Array {
  const out = src.slice();
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < FRAME && y < FRAME && src[(y * FRAME + x) * 4 + 3] > 0;
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      const i = (y * FRAME + x) * 4;
      const around = [opaque(x - 1, y), opaque(x + 1, y), opaque(x, y - 1), opaque(x, y + 1)];
      if (mode === "dark" && opaque(x, y) && around.some((o) => !o)) {
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(src[i + c] * 0.35 + INK[c] * 0.65);
        out[i + 3] = 255;
      }
      if (mode === "thick" && !opaque(x, y) && around.some(Boolean)) {
        out.set([...INK, 255], i);
      }
    }
  }
  return out;
}

// head and chest window, closer to how a gen 3 trainer reads at small size
export const BUST = { left: 14, top: 6, width: 36, height: 36 };

export async function writeCard(card: CardSpec, pixels: Uint8Array) {
  const raw = { raw: { width: FRAME, height: FRAME, channels: 4 as const } };
  await sharp(Buffer.from(pixels), raw).extract(BUST).png().toFile(join(outDir, `${card.name}-bust@1x.png`));
  await sharp(Buffer.from(pixels), raw)
    .extract(BUST)
    .resize(BUST.width * 8, BUST.height * 8, { kernel: "nearest" })
    .png()
    .toFile(join(outDir, `${card.name}-bust@8x.png`));
  await sharp(Buffer.from(pixels), raw).png().toFile(join(outDir, `${card.name}@1x.png`));
  await sharp(Buffer.from(pixels), raw)
    .resize(FRAME * 8, FRAME * 8, { kernel: "nearest" })
    .png()
    .toFile(join(outDir, `${card.name}@8x.png`));
}

type CreditRow = { file: string; notes: string; authors: string; licenses: string; urls: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) rows.push([...row, field.trim()]);
  return rows;
}

function writeCredits() {
  const rows = parseCsv(readFileSync(join(vendor, "CREDITS.csv"), "utf8")).slice(1);
  const byFile = new Map<string, CreditRow>();
  for (const [file, notes, authors, licenses, urls] of rows) {
    if (file) byFile.set(file, { file, notes, authors, licenses, urls });
  }
  const used = [...creditFiles].sort();
  const groups = new Map<string, { files: string[]; row: CreditRow }>();
  for (const file of used) {
    const row = byFile.get(file) ?? byFile.get(file.replace(/\/walk\/[^/]+\.png$/, "/walk.png"));
    if (!row) {
      console.warn(`  no credit row for ${file}`);
      continue;
    }
    const key = `${row.authors}|${row.licenses}|${row.urls}`;
    const g = groups.get(key) ?? { files: [], row };
    g.files.push(file);
    groups.set(key, g);
  }

  const lines = [
    "# credits",
    "",
    "the sprites in out/ are composed from the Universal LPC Spritesheet Character Generator art",
    "(https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).",
    "the output images are derivative works, so they carry the same licenses as the layers below",
    "(CC-BY-SA 3.0 / GPL 3.0, some layers also OGA-BY 3.0, CC-BY 3.0 or CC0). recolouring and",
    "cropping was done by lpc/src/compose.ts.",
    "",
    "generated by `bun src/compose.ts` from vendor/CREDITS.csv, one entry per group of source files.",
    "",
  ];
  for (const { files, row } of groups.values()) {
    lines.push(`## ${files.map((f) => f.replace(/\/walk(\/[^/]+)?\.png$/, "")).filter((f, i, a) => a.indexOf(f) === i).join(", ")}`);
    lines.push("");
    lines.push(`- authors: ${row.authors.split(",").join(", ")}`);
    lines.push(`- licenses: ${row.licenses.split(",").join(", ")}`);
    if (row.notes) lines.push(`- notes: ${row.notes}`);
    lines.push(`- links: ${row.urls.split(",").join(" ")}`);
    lines.push("");
  }
  writeFileSync(join(root, "CREDITS.md"), lines.join("\n"));
}

if (import.meta.main) {
  const { cards } = json<{ cards: CardSpec[] }>(cardsFile);
  const only = process.argv.slice(2);
  mkdirSync(outDir, { recursive: true });
  for (const card of cards) {
    if (only.length && !only.includes(card.name)) continue;
    const pixels = await composeCard(card);
    await writeCard(card, pixels);
    console.log(`wrote ${card.name}`);
  }
  if (!only.length && !process.env.CARDS) writeCredits();
}
