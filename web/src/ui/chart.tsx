import { useEffect, useMemo, useRef, useState } from "react";

export type Point = { t: number; v: number };

// monotone cubic through the points, so the line never overshoots between trades
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0]![0]},${pts[0]![1]}` : "";
  const n = pts.length;
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1]![1] - pts[i]![1]) / (pts[i + 1]![0] - pts[i]![0] || 1));
  m.push(d[0]!);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2]!);
  let path = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!;
    const h = (x1 - x0) / 3;
    path += ` C${x0 + h},${y0 + m[i]! * h} ${x1 - h},${y1 - m[i + 1]! * h} ${x1},${y1}`;
  }
  return path;
}

const PAD = { l: 64, r: 8, t: 24, b: 40 };

export function AreaChart({ data, format, height = 360, domain = [0, 1] }: { data: Point[]; format: (v: number) => string; height?: number; domain?: [number, number] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (data.length === 0) return null;
    const t0 = data[0]!.t, t1 = Math.max(data[data.length - 1]!.t, t0 + 1);
    // pad the value range a little around the data, but stay inside the domain
    const lo = Math.max(domain[0], Math.min(...data.map((p) => p.v)) - 0.08);
    const hi = Math.min(domain[1], Math.max(...data.map((p) => p.v)) + 0.08);
    const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (w - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.t - PAD.b);
    const pts = data.map((p) => [x(p.t), y(p.v)] as [number, number]);
    const line = smooth(pts);
    const area = `${line} L${pts[pts.length - 1]![0]},${height - PAD.b} L${pts[0]![0]},${height - PAD.b} Z`;
    const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (4 - i)) / 4);
    const xticks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
    return { x, y, pts, line, area, ticks, xticks };
  }, [data, w, height, domain]);

  const onMove = (e: React.PointerEvent) => {
    if (!geo) return;
    const r = box.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    geo.pts.forEach((p, i) => Math.abs(p[0] - px) < Math.abs(geo.pts[best]![0] - px) && (best = i));
    setHover(best);
  };

  // short spans need seconds, or every label reads the same minute
  const span = data.length ? data[data.length - 1]!.t - data[0]!.t : 0;
  const fmtTime = (t: number) =>
    new Date(t).toLocaleTimeString([], span < 15 * 60_000 ? { minute: "2-digit", second: "2-digit" } : { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const h = hover ?? (data.length ? data.length - 1 : null);
  const hp = h !== null && geo ? geo.pts[h] : null;

  return (
    <div ref={box} className="relative w-full select-none" style={{ height }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {geo && (
        <svg width={w} height={height} className="block">
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b8ff3d" stopOpacity=".28" />
              <stop offset="1" stopColor="#b8ff3d" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.ticks.map((v) => (
            <text key={v} x={0} y={geo.y(v) + 5} className="fill-dim text-[14px]">
              {format(v)}
            </text>
          ))}
          {geo.xticks.map((t, i) => (
            <text key={i} x={geo.x(t)} y={height - 10} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} className="fill-dim text-[14px]">
              {fmtTime(t)}
            </text>
          ))}
          <path d={geo.area} fill="url(#area)" />
          <path d={geo.line} fill="none" stroke="#b8ff3d" strokeWidth={2.5} strokeLinecap="round" />
          {hp && (
            <>
              <line x1={PAD.l} x2={w - PAD.r} y1={hp[1]} y2={hp[1]} stroke="#b8ff3d" strokeWidth={1.5} strokeDasharray="4 5" opacity={0.7} />
              <line x1={hp[0]} x2={hp[0]} y1={PAD.t} y2={height - PAD.b} stroke="#5c5e66" strokeWidth={1.5} strokeDasharray="4 5" />
              <circle cx={hp[0]} cy={hp[1]} r={7} fill="#b8ff3d" opacity={0.25} />
              <circle cx={hp[0]} cy={hp[1]} r={4.5} fill="#b8ff3d" stroke="#101113" strokeWidth={2} />
            </>
          )}
        </svg>
      )}
      {hp && h !== null && (
        <div
          className="pointer-events-none absolute rounded-2xl bg-panel-2/95 px-4 py-3 shadow-xl backdrop-blur"
          style={{ left: Math.min(Math.max(hp[0] - 80, PAD.l), w - 170), top: Math.min(hp[1] + 18, height - 110) }}
        >
          <div className="text-[13px] text-mute">{new Date(data[h]!.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          <div className="mt-1.5 text-[15px] font-semibold">{format(data[h]!.v)}</div>
        </div>
      )}
    </div>
  );
}
