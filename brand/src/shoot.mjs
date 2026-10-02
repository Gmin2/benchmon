import { chromium } from '/Users/mintu/coding/portfolio/ui/tools/harness/node_modules/playwright/index.mjs'
import { readFileSync } from 'fs'
const [src, out, bg = '#1A1A1A'] = process.argv.slice(2)
const svg = readFileSync(src, 'utf8')
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 })
await p.setContent(`<body style="margin:0;background:${bg};display:inline-block">${svg}</body>`)
await p.locator('svg').first().screenshot({ path: out, omitBackground: false })
await b.close(); console.log('shot', out)
