import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigAppService } from '../config-app/config-app.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import * as QRCode from 'qrcode';

@Injectable()
export class AnimalsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private configService: ConfigAppService,
  ) {}

  async create(dto: CreateAnimalDto, photos: Express.Multer.File[]) {
    if (photos.length > 3) throw new BadRequestException('Máximo de 3 fotos permitido');

    if (dto.adoptedById) {
      const adopter = await this.prisma.user.findUnique({ where: { id: dto.adoptedById } });
      if (!adopter) throw new NotFoundException('Usuário adotante não encontrado');
    }

    const photoUrls = photos.length > 0 ? await this.storage.uploadMany(photos, 'animals/photos') : [];

    const animal = await this.prisma.animal.create({
      data: {
        name: dto.name, description: dto.description, breed: dto.breed,
        sex: dto.sex, size: dto.size, vaccines: dto.vaccines,
        temperament: dto.temperament, escapeTendency: dto.escapeTendency,
        isAdopted: dto?.isAdopted || false,
        adoptedById: dto?.adoptedById || undefined,
        photos: photoUrls, // <-- aqui
      },
      include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } },
    });

    const qrCodeDataUrl = await this.generateQrCode(animal.uuid);
    const qrFile: Express.Multer.File = {
      fieldname: 'qrcode', originalname: `qr-${animal.uuid}.png`,
      encoding: '7bit', mimetype: 'image/png',
      buffer: Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
      size: 0, stream: null, destination: '', filename: '', path: '',
    };
    const qrUrl = await this.storage.upload(qrFile, 'animals/qrcodes');

    return this.prisma.animal.update({
      where: { id: animal.id },
      data: { qrCodeUrl: qrUrl },
      include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
  }

  private async generateQrCode(uuid: string): Promise<string> {
    const url = `${process.env.FRONTEND_URL}/animals/${uuid}`;
    return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#c0392b', light: '#ffffff' } });
  }

  async findAll(page = 1, limit = 20, isAdopted?: boolean) {
    const skip = (page - 1) * limit;
    const where = isAdopted !== undefined ? { isAdopted } : {};
    const [data, total] = await Promise.all([
      this.prisma.animal.findMany({ skip, take: limit, where, orderBy: { createdAt: 'desc' }, include: { adoptedBy: { select: { id: true, fullName: true } } } }),
      this.prisma.animal.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const animal = await this.prisma.animal.findUnique({ where: { id }, include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } } });
    if (!animal) throw new NotFoundException('Animal não encontrado');
    return animal;
  }

  async findByUuid(uuid: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { uuid },
      include: { adoptedBy: { select: { fullName: true, phone: true, email: true } } },
    });
    if (!animal) throw new NotFoundException('Animal não encontrado');

    // Load APASBAC contact info from configurable DB settings
    const [phone, email] = await Promise.all([
      this.configService.findOne('apasbac_phone').catch(() => null),
      this.configService.findOne('apasbac_email').catch(() => null),
    ]);

    return {
      id: animal.id,
      name: animal.name,
      description: animal.description,
      breed: animal.breed,
      sex: animal.sex,
      size: animal.size,
      vaccines: animal.vaccines,
      temperament: animal.temperament,
      escapeTendency: animal.escapeTendency,
      isAdopted: animal.isAdopted,
      photos: animal.photos,
      apasbac: {
        phone: phone?.value ?? null,
        email: email?.value ?? null,
      },
      tutor: animal.isAdopted && animal.adoptedBy
        ? { name: animal.adoptedBy.fullName, phone: animal.adoptedBy.phone, email: animal.adoptedBy.email }
        : null,
    };
  }

  async findPublicById(id: number) {
    const animal = await this.prisma.animal.findUnique({ where: { id } });
    if (!animal) throw new NotFoundException('Animal não encontrado');
    return {
      name: animal.name, description: animal.description, breed: animal.breed,
      sex: animal.sex, size: animal.size, vaccines: animal.vaccines,
      temperament: animal.temperament, escapeTendency: animal.escapeTendency,
      isAdopted: animal.isAdopted, photos: animal.photos,
    };
  }

  async update(id: number, dto: UpdateAnimalDto, newPhotos?: Express.Multer.File[]) {
    const animal = await this.findOne(id);
    if (dto.adoptedById) {
      const adopter = await this.prisma.user.findUnique({ where: { id: dto.adoptedById } });
      if (!adopter) throw new NotFoundException('Usuário adotante não encontrado');
    }
    let photos = animal.photos;
    if (newPhotos && newPhotos.length > 0) {
      if (newPhotos.length > 3) throw new BadRequestException('Máximo de 3 fotos');
      await this.storage.deleteMany(animal.photos);
      photos = await this.storage.uploadMany(newPhotos, 'animals/photos');
    }
    return this.prisma.animal.update({
      where: { id }, data: { ...dto, photos },
      include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
  }

  async remove(id: number) {
    const animal = await this.findOne(id);
    await this.storage.deleteMany(animal.photos);
    if (animal.qrCodeUrl) await this.storage.delete(animal.qrCodeUrl);
    await this.prisma.animal.delete({ where: { id } });
    return { message: 'Animal removido com sucesso' };
  }

  async regenerateQrCode(id: number) {
    const animal = await this.findOne(id);
    const qrCodeDataUrl = await this.generateQrCode(animal.uuid);
    const qrFile: Express.Multer.File = {
      fieldname: 'qrcode', originalname: `qr-${animal.uuid}.png`,
      encoding: '7bit', mimetype: 'image/png',
      buffer: Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
      size: 0, stream: null, destination: '', filename: '', path: '',
    };
    if (animal.qrCodeUrl) await this.storage.delete(animal.qrCodeUrl);
    const qrUrl = await this.storage.upload(qrFile, 'animals/qrcodes');
    const updated = await this.prisma.animal.update({ where: { id }, data: { qrCodeUrl: qrUrl } });
    return { qrCodeUrl: updated.qrCodeUrl };
  }

  async linkAdopter(animalId: number, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.update({ where: { id: userId }, data: { role: 'TUTOR' } });
    return this.prisma.animal.update({
      where: { id: animalId },
      data: { isAdopted: true, adoptedById: userId },
      include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
  }
}
