import type { Mark } from "./generated";

// pixel icons as text grids. 1 = currentColor, 2 = the lighter tone
export const ICONS = {
  code: [".........", ".1.......", "..1......", "...1.....", "..1......", ".1.......", ".........", "....1111.", "........."],
  math: [".........", ".1111111.", "..1......", "...1.....", "....1....", "...1.....", "..1......", ".1111111.", "........."],
  reasoning: ["...111...", "..1...1..", ".1..2..1.", ".1.2...1.", "..1...1..", "...1.1...", "...111...", "...111...", "....1...."],
  speed: [".....11..", "....11...", "...11....", "..11111..", "....11...", "...11....", "..11.....", ".1.......", "........."],
  cost: ["..11111..", ".1.....1.", "1..111..1", "1..1....1", "1..111..1", "1....1..1", "1..111..1", ".1.....1.", "..11111.."],
  honesty: ["111111111", "1.......1", "1.....1.1", "1.1..1..1", "1..11...1", ".1.....1.", "..1...1..", "...1.1...", "....1...."],
  lock: ["...111...", "..1...1..", "..1...1..", ".1111111.", ".1111111.", ".111.111.", ".111.111.", ".1111111.", "........."],
  gem: ["...1...", "..121..", ".12211.", "1222111", ".12111.", "..111..", "...1..."],
  power: ["....1....", "...111...", "..11111..", ".1111111.", "111111111", ".1111111.", "..11111..", "...111...", "....1...."],
  arrow: [".........", "....1....", "...111...", "..1.1.1..", "....1....", "....1....", "....1....", ".........", "........."],
  mail: [".........", "111111111", "11.....11", "1.1...1.1", "1..1.1..1", "1...1...1", "1.......1", "111111111", "........."],
  check: [".........", ".......1.", "......11.", ".1...11..", ".11.11...", "..111....", "...1.....", ".........", "........."],
} as const;
export type IconName = keyof typeof ICONS;

type PixelProps = { grid: readonly string[]; colors?: Record<string, string>; className?: string; title?: string };

export function Pixel({ grid, colors = {}, className = "", title }: PixelProps) {
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const rects: React.ReactNode[] = [];
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const fill = colors[ch] ?? (ch === "2" ? "var(--icon-light, rgba(255,255,255,.55))" : "currentColor");
      rects.push(<rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }),
  );
  return (
    <svg className={`px ${className}`} viewBox={`0 0 ${w} ${h}`} width={w} height={h} shapeRendering="crispEdges" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {rects}
    </svg>
  );
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <Pixel grid={ICONS[name]} className={className} />;
}

// lab logo with a one pixel ink ring so it reads on any ground
export function LabMark({ mark, size = "mini", className }: { mark: Mark; size?: "mini" | "badge"; className?: string }) {
  const grid = size === "badge" ? mark.badge : mark.mini;
  const w = Math.max(...grid.map((r) => r.length)) + 2;
  const padded = [".".repeat(w), ...grid.map((r) => "." + r.padEnd(w - 2, ".") + "."), ".".repeat(w)];
  const filled = (x: number, y: number) => Boolean(padded[y]?.[x]) && padded[y]![x] !== ".";
  const inked = padded.map((row, y) =>
    [...row].map((ch, x) => (ch === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(x + dx!, y + dy!)) ? "k" : ch)).join(""),
  );
  const n = parseInt((mark.colors["1"] ?? "#ffffff").slice(1), 16);
  const dark = ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 180;
  return <Pixel grid={inked} colors={{ ...mark.colors, k: dark ? "#f4f1ea" : "#140c18" }} className={className} />;
}
