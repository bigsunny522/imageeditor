import { getPad, renderFrame } from './frame';
import type { FrameConfig, LogoConfig } from './frame';
import { applyRetouch } from './retouch';
import type { RetouchSettings } from './retouch';

export interface RenderInput {
  img: HTMLImageElement;
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
    const ctx = work.getContext('2d');
    const out = target.getContext('2d');
    if (!ctx || !out) return;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    applyRetouch(data, retouch);
    ctx.putImageData(data, 0, 0);
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

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas encoding failed')), type, quality);
  });
}
