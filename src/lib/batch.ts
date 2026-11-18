import { zipSync } from 'fflate';
import type { FrameConfig, LogoConfig } from './frame';
import { analyzeAuto } from './retouch';
import type { RetouchSettings } from './retouch';
import { canvasToBlob, loadImage, renderComposite } from './render';
import { applyOutput, outputMime, outputExt, JPEG_QUALITY } from './output';
import type { OutputSettings } from './output';
import { readExif } from './exif';

export interface BatchOptions {
  output: OutputSettings;
  retouch: RetouchSettings;
  autoPerPhoto: boolean;
  frame: FrameConfig;
  useExifPerPhoto: boolean;
  logoImg: HTMLImageElement | null;
  logo: LogoConfig;
}
export interface BatchProgress { done: number; total: number; currentName: string; }

export async function runBatch(files: File[], opts: BatchOptions,
  onProgress: (p: BatchProgress) => void, signal: AbortSignal,
): Promise<{ zip: Blob; failed: string[] }> {
  const entries: Record<string, Uint8Array> = {};
  const failed: string[] = [];
  const names = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[i];
    onProgress({ done: i + 1, total: files.length, currentName: file.name });
    if (!file.type.startsWith('image/')) {
      failed.push(file.name);
      continue;
    }
    const url = URL.createObjectURL(file);
    const canvas = document.createElement('canvas');
    const sample = document.createElement('canvas');
    let img: HTMLImageElement | null = null;
    try {
      img = await loadImage(url);
      let retouch = opts.retouch;
      if (opts.autoPerPhoto) {
        const scale = Math.min(1, 512 / Math.max(img.width, img.height));
        sample.width = Math.max(1, Math.round(img.width * scale));
        sample.height = Math.max(1, Math.round(img.height * scale));
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, sample.width, sample.height);
        retouch = { ...retouch, adjust: analyzeAuto(ctx.getImageData(0, 0, sample.width, sample.height)) };
      }
      const frame = opts.useExifPerPhoto ? { ...opts.frame, ...await readExif(file) } : opts.frame;
      renderComposite(canvas, { img, retouch, frame, logoImg: opts.logoImg, logo: opts.logo });
      const result = applyOutput(canvas, opts.output, frame.style === 'none' ? null : frame.bgColor);
      let blob: Blob;
      try { blob = await canvasToBlob(result, outputMime(opts.output), JPEG_QUALITY); }
      finally { if (result !== canvas) result.width = result.height = 0; }
      const ext = outputExt(opts.output);
      const base = `edited_${file.name.replace(/\.[^.]+$/, '')}`;
      let name = `${base}.${ext}`;
      let n = 2;
      while (names.has(name)) name = `${base}_${n++}.${ext}`;
      names.add(name);
      entries[name] = new Uint8Array(await blob.arrayBuffer());
    } catch {
      failed.push(file.name);
    } finally {
      canvas.width = canvas.height = 0;
      sample.width = sample.height = 0;
      if (img) img.src = '';
      URL.revokeObjectURL(url);
    }
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return { zip: new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' }), failed };
}
