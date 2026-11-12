import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigAppService } from '../config-app/config-app.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import * as QRCode from 'qrcode';
import { assertImages, imageSource } from '../common/uploads';

@Injectable()
export class AnimalsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private configService: ConfigAppService,
  ) {}

  async create(dto: CreateAnimalDto, photos: Express.Multer.File[]) {
    const source = imageSource(dto.photoUrls, photos, 'photoUrls', 'photos');
    if (photos.length > 3) throw new BadRequestException('Máximo de 3 fotos permitido');
    assertImages(photos);

    if (dto.adoptedById) {
      const adopter = await this.prisma.user.findUnique({ where: { id: dto.adoptedById } });
      if (!adopter) throw new NotFoundException('Usuário adotante não encontrado');
    }

    let photoUrls: string[] = [];

    // URLs informadas (upload direto ou links) OU arquivos enviados para a API subir no storage
    if (source === 'url') photoUrls = dto.photoUrls;
    else if (source === 'file') photoUrls = await this.storage.uploadMany(photos, 'animals/photos', true);

    const animal = await this.prisma.animal.create({
      data: {
        name: dto.name, description: dto.description,
        // species é opcional no contrato (compatível com clientes antigos); default igual ao backfill da migration.
        species: dto.species?.trim() || 'Não informada', breed: dto.breed,
        sex: dto.sex, size: dto.size, vaccines: dto.vaccines,
        temperament: dto.temperament, escapeTendency: dto.escapeTendency,
        isAdopted: dto?.isAdopted || false,
        adoptedById: dto?.adoptedById || undefined,
        photos: photoUrls,
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

  async findAll(page = 1, limit = 20, isAdopted?: boolean, viewer?: { id: string; role: string } | null) {
    const skip = (page - 1) * limit;
    const where = isAdopted !== undefined ? { isAdopted } : {};
    const [data, total] = await Promise.all([
      this.prisma.animal.findMany({ skip, take: limit, where, orderBy: { createdAt: 'desc' }, include: { adoptedBy: { select: { id: true, fullName: true } } } }),
      this.prisma.animal.count({ where }),
    ]);
    return { data: data.map((a) => this.forViewer(a, viewer)), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // The QR uuid unlocks the tutor's contact data (findByUuid), so it is only listed for staff and the animal's own tutor.
  private forViewer<T extends { adoptedById: string | null }>(animal: T, viewer?: { id: string; role: string } | null) {
    if (viewer && (viewer.role === 'ADMIN' || viewer.role === 'STAFF' || animal.adoptedById === viewer.id)) return animal;
    const { uuid, qrCodeUrl, ...rest } = animal as any;
    return { ...rest, adoptedById: null, adoptedBy: null };
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

    const [phone, email] = await Promise.all([
      this.configService.findOne('apasbac_phone').catch(() => null),
      this.configService.findOne('apasbac_email').catch(() => null),
    ]);

    return {
      id: animal.id,
      name: animal.name,
      description: animal.description,
      species: animal.species,
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
      name: animal.name, description: animal.description, species: animal.species, breed: animal.breed,
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
    const { photoUrls, ...data } = dto;
    const source = imageSource(photoUrls, newPhotos ?? [], 'photoUrls', 'photos');
    let photos = animal.photos;
    if (source === 'url') photos = photoUrls;
    if (source === 'file') {
      if (newPhotos.length > 3) throw new BadRequestException('Máximo de 3 fotos');
      assertImages(newPhotos);
      // Upload first: if it fails, the current photos are kept.
      photos = await this.storage.uploadMany(newPhotos, 'animals/photos', true);
    }
    const updated = await this.prisma.animal.update({
      where: { id }, data: { ...data, photos },
      include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
    // Replaced photos are removed from storage only after the animal points to the new ones.
    await this.storage.deleteMany(animal.photos.filter((u) => !photos.includes(u)));
    return updated;
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
    await this.findOne(animalId);
    // Only promotes USER: an ADMIN/STAFF who adopts keeps their role.
    if (user.role === 'USER') await this.prisma.user.update({ where: { id: userId }, data: { role: 'TUTOR' } });
    return this.prisma.animal.update({
      where: { id: animalId },
      data: { isAdopted: true, adoptedById: userId },
      include: { adoptedBy: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
  }
}