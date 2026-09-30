// renderCard(card, opts) -> HTMLElement
// opts: size full|hand|tile|mini, tier 1..3, arena stat, state, facing type (for the matchup hint),
//       facedown, artBase (path to lpc/out)
const BEATS = { reasoning: "speed", speed: "cost", cost: "reasoning" }
const STATE_TAGS = {
  locked: ["lock", "over cap"],
  used: ["", "used"],
  winner: ["power", "round win"],
  loser: ["", "lost"],
  duel: ["", "<i></i> answering"],
  evolved: ["arrow", "evolved"],
}

function tierFor(card) {
  return card.rarity === "legendary" ? 3 : card.rarity === "rare" ? 2 : 1
}

function renderCard(card, opts = {}) {
  const { size = "hand", arena = null, state = null, facing = null, facedown = false, artBase = "../lpc/out" } = opts
  const tier = opts.tier ?? tierFor(card)
  const marks = window.BENCHMON.marks
  const el = document.createElement("article")
  el.className = [
    "bm-card",
    `size-${size}`,
    `rarity-${card.rarity}`,
    `type-${card.type}`,
    state && `is-${state}`,
    facedown && "is-facedown",
    facing && "show-matchup",
  ].filter(Boolean).join(" ")
  el.style.setProperty("--lab", card.colors.main === "#1a1a1a" || card.colors.main === "#0f0f0f" ? "#8a8f99" : card.colors.main)
  el.style.setProperty("--lab2", card.colors.accent)
  el.dataset.card = card.name

  const evo = card.evolution
  const stats = window.BENCHMON.statOrder
    .map(k => {
      const v = card.stats[k]
      const delta = evo && evo.stat === k ? evo.delta : 0
      const cls = ["stat", arena === k && "is-arena", delta && "has-delta", delta < 0 && "down"].filter(Boolean).join(" ")
      return `<li class="${cls}" data-stat="${k}">${icon(k)}<span class="k">${k}<span class="delta">${delta > 0 ? "+" : ""}${delta || ""}</span></span><span class="bar"><i style="--v:${v / 99}"></i></span><b>${v}</b></li>`
    })
    .join("")

  let matchup = ""
  if (facing) {
    const good = BEATS[card.type] === facing
    const bad = BEATS[facing] === card.type
    if (good || bad) matchup = `<span class="chip matchup ${good ? "good" : "bad"}">${icon("arrow")}${good ? "+10% vs " : "-10% vs "}${facing}</span>`
  }

  const tag = state && STATE_TAGS[state]
  const evoChip = evo
    ? `<span class="evo ${evo.delta < 0 ? "down" : ""}">${icon("arrow")}${evo.stat} ${evo.delta > 0 ? "+" : ""}${evo.delta} since ${evo.since}</span>`
    : `<span class="serial">#${String(card.id).padStart(3, "0")}</span>`

  el.innerHTML = `
    <div class="inner">
      <div class="side front">
        <div class="face">
          <header class="head">
            <span class="mark">${marks[card.lab] ? labMark(marks[card.lab]) : ""}</span>
            <div class="title"><h3>${card.display}</h3><span class="lab">${card.lab}</span></div>
            <span class="power" title="power, sum of the six stats">${icon("power")}${card.power}</span>
          </header>
          <div class="art">
            <img class="sprite" src="${artBase}/tiers/${card.name}-t${tier}-plain@8x.png" alt="${card.display}" draggable="false">
            <span class="chip type ${card.type}">${icon(card.type)}${card.type}</span>
            <span class="chip rarity">${icon("gem")}${card.rarity}</span>
            ${matchup}
            <div class="holo"></div>
          </div>
          <ul class="stats">${stats}</ul>
          <footer class="foot">${evoChip}<span>stats arena cc-by</span></footer>
        </div>
      </div>
      ${backHtml(opts.back)}
    </div>
    ${tag ? `<div class="overlay"><span class="tag">${tag[0] ? icon(tag[0]) : ""}${tag[1]}</span></div>` : ""}
  `
  attachTilt(el)
  return el
}

// pointer tilt plus the holo position, off for mini cards and reduced motion
function attachTilt(el) {
  if (el.classList.contains("size-mini")) return
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
  el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty("--mx", `${x * 100}%`)
    el.style.setProperty("--my", `${y * 100}%`)
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`)
    el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`)
  })
  el.addEventListener("pointerleave", () => {
    el.style.setProperty("--rx", "0deg")
    el.style.setProperty("--ry", "0deg")
    el.style.setProperty("--mx", "50%")
    el.style.setProperty("--my", "50%")
  })
}
