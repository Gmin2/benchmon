// card back: a pixel crest, a tiled pixel pattern and the commit it stands for
// "mine" backs take the player colour, "theirs" backs stay steel with a warm edge

// the crest is built, not hand typed: an outer diamond ring, a dotted inner ring, a B in the middle
function crestGrid() {
  const n = 19, c = 9
  const B = [
    "111111.",
    "11...11",
    "11...11",
    "111111.",
    "11...11",
    "11...11",
    "111111.",
  ]
  const rows = []
  for (let y = 0; y < n; y++) {
    let row = ""
    for (let x = 0; x < n; x++) {
      const d = Math.abs(x - c) + Math.abs(y - c)
      const bx = x - 6, by = y - 6
      if (bx >= 0 && bx < 7 && by >= 0 && by < 7 && B[by][bx] === "1") row += "2"
      else if (d >= 8 && d <= 9) row += "1"
      else if (d === 7) row += "3"
      else if (d < 7) row += "4"
      else row += "."
    }
    rows.push(row)
  }
  return rows
}

function crestSvg(tone) {
  return pixelSvg(crestGrid(), {
    "1": tone.main,
    "2": tone.bright,
    "3": tone.deep,
    "4": tone.fill,
  })
}

// 8x8 tile: a tiny diamond and a lone dot, drawn as rects so it stays crisp at any size
function patternUrl(color, alpha) {
  const px = [[3, 1], [2, 2], [4, 2], [3, 3], [7, 5], [0, 6]]
  const rects = px.map(([x, y]) => `<rect x='${x}' y='${y}' width='1' height='1'/>`).join("")
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><g fill='${color}' fill-opacity='${alpha}'>${rects}</g></svg>`
  // unquoted and fully escaped, it lands inside a double quoted style attribute
  const data = encodeURIComponent(svg).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29")
  return `url(data:image/svg+xml,${data})`
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)))
  return "#" + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, "0")).join("")
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
  return "#" + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, "0")).join("")
}

function backTone(side, color) {
  if (side === "theirs") return { main: "#9aa3ad", bright: "#e8ecf1", deep: "#4a5058", fill: "#1d2024", edge: "#ff6b5e", pattern: "#9aa3ad" }
  const main = color ?? "#cdf462"
  return { main, bright: mix(main, "#ffffff", 0.55), deep: shade(main, 0.45), fill: mix(main, "#141414", 0.86), edge: main, pattern: main }
}

// back markup; side mine|theirs, color = player colour, commit = hash shown along the bottom
function backHtml({ side = "mine", color, commit, label } = {}) {
  const tone = backTone(side, color)
  const short = commit ? `${commit.slice(0, 6)}…${commit.slice(-4)}` : null
  return `
    <div class="side back back-${side}" style="--b-main:${tone.main};--b-deep:${tone.deep};--b-edge:${tone.edge};--b-pattern:${patternUrl(tone.pattern, side === "theirs" ? 0.32 : 0.42)}">
      <div class="face">
        <div class="b-pattern"></div>
        <div class="b-ring"></div>
        <div class="b-top"><span>${label ?? (side === "theirs" ? "opponent" : "your card")}</span><span>benchmon</span></div>
        <div class="crest">${crestSvg(tone)}</div>
        <div class="word">BENCHMON</div>
        <div class="b-bottom">${short ? `<span class="lockdot"></span>commit ${short}` : "face down"}</div>
        <div class="scan"></div>
      </div>
    </div>`
}

// flips a card face down with the lock-in sweep
function lockIn(el) {
  el.classList.remove("is-locking")
  void el.offsetWidth
  el.classList.add("is-facedown", "is-locking")
  setTimeout(() => el.classList.remove("is-locking"), 1400)
}
