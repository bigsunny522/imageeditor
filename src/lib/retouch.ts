export interface Adjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  temperature: number;
  tint: number;
  blackPoint: number;
  whitePoint: number;
}
export type PresetId = 'none' | 'natural' | 'vivid' | 'film' | 'mono' | 'cinema' | 'cool';
export interface PresetDef {
  id: PresetId;
  label: string;
  adjust: Partial<Omit<Adjustments, 'blackPoint' | 'whitePoint'>>;
  fade?: number;
  mono?: boolean;
  splitShadow?: [number, number, number];
  splitHighlight?: [number, number, number];
}
export interface RetouchSettings {
  adjust: Adjustments;
  preset: PresetId;
  presetStrength: number;
}
export const DEFAULT_ADJUST: Adjustments = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, saturation: 0,
  temperature: 0, tint: 0, blackPoint: 0, whitePoint: 1,
};
export const DEFAULT_RETOUCH: RetouchSettings = {
  adjust: DEFAULT_ADJUST, preset: 'none', presetStrength: 100,
};
export const PRESETS: PresetDef[] = [
  { id: 'none', label: 'なし', adjust: {} },
  { id: 'natural', label: 'ナチュラル', adjust: { contrast: 8, saturation: 8, shadows: 10 } },
  { id: 'vivid', label: '鮮やか', adjust: { contrast: 18, saturation: 35, highlights: -10 } },
  {
    id: 'film', label: 'フィルム風',
    adjust: { contrast: -10, saturation: -15, temperature: 12 },
    fade: 0.08, splitShadow: [0, 0.02, 0.03], splitHighlight: [0.03, 0.015, 0],
  },
  { id: 'mono', label: 'モノクロ', adjust: { contrast: 20 }, mono: true },
  {
    id: 'cinema', label: 'シネマ', adjust: { contrast: 12, saturation: -10 },
    splitShadow: [-0.02, 0.01, 0.04], splitHighlight: [0.04, 0.02, -0.02],
  },
  { id: 'cool', label: 'クール', adjust: { temperature: -18, saturation: -5, highlights: -8 } },
];
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export function isDefaultRetouch(s: RetouchSettings): boolean {
  return (s.preset === 'none' || s.presetStrength === 0) &&
    (Object.keys(DEFAULT_ADJUST) as (keyof Adjustments)[]).every(k => s.adjust[k] === DEFAULT_ADJUST[k]);
}
export function applyRetouch(data: ImageData, s: RetouchSettings): void {
  if (isDefaultRetouch(s)) return;
  const preset = PRESETS.find(p => p.id === s.preset)!;
  const k = s.presetStrength / 100;
  const value = (key: keyof Omit<Adjustments, 'blackPoint' | 'whitePoint'>) => s.adjust[key] + (preset.adjust[key] ?? 0) * k;
  const fade = (preset.fade ?? 0) * k;
  const mono = preset.mono ? k : 0;
  const redFactor = 1 + 0.2 * value('temperature') / 100;
  const blueFactor = 1 - 0.2 * value('temperature') / 100;
  const greenFactor = 1 - 0.15 * value('tint') / 100;
  const range = s.adjust.whitePoint - s.adjust.blackPoint;
  const exposure = 2 ** (value('exposure') / 100);
  const contrast = 1 + value('contrast') / 100;
  const shadows = value('shadows') / 100 * 0.3;
  const highlights = value('highlights') / 100 * 0.3;
  const saturation = 1 + value('saturation') / 100;
  const shadow = (preset.splitShadow ?? [0, 0, 0]).map(v => v * k);
  const highlight = (preset.splitHighlight ?? [0, 0, 0]).map(v => v * k);
  for (let i = 0; i < data.data.length; i += 4) {
    let r = data.data[i] / 255 * redFactor;
    let g = data.data[i + 1] / 255 * greenFactor;
    let b = data.data[i + 2] / 255 * blueFactor;
    r = clamp(((r - s.adjust.blackPoint) / range * exposure - 0.5) * contrast + 0.5);
    g = clamp(((g - s.adjust.blackPoint) / range * exposure - 0.5) * contrast + 0.5);
    b = clamp(((b - s.adjust.blackPoint) / range * exposure - 0.5) * contrast + 0.5);
    let l = luminance(r, g, b);
    const nl = l + shadows * (1 - l) ** 3 + highlights * l ** 3;
    if (l > 0.001) {
      const ratio = nl / l;
      r *= ratio; g *= ratio; b *= ratio;
    }
    l = luminance(r, g, b);
    r = l + (r - l) * saturation;
    g = l + (g - l) * saturation;
    b = l + (b - l) * saturation;
    l = luminance(r, g, b);
    r = (r + shadow[0] * (1 - l) + highlight[0] * l) * (1 - fade) + fade;
    g = (g + shadow[1] * (1 - l) + highlight[1] * l) * (1 - fade) + fade;
    b = (b + shadow[2] * (1 - l) + highlight[2] * l) * (1 - fade) + fade;
    l = luminance(r, g, b);
    data.data[i] = Math.round(clamp(r + (l - r) * mono) * 255);
    data.data[i + 1] = Math.round(clamp(g + (l - g) * mono) * 255);
    data.data[i + 2] = Math.round(clamp(b + (l - b) * mono) * 255);
  }
}
export function analyzeAuto(data: ImageData): Adjustments {
  const hist = new Array<number>(256).fill(0);
  let sum = 0, squares = 0, r = 0, g = 0, b = 0, count = 0;
  const n = data.data.length / 4;
  for (let i = 0; i < data.data.length; i += 4) {
    const rr = data.data[i] / 255, gg = data.data[i + 1] / 255, bb = data.data[i + 2] / 255;
    const l = luminance(rr, gg, bb);
    hist[Math.min(255, Math.floor(l * 255))]++;
    sum += l;
    squares += l * l;
    if (l >= 0.15 && l <= 0.9) { r += rr; g += gg; b += bb; count++; }
  }
  const percentile = (p: number) => {
    let cumulative = 0;
    for (let i = 0; i < 256; i++) {
      cumulative += hist[i];
      if (cumulative >= n * p) return i / 255;
    }
    return 1;
  };
  const blackPoint = clamp(percentile(0.005), 0, 0.1);
  const whitePoint = clamp(percentile(0.995), 0.85, 1);
  let levelSum = 0;
  for (let i = 0; i < data.data.length; i += 4) {
    const l = luminance(data.data[i] / 255, data.data[i + 1] / 255, data.data[i + 2] / 255);
    levelSum += clamp((l - blackPoint) / (whitePoint - blackPoint));
  }
  const avg = (r + g + b) / 3;
  return {
    blackPoint, whitePoint,
    temperature: count && avg ? clamp(Math.round(125 * (b - r) / avg), -50, 50) : 0,
    tint: count && avg ? clamp(Math.round(333 * (g - (r + b) / 2) / avg), -40, 40) : 0,
    exposure: clamp(Math.round(60 * Math.log2(clamp(levelSum / n, 0.35, 0.65) / Math.max(levelSum / n, 0.01))), -30, 60),
    contrast: Math.sqrt(Math.max(0, squares / n - (sum / n) ** 2)) < 0.18 ? 15 : 0,
    shadows: percentile(0.1) < 0.08 ? 20 : 0,
    highlights: percentile(0.95) > 0.97 ? -20 : 0,
    saturation: 0,
  };
}
