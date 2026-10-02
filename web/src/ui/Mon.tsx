import { useEffect, useRef, useState } from "react";

// the mon from the logo, drawn live so it can look around, blink and react.
// same pixels and palette as brand/src/logo.mjs, with the eyes and mouth cut out to animate.
export type MonMood = "idle" | "watch" | "shy" | "think" | "happy" | "sad";

const PAL: Record<string, string> = { k: "#101113", L: "#b9a8ff", g: "#7b62ff", s: "#4b33c9", w: "#ffffff", b: "#b8ff3d", P: "#101113" };

// 22 x 15, eyes (cols 4-7 and 14-17, rows 6-9) and mouth (rows 11-12) are drawn separately
const HEAD = [
  "...kk............kk...",
  "..kLgk..........kgsk..",
  "..kLggk........kggsk..",
  ".kLLgggkkkkkkkkgggssk.",
  ".kLLggggggggggggggssk.",
  ".kLggggggggggggggggsk.",
  "kLLggggggggggggggggssk",
  "kLggggggggggggggggggsk",
  "kLggggggggggggggggggsk",
  "kLggggggggggggggggggsk",
  "kLgbbgggggggggggbbgssk",
  "kgggggggggggggggggggsk",
  "kgggggggggggggggggggsk",
  "kgggggggggggggggggsssk",
  "kgggggggggggggggggsssk",
];
const PAW = [".kkkkk.", "kLLggsk", "kLggggk", "kgkgkgk", ".k.k.k."];
export const MON_W = 22;
export const MON_H = 15;

type Cell = [number, number, string];
const grid = (rows: string[], ox = 0, oy = 0): Cell[] =>
  rows.flatMap((row, y) => [...row].map((c, x) => [ox + x, oy + y, c] as Cell)).filter(([, , c]) => c !== ".");

function eyes(mood: MonMood, look: { x: number; y: number }, blink: boolean): Cell[] {
  const out: Cell[] = [];
  for (const ex of [4, 14]) {
    if (mood === "happy") {
      // closed happy arcs, like ^ ^
      out.push([ex + 1, 7, "k"], [ex + 2, 7, "k"], [ex, 8, "k"], [ex + 3, 8, "k"]);
      continue;
    }
    if (blink) {
      for (let x = 0; x < 4; x++) out.push([ex + x, 8, "k"]);
      continue;
    }
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) out.push([ex + x, 6 + y, "w"]);
    // the 2x2 pupil moves one pixel each way inside the white
    const px = ex + 1 + look.x;
    const py = 7 + (mood === "sad" ? 1 : look.y);
    out.push([px, py, "k"], [px + 1, py, "k"], [px, py + 1, "k"], [px + 1, py + 1, "k"]);
    if (mood === "sad") for (let x = 0; x < 4; x++) out.push([ex + x, 6, "s"]);
  }
  return out;
}

function mouth(mood: MonMood): Cell[] {
  if (mood === "happy") return grid(["kkkk", "kPPk", ".kk."], 9, 11);
  if (mood === "sad") return grid([".kk.", "k..k"], 9, 11);
  if (mood === "think") return grid(["kk"], 11, 12);
  if (mood === "shy") return grid(["kk"], 10, 12);
  return grid(["kPPk", ".kk."], 9, 11);
}

// pupils follow the pointer, or a target the parent sets (like the caret while typing)
function usePointerLook(ref: React.RefObject<SVGSVGElement | null>, target?: { x: number; y: number }) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (target) return setLook(target);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const on = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.5);
      setLook({ x: Math.abs(dx) < 40 ? 0 : dx > 0 ? 1 : -1, y: Math.abs(dy) < 30 ? 0 : dy > 0 ? 1 : -1 });
    };
    addEventListener("pointermove", on);
    return () => removeEventListener("pointermove", on);
  }, [ref, target?.x, target?.y]);
  return look;
}

function useBlink(off: boolean) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (off) return;
    let t: number;
    const next = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        t = window.setTimeout(() => {
          setBlink(false);
          next();
        }, 130);
      }, 2200 + Math.random() * 2600);
    };
    next();
    return () => clearTimeout(t);
  }, [off]);
  return blink;
}

// head plus paws. `paws` gripping sits on the bottom edge, covering hides the eyes
export function Mon({ mood = "idle", look: target, px = 7, paws = "grip", className = "" }: { mood?: MonMood; look?: { x: number; y: number }; px?: number; paws?: "grip" | "none"; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const look = usePointerLook(ref, mood === "think" ? { x: -1, y: -1 } : target);
  const blink = useBlink(mood === "happy" || mood === "shy");
  const cover = mood === "shy";
  const cells = [...grid(HEAD), ...eyes(mood, look, blink), ...mouth(mood)];
  // gripping paws hang over the edge below the chin, covering paws come up over the eyes
  // covering paws always show, even on a head drawn without its gripping paws
  const pawCells = cover ? [...grid(PAW, 2, 6), ...grid(PAW, 13, 6)] : paws === "none" ? [] : [...grid(PAW, -1, 13), ...grid(PAW, 16, 13)];
  const minX = paws === "none" || cover ? 0 : -1;
  const w = (paws === "none" || cover ? MON_W : MON_W + 2) * px;
  const h = (paws === "none" || cover ? MON_H : MON_H + 3) * px;
  return (
    <svg ref={ref} viewBox={`${minX} 0 ${w / px} ${h / px}`} width={w} height={h} className={className} shapeRendering="crispEdges" aria-hidden>
      {cells.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width={1.04} height={1.04} fill={PAL[c]} />
      ))}
      <g className={cover ? "mon-paws-up" : ""}>
        {pawCells.map(([x, y, c], i) => (
          <rect key={`p${i}`} x={x} y={y} width={1.04} height={1.04} fill={PAL[c]} />
        ))}
      </g>
    </svg>
  );
}

// the two gripping paws on their own, to sit in front of an edge the head hides behind
export function MonPaws({ px = 7, className = "" }: { px?: number; className?: string }) {
  const cells = [...grid(PAW, 0, 0), ...grid(PAW, 17, 0)];
  return (
    <svg viewBox={`0 0 24 5`} width={24 * px} height={5 * px} className={className} shapeRendering="crispEdges" aria-hidden>
      {cells.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width={1.04} height={1.04} fill={PAL[c]} />
      ))}
    </svg>
  );
}
