import { ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { GenerateUploadSignatureDto } from './dto/generate-upload-signature.dto';

const IMAGE_FORMATS = 'jpg,jpeg,png,webp,heic,heif';
const VIDEO_FORMATS = 'mp4,mov,webm,3gp,m4v';

/** Folders each role may sign uploads for, with the accepted resource types. Anything else is refused. */
export const UPLOAD_POLICY: Record<string, { roles: string[]; resourceTypes: string[] }> = {
  'monitoring/images': { roles: ['ADMIN', 'STAFF', 'TUTOR', 'USER'], resourceTypes: ['image'] },
  'monitoring/videos': { roles: ['ADMIN', 'STAFF', 'TUTOR', 'USER'], resourceTypes: ['video'] },
  'animals/photos': { roles: ['ADMIN', 'STAFF'], resourceTypes: ['image', 'auto'] },
  'events/covers': { roles: ['ADMIN', 'STAFF'], resourceTypes: ['image', 'auto'] },
  'events/gallery': { roles: ['ADMIN', 'STAFF'], resourceTypes: ['image', 'auto'] },
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(file: Express.Multer.File, folder: string, image = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: image ? 'image' : 'auto',
          // Images: Cloudinary re-validates the format and stores a size-limited, recompressed original.
          ...(image ? { allowed_formats: IMAGE_FORMATS.split(','),
            transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto' }] } : {}),
        },
        (error, result: UploadApiResponse) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadMany(files: Express.Multer.File[], folder: string, image = false): Promise<string[]> {
    return Promise.all(files.map((f) => this.upload(f, folder, image)));
  }

  /** True when the URL points to this API's Cloudinary account (or Cloudinary is not configured, e.g. tests). */
  isOwnedUrl(url: string): boolean {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud) return true;
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${cloud}/`);
    } catch { return false; }
  }

  async deleteMany(urls: string[]): Promise<void> {
    await Promise.all(urls.map((u) => this.delete(u)));
  }

  async delete(url: string): Promise<void> {
    try {
      const { publicId, resourceType } = this.extractPublicIdAndType(url);
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
      this.logger.error(`Erro ao deletar arquivo: ${err}`);
    }
  }

  /** Enforces UPLOAD_POLICY; non-staff callers also cannot choose names, overwrite files or request transformations. */
  assertUploadAllowed(dto: GenerateUploadSignatureDto, role: string) {
    const policy = dto.folder ? UPLOAD_POLICY[dto.folder] : undefined;
    const resourceType = (dto.resource_type || 'auto').toLowerCase();
    if (!policy || !policy.roles.includes(role)) {
      throw new ForbiddenException(`Pasta de upload não permitida para o seu perfil. Pastas aceitas: ${
        Object.keys(UPLOAD_POLICY).filter((f) => UPLOAD_POLICY[f].roles.includes(role)).join(', ')}`);
    }
    if (!policy.resourceTypes.includes(resourceType)) {
      throw new ForbiddenException(`resource_type '${resourceType}' não permitido para ${dto.folder}`);
    }
    const staff = role === 'ADMIN' || role === 'STAFF';
    if (!staff && (dto.public_id || dto.overwrite || dto.upload_preset || dto.eager?.length)) {
      throw new ForbiddenException('public_id, overwrite, upload_preset e eager são restritos à equipe');
    }
  }

  generateSignedUploadPayload(dto: GenerateUploadSignatureDto, role: string) {
    this.assertUploadAllowed(dto, role);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary não configurado corretamente (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign: Record<string, string | number | boolean> = {
      timestamp,
    };

    if (dto.folder) paramsToSign.folder = dto.folder;
    if (dto.public_id) paramsToSign.public_id = dto.public_id;
    if (dto.tags?.length) paramsToSign.tags = dto.tags.join(',');
    if (dto.context && Object.keys(dto.context).length) {
      paramsToSign.context = Object.entries(dto.context)
        .map(([key, value]) => `${key}=${value}`)
        .join('|');
    }
    if (dto.eager?.length) paramsToSign.eager = dto.eager.join('|');
    if (dto.upload_preset) paramsToSign.upload_preset = dto.upload_preset;
    if (typeof dto.overwrite === 'boolean') paramsToSign.overwrite = dto.overwrite;
    const resourceType = (dto.resource_type || 'auto').toLowerCase();
    // Signed, so the client cannot remove it: Cloudinary rejects files whose detected format is not listed.
    paramsToSign.allowed_formats = dto.folder?.endsWith('videos') ? VIDEO_FORMATS : IMAGE_FORMATS;

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return {
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
      resource_type: resourceType,
      upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      params: paramsToSign,
      // Campos prontos para enviar no multipart/form-data do Flutter
      form_fields: {
        ...paramsToSign,
        api_key: apiKey,
        signature,
      },
    };
  }

  /**
   * Extrai o public_id e resource_type de uma URL do Cloudinary.
   *
   * Formato:
   *   https://res.cloudinary.com/<cloud_name>/<resource_type>/upload[/v<version>]/<public_id>.<ext>
   */
  private extractPublicIdAndType(url: string): { publicId: string; resourceType: string } {
    const match = url.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) {
      throw new Error(`URL do Cloudinary inválida: ${url}`);
    }
    const resourceType = match[1];
    const publicId = match[2].replace(/\.[^/.]+$/, '');
    return { publicId, resourceType };
  }
}
