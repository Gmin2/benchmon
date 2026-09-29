import sharp from "sharp"
const { data, info } = await sharp("out/" + process.argv[2] + "@1x.png").raw().toBuffer({ resolveWithObject: true })
for (let y = 8; y < 38; y++) { let s = String(y).padStart(2) + " "; for (let x = 6; x < 34; x++) { const i = (y * info.width + x) * 4; s += data[i + 3] ? (data[i]! + data[i+1]! + data[i+2]! < 150 ? "#" : data[i]! > 200 && data[i+1]! > 150 ? "o" : "x") : "." } console.log(s) }
