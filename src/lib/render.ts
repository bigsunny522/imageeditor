import { getPad, renderFrame } from './frame';
import type { FrameConfig, LogoConfig } from './frame';
import { applyRetouch, isDefaultRetouch } from './retouch';
import type { RetouchSettings } from './retouch';

export interface RenderInput {
  img: CanvasImageSource & { width: number; height: number };
  retouch: RetouchSettings;
  frame: FrameConfig;
  logoImg: HTMLImageElement | null;
  logo: LogoConfig;
  maxEdge?: number;
}

export function renderComposite(target: HTMLCanvasElement, input: RenderInput): void {
  const { img, retouch, frame, logoImg, logo, maxEdge } = input;
  const scale = maxEdge ? Math.min(1, maxEdge / Math.max(img.width, img.height)) : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  try {
    const ctx = work.getContext('2d', { willReadFrequently: true });
    const out = target.getContext('2d');
    if (!ctx || !out) return;
    ctx.drawImage(img, 0, 0, w, h);
    if (!isDefaultRetouch(retouch)) {
      for (let y = 0; y < h; y += 256) {
        const data = ctx.getImageData(0, y, w, Math.min(256, h - y));
        applyRetouch(data, retouch);
        ctx.putImageData(data, 0, y);
      }
    }
    const pad = getPad(w, h, frame.style, frame.pos);
    const totalW = w + pad.left + pad.right;
    const totalH = h + pad.top + pad.bottom;
    target.width = totalW;
    target.height = totalH;
    out.fillStyle = frame.style === 'none' ? '#000' : frame.bgColor;
    out.fillRect(0, 0, totalW, totalH);
    out.drawImage(work, pad.left, pad.top);
    renderFrame(out, pad.left, pad.top, w, h, totalW, totalH, pad, frame, logoImg, logo);
  } finally {
    work.width = work.height = 0;
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadScaled(file: Blob, maxEdge: number): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement | null = null;
  try {
    img = await loadImage(url);
    const { width, height } = img;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, width, height };
  } finally {
    if (img) img.src = '';
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas encoding failed')), type, quality);
  });
}
