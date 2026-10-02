export type Rgb = [number, number, number];

type Lab = { L: number; a: number; b: number };
type Lch = { L: number; C: number; h: number };

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
};

function rgbToOklab([r, g, b]: Rgb): Lab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinear({ L, a, b }: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function toLch(rgb: Rgb): Lch {
  const { L, a, b } = rgbToOklab(rgb);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
}

function fromLch({ L, C, h }: Lch): Rgb {
  // pull chroma in until the colour fits in srgb
  let chroma = C;
  for (let i = 0; i < 30; i++) {
    const lin = oklabToLinear({ L, a: chroma * Math.cos(h), b: chroma * Math.sin(h) });
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005) || chroma < 0.001) {
      return lin.map((v) => Math.round(Math.min(255, Math.max(0, fromLinear(v))))) as Rgb;
    }
    chroma *= 0.9;
  }
  const lin = oklabToLinear({ L, a: 0, b: 0 });
  return lin.map((v) => Math.round(Math.min(255, Math.max(0, fromLinear(v))))) as Rgb;
}

export function lightness(rgb: Rgb): number {
  return rgbToOklab(rgb).L;
}

// Builds a ramp that follows the lightness steps of `source` but sits on the
// hue and chroma of `target`. The `anchor` entry (the main fill tone, or the one
// at ~60% of the ramp) gets the target colour, darker entries drift a little
// toward blue like hand shaded pixel art does.
export function rampFrom(source: string[], target: string, anchorAt?: number): string[] {
  const src = source.map((c) => toLch(hexToRgb(c)));
  const want = toLch(hexToRgb(target));
  const Ls = src.map((c) => c.L);
  const min = Math.min(...Ls);
  const max = Math.max(...Ls);
  const pivot = min + 0.6 * (max - min);
  let anchor = 0;
  for (let i = 1; i < src.length; i++) {
    if (Math.abs(Ls[i] - pivot) < Math.abs(Ls[anchor] - pivot)) anchor = i;
  }
  if (anchorAt !== undefined && anchorAt >= 0) anchor = anchorAt;

  const floor = 0.16;
  const ceil = 0.98;
  const mid = Math.min(0.93, Math.max(0.34, want.L));
  const below = Ls[anchor] - min;
  const above = max - Ls[anchor];
  const downScale = below > 0 ? Math.min(1, (mid - floor) / below) : 1;
  const upScale = above > 0 ? Math.min(1, (ceil - mid) / above) : 1;
  const shadowHue = (265 * Math.PI) / 180;

  return src.map((c, i) => {
    const d = Ls[i] - Ls[anchor];
    const L = mid + d * (d < 0 ? downScale : upScale);
    const t = Math.min(1, Math.abs(d) / 0.4);
    let h = want.h;
    let C = want.C;
    if (d < 0) {
      const diff = Math.atan2(Math.sin(shadowHue - h), Math.cos(shadowHue - h));
      h += diff * 0.12 * t;
      C *= 1 - 0.25 * t;
    } else {
      C *= 1 - 0.45 * t;
    }
    if (i === anchor && mid === want.L) return target.toLowerCase();
    return rgbToHex(fromLch({ L, C, h }));
  });
}
