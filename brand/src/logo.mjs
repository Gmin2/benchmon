// benchmon logo: celeste style wordmark (bowlby one sc, lime face, monad purple depth) with a pixel mon peeking over
// node src/logo.mjs -> logo/benchmon-logo.svg
import * as opentype from '../node_modules/opentype.js/dist/opentype.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const here = new URL('..', import.meta.url).pathname
const buf = readFileSync(`${here}fonts/BowlbyOneSC-Regular.ttf`)
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

export const C = {
  ink: '#101113',
  rim: '#f6ffd9',
  face: ['#e4ff9e', '#b8ff3d', '#78c81a'],
  side: ['#7b62ff', '#3a2696'],
  // mon palette, same family as the word
  px: { k: '#101113', L: '#e4ff9e', g: '#b8ff3d', s: '#78c81a', w: '#ffffff', b: '#a08bff', P: '#3a2696', S: '#5a42e0' },
}
// the mon in monad purple, lime cheeks
export const PURPLE = { k: '#101113', L: '#b9a8ff', g: '#7b62ff', s: '#4b33c9', w: '#ffffff', b: '#b8ff3d', P: '#101113', S: '#5a42e0' }

// the word, letter by letter so each can bounce a little like the celeste title
const word = 'BENCHMON'
const size = 200
const bounce = [0, -6, 2, -4, 4, -6, 0, -3]
const tilt = [-1.5, 1, -1, 1.5, -1, 1, -1.5, 1]
let x = 0
const glyphs = []
for (let i = 0; i < word.length; i++) {
  const g = font.charToGlyph(word[i])
  const p = g.getPath(0, 0, size)
  const bb = p.getBoundingBox()
  glyphs.push({ d: p.toPathData(2), x, y: bounce[i], r: tilt[i], cx: (bb.x1 + bb.x2) / 2, cy: (bb.y1 + bb.y2) / 2, top: bb.y1 + bounce[i], w: bb.x2 - bb.x1, x1: bb.x1 })
  x += (g.advanceWidth / font.unitsPerEm) * size - 4
}
export const WORD_W = x
const letters = glyphs.map((g) => `<path transform="translate(${g.x} ${g.y}) rotate(${g.r} ${g.cx} ${g.cy})" d="${g.d}"/>`).join('')

export function wordmark(id = 'bm') {
  const depth = 22
  let ext = ''
  for (let k = depth; k >= 1; k--) ext += `<use href="#w-${id}" y="${k}"/>`
  return `<defs>
    <g id="w-${id}">${letters}</g>
    <linearGradient id="face-${id}" x1="0" y1="-150" x2="0" y2="10" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.face[0]}"/><stop offset=".55" stop-color="${C.face[1]}"/><stop offset="1" stop-color="${C.face[2]}"/></linearGradient>
    <linearGradient id="side-${id}" x1="0" y1="-120" x2="0" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.side[0]}"/><stop offset="1" stop-color="${C.side[1]}"/></linearGradient>
    <clipPath id="clip-${id}">${letters}</clipPath>
  </defs>
  <g stroke="${C.ink}" stroke-width="26" stroke-linejoin="round" fill="${C.ink}">${ext}<use href="#w-${id}"/></g>
  <g fill="url(#side-${id})">${ext}</g>
  <use href="#w-${id}" fill="${C.rim}"/>
  <g clip-path="url(#clip-${id})"><use href="#w-${id}" y="7" fill="url(#face-${id})"/></g>
  <g clip-path="url(#clip-${id})" opacity=".28"><rect x="-20" y="-190" width="${WORD_W + 40}" height="78" fill="${C.rim}" transform="skewY(-3)"/></g>`
}

// the mon, drawn on a pixel grid. head sits behind the word, paws grip its top edge in front
export const MON = [
  '...kk............kk...',
  '..kLgk..........kgsk..',
  '..kLggk........kggsk..',
  '.kLLgggkkkkkkkkgggssk.',
  '.kLLggggggggggggggssk.',
  '.kLggggggggggggggggsk.',
  'kLLgwwwwggggggwwwwgssk',
  'kLggwkkwggggggwkkwgssk',
  'kLggwkkwggggggwkkwgssk',
  'kLggwwwwggggggwwwwgssk',
  'kLgbbgggggggggggbbgssk',
  'kggggggggkPPkggggggssk',
  'kgggggggggkkgggggggssk',
  'kgggggggggggggggggsssk',
  'kgggggggggggggggggsssk',
]
export const PAW = [
  '.kkkkk.',
  'kLLggsk',
  'kLggggk',
  'kgkgkgk',
  '.k.k.k.',
]

export function pixels(grid, px, ox = 0, oy = 0, pal = C.px) {
  let out = ''
  grid.forEach((row, y) => {
    if (row.length !== grid[0].length) throw new Error(`row ${y} is ${row.length} wide`)
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '.') continue
      out += `<rect x="${ox + x * px}" y="${oy + y * px}" width="${px + 0.6}" height="${px + 0.6}" fill="${pal[c]}"/>`
    }
  })
  return `<g shape-rendering="crispEdges">${out}</g>`
}

export function logo(pal = C.px) {
  const px = 13
  const monW = MON[0].length * px
  const cx = WORD_W / 2
  const top = Math.min(...glyphs.slice(3, 6).map((g) => g.top))
  const monX = cx - monW / 2
  // the face clears the word, the chin tucks behind its top edge
  const monY = top - 13.5 * px
  const head = pixels(MON, px, monX, monY, pal)
  const pawY = top - 2 * px
  const paws = pixels(PAW, px, monX - 1 * px, pawY, pal) + pixels(PAW, px, monX + monW - 6 * px, pawY, pal)
  return { svg: `${head}${wordmark()}${paws}`, top: monY, width: WORD_W }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pad = 40
  mkdirSync(`${here}logo`, { recursive: true })
  for (const [name, pal] of [['lime', C.px], ['purple', PURPLE]]) {
    const { svg, top } = logo(pal)
    const h = 60 - top + pad
    const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${top - pad} ${WORD_W + pad * 2} ${h}" width="${WORD_W + pad * 2}" height="${h}">${svg}</svg>`
    writeFileSync(`${here}logo/benchmon-logo-mon-${name}.svg`, doc)
  }
  console.log('wrote logo/benchmon-logo-mon-{lime,purple}.svg')
}
