import { zipSync } from 'fflate';
import type { FrameConfig, LogoConfig } from './frame';
import { analyzeAuto } from './retouch';
import type { RetouchSettings } from './retouch';
import { canvasToBlob, loadImage, renderComposite } from './render';
import { readExif } from './exif';

export interface BatchOptions {
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
    try {
      const img = await loadImage(url);
      let retouch = opts.retouch;
      if (opts.autoPerPhoto) {
        const scale = Math.min(1, 512 / Math.max(img.width, img.height));
        sample.width = Math.max(1, Math.round(img.width * scale));
        sample.height = Math.max(1, Math.round(img.height * scale));
        const ctx = sample.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, sample.width, sample.height);
        retouch = { ...retouch, adjust: analyzeAuto(ctx.getImageData(0, 0, sample.width, sample.height)) };
      }
      const frame = opts.useExifPerPhoto ? { ...opts.frame, ...await readExif(file) } : opts.frame;
      renderComposite(canvas, { img, retouch, frame, logoImg: opts.logoImg, logo: opts.logo });
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      const base = `edited_${file.name.replace(/\.[^.]+$/, '')}`;
      let name = `${base}.jpg`;
      let n = 2;
      while (names.has(name)) name = `${base}_${n++}.jpg`;
      names.add(name);
      entries[name] = new Uint8Array(await blob.arrayBuffer());
    } catch {
      failed.push(file.name);
    } finally {
      canvas.width = canvas.height = 0;
      sample.width = sample.height = 0;
      URL.revokeObjectURL(url);
    }
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return { zip: new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' }), failed };
}
