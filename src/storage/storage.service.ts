import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

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

  /**
   * Extrai o public_id e resource_type de uma URL do Cloudinary.
   *
   * Formato:
   *   https://res.cloudinary.com/<cloud_name>/<resource_type>/upload[/v<version>]/<public_id>.<ext>
   *
   * Exemplos:
   *   .../image/upload/v123/animals/abc-123.jpg  → { publicId: "animals/abc-123", resourceType: "image" }
   *   .../video/upload/v123/videos/clip.mp4      → { publicId: "videos/clip",     resourceType: "video" }
   *   .../raw/upload/docs/file.pdf               → { publicId: "docs/file",       resourceType: "raw"   }
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