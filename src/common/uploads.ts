import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

/** Multer options for image endpoints: memory storage with hard size/count limits (413 when exceeded). */
export const imageUploadOptions = (maxFiles: number) => ({
  storage: memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES, files: maxFiles, fields: 40 },
});

/** Detects the real image type from magic bytes; the client-declared MIME type and extension are not trusted. */
export function detectImageType(buf: Buffer): string | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function assertImages(files: Express.Multer.File[] = []) {
  for (const file of files) {
    const real = detectImageType(file.buffer);
    const ext = (file.originalname?.split('.').pop() ?? '').toLowerCase();
    // Some mobile HTTP clients send application/octet-stream; the magic-byte check is what decides.
    const declaredOk = file.mimetype === real || file.mimetype === 'application/octet-stream';
    if (!real || file.size > IMAGE_MAX_BYTES || !declaredOk || !IMAGE_TYPES[real].includes(ext)) {
      throw new BadRequestException('Arquivo inválido: envie imagens JPEG, PNG ou WebP de até 8 MB, com extensão compatível com o conteúdo');
    }
  }
}
