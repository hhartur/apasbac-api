import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { GenerateUploadSignatureDto } from './dto/generate-upload-signature.dto';

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

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (error, result: UploadApiResponse) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadMany(files: Express.Multer.File[], folder: string): Promise<string[]> {
    return Promise.all(files.map((f) => this.upload(f, folder)));
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

  generateSignedUploadPayload(dto: GenerateUploadSignatureDto) {
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

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
    const resourceType = (dto.resource_type || 'auto').toLowerCase();

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
