import { fmtExp, fmtF } from './frame';
import type { FrameConfig } from './frame';

export type ExifFields = Partial<Pick<FrameConfig, 'cameraModel' | 'lensName' | 'shootInfo' | 'shootDate'>>;

export async function readExif(file: File): Promise<ExifFields> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/tiff') return {};
  try {
    const exifr = (await import('exifr')).default;
    const exif = await exifr.parse(file, {
      pick: ['Make', 'Model', 'LensModel', 'Lens', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal'],
    });
    if (!exif) return {};
    const result: ExifFields = {};
    const make = String(exif.Make || '').trim();
    const model = String(exif.Model || '').trim();
    const camera = make && model && model.toLowerCase().startsWith(make.toLowerCase())
      ? model : [make, model].filter(Boolean).join(' ').trim();
    if (camera) result.cameraModel = camera;
    const lens = exif.LensModel || exif.Lens;
    if (lens) result.lensName = String(lens).trim();
    const parts = [exif.FNumber ? fmtF(exif.FNumber) : '',
      exif.ExposureTime ? fmtExp(exif.ExposureTime) : '', exif.ISO ? `ISO ${exif.ISO}` : ''].filter(Boolean);
    if (parts.length) result.shootInfo = parts.join('  ');
    if (exif.DateTimeOriginal) {
      const d = new Date(exif.DateTimeOriginal);
      if (!isNaN(d.getTime())) {
        result.shootDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return result;
  } catch {
    return {};
  }
}
