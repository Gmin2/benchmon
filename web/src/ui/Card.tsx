import { useRef, type CSSProperties } from "react";
import { ARENAS } from "../rules";
import { MARKS } from "./generated";
import { artOf, BEATS, tierOf, type Arena, type CardInfo, type CardType } from "./meta";
import { Icon, LabMark, Pixel, type IconName } from "./pixel";
import "./card.css";

export type CardState = "selected" | "locked" | "used" | "winner" | "loser" | "duel" | "evolved";
export type CardSize = "full" | "hand" | "tile" | "mini";
export type BackSide = { side?: "mine" | "theirs"; color?: string; commit?: string; label?: string };

const STATE_TAGS: Record<CardState, [IconName | null, React.ReactNode] | null> = {
  selected: null,
  locked: ["lock", "over cap"],
  used: [null, "used"],
  winner: ["power", "round win"],
  loser: [null, "lost"],
  duel: [null, <><i /> answering</>],
  evolved: ["arrow", "evolved"],
};

type Props = {
  info: CardInfo;
  size?: CardSize;
  tier?: number;
  arena?: Arena | null;
  facing?: CardType | null;
  state?: CardState | null;
  facedown?: boolean;
  back?: BackSide;
  evolution?: { stat: Arena; delta: number; since: string } | null;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
};

export function GameCard({ info, size = "hand", tier, arena = null, facing = null, state = null, facedown = false, back, evolution = null, onClick, className = "", style }: Props) {
  const ref = useRef<HTMLElement>(null);
  const t = tier ?? tierOf(info);
  const dark = info.main === "#1a1a1a" || info.main === "#0f0f0f";
  const mark = MARKS[info.lab];

  const tilt = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || size === "mini" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    for (const [k, v] of [["--rx", "0deg"], ["--ry", "0deg"], ["--mx", "50%"], ["--my", "50%"]]) el.style.setProperty(k!, v!);
  };

  const good = facing && BEATS[info.type] === facing;
  const bad = facing && BEATS[facing] === info.type;
  const tag = state ? STATE_TAGS[state] : null;

  const cls = ["bm-card", `size-${size}`, `rarity-${info.rarity}`, `type-${info.type}`, state && `is-${state}`, facedown && "is-facedown", (good || bad) && "show-matchup", onClick && "cursor-pointer", className]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={ref}
      className={cls}
      style={{ "--lab": dark ? "#8a8f99" : info.main, "--lab2": info.accent, ...style } as CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={reset}
      onClick={onClick}
      data-card={info.card.name}
    >
      <div className="inner">
        <div className="side front">
          <div className="face">
            <header className="head">
              <span className="mark">{mark && <LabMark mark={mark} />}</span>
              <div className="title">
                <h3>{info.display}</h3>
                <span className="lab">{info.lab}</span>
              </div>
              <span className="power" title="power, the sum of the six stats">
                <Icon name="power" />
                {info.power}
              </span>
            </header>
            <div className="art">
              <img className="sprite" src={artOf(info.card.name, t)} alt={info.display} draggable={false} />
              <span className={`chip type ${info.type}`}>
                <Icon name={info.type} />
                {info.type}
              </span>
              <span className="chip rarity">
                <Icon name="gem" />
                {info.rarity}
              </span>
              {(good || bad) && (
                <span className={`chip matchup ${good ? "good" : "bad"}`}>
                  <Icon name="arrow" />
                  {good ? "+10% vs " : "-10% vs "}
                  {facing}
                </span>
              )}
              <div className="holo" />
            </div>
            <ul className="stats">
              {ARENAS.map((k) => {
                const v = info.stats[k];
                const delta = evolution?.stat === k ? evolution.delta : 0;
                return (
                  <li key={k} className={["stat", arena === k && "is-arena", delta && "has-delta", delta < 0 && "down"].filter(Boolean).join(" ")}>
                    <Icon name={k} />
                    <span className="k">
                      {k}
                      <span className="delta">{delta > 0 ? `+${delta}` : delta || ""}</span>
                    </span>
                    <span className="bar">
                      <i style={{ "--v": v / 99 } as CSSProperties} />
                    </span>
                    <b>{v}</b>
                  </li>
                );
              })}
            </ul>
            <footer className="foot">
              {evolution ? (
                <span className={`evo ${evolution.delta < 0 ? "down" : ""}`}>
                  <Icon name="arrow" />
                  {evolution.stat} {evolution.delta > 0 ? "+" : ""}
                  {evolution.delta} since {evolution.since}
                </span>
              ) : (
                <span className="serial">#{String(info.card.id).padStart(3, "0")}</span>
              )}
              <span>stats arena cc-by</span>
            </footer>
          </div>
        </div>
        <CardBack {...back} />
      </div>
      {tag && (
        <div className="overlay">
          <span className="tag">
            {tag[0] && <Icon name={tag[0]} />}
            {tag[1]}
          </span>
        </div>
      )}
    </article>
  );
}

// ---------- back ----------

function crestGrid() {
  const n = 19, c = 9;
  const B = ["111111.", "11...11", "11...11", "111111.", "11...11", "11...11", "111111."];
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = "";
    for (let x = 0; x < n; x++) {
      const d = Math.abs(x - c) + Math.abs(y - c);
      const bx = x - 6, by = y - 6;
      if (bx >= 0 && bx < 7 && by >= 0 && by < 7 && B[by]![bx] === "1") row += "2";
      else if (d >= 8 && d <= 9) row += "1";
      else if (d === 7) row += "3";
      else if (d < 7) row += "4";
      else row += ".";
    }
    rows.push(row);
  }
  return rows;
}
export const CREST = crestGrid();

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("");
};

function patternUrl(color: string, alpha: number) {
  const px = [[3, 1], [2, 2], [4, 2], [3, 3], [7, 5], [0, 6]];
  const rects = px.map(([x, y]) => `<rect x='${x}' y='${y}' width='1' height='1'/>`).join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><g fill='${color}' fill-opacity='${alpha}'>${rects}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function CardBack({ side = "mine", color, commit, label }: BackSide) {
  const theirs = side === "theirs";
  const main = theirs ? "#9aa3ad" : (color ?? "#cdf462");
  const tone = theirs
    ? { bright: "#e8ecf1", deep: "#4a5058", fill: "#1d2024", edge: "#ff6b5e" }
    : { bright: mix(main, "#ffffff", 0.55), deep: mix(main, "#000000", 0.55), fill: mix(main, "#141414", 0.86), edge: main };
  const short = commit ? `${commit.slice(0, 6)}…${commit.slice(-4)}` : null;
  return (
    <div
      className={`side back back-${side}`}
      style={{ "--b-main": main, "--b-deep": tone.deep, "--b-edge": tone.edge, "--b-pattern": patternUrl(main, theirs ? 0.32 : 0.42) } as CSSProperties}
    >
      <div className="face">
        <div className="b-pattern" />
        <div className="b-ring" />
        <div className="b-top">
          <span>{label ?? (theirs ? "opponent" : "your card")}</span>
          <span>benchmon</span>
        </div>
        <div className="crest">
          <Pixel grid={CREST} colors={{ "1": main, "2": tone.bright, "3": tone.deep, "4": tone.fill }} />
        </div>
        <div className="word">BENCHMON</div>
        <div className="b-bottom">
          {short ? (
            <>
              <span className="lockdot" />
              commit {short}
            </>
          ) : (
            "face down"
          )}
        </div>
        <div className="scan" />
      </div>
    </div>
  );
}
