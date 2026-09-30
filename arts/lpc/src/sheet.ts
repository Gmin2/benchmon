import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dir, "..");
const outDir = process.env.OUT ? resolve(process.env.OUT) : join(root, "out");
const cardsFile = process.env.CARDS ? resolve(process.env.CARDS) : join(root, "cards.json");

const LABEL = 28;
const GAP = 12;
const COLS = 5;

type Card = { name: string };

const { cards } = JSON.parse(readFileSync(cardsFile, "utf8")) as { cards: Card[] };

function checker(w: number, h: number, size = 16): Buffer {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const light = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
      const v = light ? 246 : 232;
      buf.set([v, v, v + 2, 255], (y * w + x) * 4);
    }
  }
  return buf;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function makeSheet(suffix: string, size: number, scale: number, file: string) {
  const cell = size * scale;
  const cols = Math.min(COLS, cards.length);
  const rows = Math.ceil(cards.length / cols);
  const width = cols * cell + (cols + 1) * GAP;
  const height = rows * (cell + LABEL) + (rows + 1) * GAP;

  const layers: { input: Buffer; left: number; top: number }[] = [];
  for (const [i, card] of cards.entries()) {
    const left = GAP + (i % cols) * (cell + GAP);
    const top = GAP + Math.floor(i / cols) * (cell + LABEL + GAP);
    const sprite = await sharp(join(outDir, `${card.name}${suffix}@1x.png`))
      .resize(cell, cell, { kernel: "nearest" })
      .png()
      .toBuffer();
    layers.push({ input: sprite, left, top });
    const label = `<svg width="${cell}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">
      <text x="${cell / 2}" y="19" font-family="Menlo, monospace" font-size="15" fill="#2a2630" text-anchor="middle">${escape(card.name)}</text>
    </svg>`;
    layers.push({ input: Buffer.from(label), left, top: top + cell });
  }

  await sharp(checker(width, height), { raw: { width, height, channels: 4 } })
    .composite(layers)
    .png()
    .toFile(join(outDir, file));
  console.log(`wrote ${file} (${width}x${height})`);
}

await makeSheet("", 64, 4, "sheet.png");
await makeSheet("-bust", 36, 6, "sheet-bust.png");
