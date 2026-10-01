// favicon and app icons from the mon's head. node src/icons.mjs -> logo/icons/
import { mkdirSync, writeFileSync } from 'fs'
import { MON, PAW, PURPLE, pixels } from './logo.mjs'

const here = new URL('..', import.meta.url).pathname
const out = `${here}logo/icons`
mkdirSync(out, { recursive: true })

// drawn for 16px: one grid cell is one screen pixel at 16, two at 32, three at 48
export const TINY = [
  '..kk........kk..',
  '.kLgk......kgsk.',
  '.kLggkkkkkkggsk.',
  'kLLggggggggggssk',
  'kLggggggggggggsk',
  'kLgwwggggggwwgsk',
  'kLgwkggggggwkgsk',
  'kLgwkggggggwkgsk',
  'kLbbgggkkgggbbsk',
  'kggggggggggggssk',
  'kggggggggggggssk',
  'kgggggggggggsssk',
  '.kgggggggggsssk.',
  '..kkkkkkkkkkkk..',
]

const svg = (w, h, body, bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg}${body}</svg>`

// browser tab: the tiny head, transparent, centred on a 16 grid
writeFileSync(`${out}/favicon.svg`, svg(16, 16, pixels(TINY, 1, 0, 1, PURPLE)))

// app icons: the logo in miniature, the mon peeking over a lime slab with its paws on the edge
const head = MON.slice(0, 13)
const cols = head[0].length
for (const size of [180, 192, 512]) {
  const px = Math.floor((size * 0.56) / cols)
  const w = cols * px
  const x0 = Math.round((size - w) / 2)
  const slabY = Math.round(size * 0.64)
  const y0 = slabY - 11.5 * px
  const slab = `<rect x="${-px}" y="${slabY}" width="${size + 2 * px}" height="${size}" fill="#101113"/>
    <rect x="${-px}" y="${slabY + px * 0.9}" width="${size + 2 * px}" height="${size}" fill="#b8ff3d"/>
    <rect x="${-px}" y="${slabY + px * 0.9}" width="${size + 2 * px}" height="${px}" fill="#f6ffd9"/>
    <rect x="${-px}" y="${size - size * 0.12}" width="${size + 2 * px}" height="${size}" fill="#4b33c9"/>`
  const paws = pixels(PAW, px, x0 - px, slabY - 1.6 * px, PURPLE) + pixels(PAW, px, x0 + w - 6 * px, slabY - 1.6 * px, PURPLE)
  const bg = `<rect width="${size}" height="${size}" fill="#1b1c1f"/>`
  writeFileSync(`${out}/icon-${size}.svg`, svg(size, size, pixels(head, px, x0, y0, PURPLE) + slab + paws, bg))
}
console.log('wrote', out)
