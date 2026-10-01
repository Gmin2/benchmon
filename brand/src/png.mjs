// renders an svg file to a png at an exact pixel size: node src/png.mjs in.svg out.png size
import { chromium } from '/Users/mintu/coding/portfolio/ui/tools/harness/node_modules/playwright/index.mjs'
import { readFileSync } from 'fs'
const jobs = []
for (let i = 2; i + 2 < process.argv.length + 1; i += 3) jobs.push(process.argv.slice(i, i + 3))
const b = await chromium.launch()
for (const [src, out, size] of jobs) {
  const p = await b.newPage({ viewport: { width: +size, height: +size } })
  const svg = readFileSync(src, 'utf8').replace(/width="[\d.]+" height="[\d.]+"/, `width="${size}" height="${size}"`)
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`)
  await p.locator('svg').screenshot({ path: out, omitBackground: true })
  await p.close()
  console.log(out)
}
await b.close()
