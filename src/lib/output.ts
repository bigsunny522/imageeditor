export type AspectId = 'original' | '1:1' | '4:5' | '9:16' | '16:9' | '3:2';
export type FillMode = 'frame' | 'white' | 'black';
export type SizeId = 'original' | '2048' | '1080';
export type FormatId = 'jpeg' | 'png';
export interface OutputSettings { aspect: AspectId; fill: FillMode; size: SizeId; format: FormatId; }
export const DEFAULT_OUTPUT: OutputSettings = { aspect: 'original', fill: 'frame', size: 'original', format: 'jpeg' };
export const JPEG_QUALITY = 0.92;
export const outputMime = (s: OutputSettings) => s.format === 'jpeg' ? 'image/jpeg' : 'image/png';
export const outputExt = (s: OutputSettings) => s.format === 'jpeg' ? 'jpg' : 'png';

export function applyOutput(src: HTMLCanvasElement, s: OutputSettings, frameBg: string | null): HTMLCanvasElement {
  let width = src.width;
  let height = src.height;
  if (s.aspect !== 'original') {
    const [w, h] = s.aspect.split(':').map(Number);
    if (width / height < w / h) width = Math.round(height * w / h);
    else height = Math.round(width * h / w);
  }
  const scale = s.size === 'original' ? 1 : Math.min(1, Number(s.size) / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = s.fill === 'black' ? '#000000' : s.fill === 'white' ? '#ffffff' : frameBg ?? '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (width - src.width) * scale / 2, (height - src.height) * scale / 2, src.width * scale, src.height * scale);
  return canvas;
}

export function renderCompare(before: HTMLCanvasElement, after: HTMLCanvasElement): HTMLCanvasElement {
  const w = before.width;
  const h = before.height;
  const gap = Math.max(1, Math.round(Math.min(w, h) * 0.02));
  const vertical = w >= h;
  const canvas = document.createElement('canvas');
  const width = vertical ? w + gap * 2 : w * 2 + gap * 3;
  const height = vertical ? h * 2 + gap * 3 : h + gap * 2;
  const scale = Math.min(1, 2048 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);
  const fontSize = Math.max(1, Math.round(Math.min(w, h) * 0.04));
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textBaseline = 'top';
  [[before, 'BEFORE', gap, gap], [after, 'AFTER', vertical ? gap : w + gap * 2, vertical ? h + gap * 2 : gap]].forEach(([img, label, x, y]) => {
    const px = x as number;
    const py = y as number;
    ctx.drawImage(img as HTMLCanvasElement, px, py, w, h);
    const text = label as string;
    const padding = fontSize * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(px + gap, py + gap, ctx.measureText(text).width + padding * 2, fontSize + padding * 2, padding);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, px + gap + padding, py + gap + padding);
  });
  return canvas;
}
