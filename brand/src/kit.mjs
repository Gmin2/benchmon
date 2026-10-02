// renders the brand kit into kit/: x profile and header, logo pngs, the square logo for the portal, og image
// node src/kit.mjs
import { chromium } from '/Users/mintu/coding/portfolio/ui/tools/harness/node_modules/playwright/index.mjs'
import { copyFileSync, mkdirSync, readFileSync } from 'fs'

const here = new URL('..', import.meta.url).pathname
const out = `${here}kit`
mkdirSync(out, { recursive: true })
const b = await chromium.launch()

async function page(file, w, h, name, scale = 1) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale })
  await p.goto(`file://${here}${file}`)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${name}`, clip: { x: 0, y: 0, width: w, height: h } })
  await p.close()
  console.log(name)
}

// an svg on a plain or transparent ground, scaled to a width
async function svg(file, width, name, bg = null, pad = 0) {
  const src = readFileSync(`${here}${file}`, 'utf8')
  const vb = src.match(/viewBox="([\d.\s-]+)"/)[1].split(/\s+/).map(Number)
  const height = Math.round((width * vb[3]) / vb[2])
  const W = width + pad * 2, H = height + pad * 2
  const p = await b.newPage({ viewport: { width: W, height: H } })
  const sized = src.replace(/width="[\d.]+" height="[\d.]+"/, `width="${width}" height="${height}"`)
  await p.setContent(`<body style="margin:0;background:${bg ?? 'transparent'}"><div style="padding:${pad}px;line-height:0">${sized}</div></body>`)
  await p.screenshot({ path: `${out}/${name}`, omitBackground: !bg, clip: { x: 0, y: 0, width: W, height: H } })
  await p.close()
  console.log(name)
}

await page('kit/src/x-avatar.html', 400, 400, 'x-profile-400.png')
await page('kit/src/x-avatar.html', 400, 400, 'x-profile-800.png', 2)
await page('kit/src/x-header.html', 1500, 500, 'x-header-1500x500.png')
await page('kit/src/x-header.html', 1500, 500, 'x-header-3000x1000.png', 2)

await svg('logo/benchmon-logo-mon-purple.svg', 2000, 'logo-wordmark-transparent.png')
await svg('logo/benchmon-logo-mon-purple.svg', 1000, 'logo-wordmark-transparent-1000.png')
await svg('logo/benchmon-logo-mon-purple.svg', 1600, 'logo-wordmark-on-dark.png', '#101113', 120)
await svg('logo/benchmon-logo-mon-purple.svg', 1600, 'logo-wordmark-on-light.png', '#f4f4f0', 120)
await svg('logo/icons/favicon.svg', 1024, 'logo-mon-mark-transparent.png')
// square logo for the hackathon portal and app stores
await page('kit/src/x-avatar.html', 400, 400, 'logo-square-1200.png', 3)

copyFileSync(`${here}og/og.png`, `${out}/og-image-1200x630.png`)
copyFileSync(`${here}logo/benchmon-logo-mon-purple.svg`, `${out}/logo-wordmark.svg`)
copyFileSync(`${here}logo/icons/favicon.svg`, `${out}/logo-mon-mark.svg`)
await b.close()
