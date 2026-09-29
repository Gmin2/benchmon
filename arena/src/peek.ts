import sharp from "sharp"
const files = process.argv.slice(3)
const w = 768, h = 432
await sharp({ create: { width: w * 2, height: h * 3, channels: 4, background: "#111" } })
  .composite(await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(w, h, { kernel: "nearest" }).toBuffer(), left: (i % 2) * w, top: Math.floor(i / 2) * h }))))
  .png().toFile(process.argv[2])
