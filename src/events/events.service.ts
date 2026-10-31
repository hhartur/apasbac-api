import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { assertImages, imageSource } from '../common/uploads';
import {
  AdminEventQueryDto, CreateEventCategoryDto, CreateEventDto, EventQueryDto, EventStatus, MAX_GALLERY,
  PUBLIC_EVENT_STATUSES, PublicEventQueryDto, UpdateEventCategoryDto, UpdateEventDto,
} from './dto/event.dto';

export function slugify(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '') || 'evento';
}

const CATEGORY = { select: { id: true, name: true, slug: true } };

export interface EventFiles { cover?: Express.Multer.File[]; gallery?: Express.Multer.File[] }

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  // ── Queries ────────────────────────────────────────────────────────────────

  private where(q: EventQueryDto, statuses: EventStatus[] | undefined): Prisma.EventWhereInput {
    const now = new Date();
    const and: Prisma.EventWhereInput[] = [];
    if (q.when === 'upcoming') and.push({ OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] });
    if (q.when === 'past') and.push({ OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }] });
    if (q.q) and.push({ OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { summary: { contains: q.q, mode: 'insensitive' } }] });
    return {
      status: statuses ? { in: statuses } : undefined,
      category: q.category ? { slug: q.category } : undefined,
      city: q.city ? { equals: q.city, mode: 'insensitive' } : undefined,
      startsAt: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
      AND: and.length ? and : undefined,
    };
  }

  private async list(q: EventQueryDto, statuses: EventStatus[] | undefined, publicView: boolean) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;
    const where = this.where(q, statuses);
    const [data, total] = await Promise.all([
      this.prisma.event.findMany({ where, skip: (page - 1) * limit, take: limit,
        orderBy: [{ startsAt: q.order ?? 'asc' }, { id: 'asc' }], include: { category: CATEGORY } }),
      this.prisma.event.count({ where }),
    ]);
    return { data: publicView ? data.map(this.toPublic) : data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // createdById is internal staff data and is not exposed publicly.
  private toPublic = ({ createdById, ...event }: any) => event;

  findPublic(q: PublicEventQueryDto) {
    return this.list(q, q.status ? [q.status] : PUBLIC_EVENT_STATUSES, true);
  }

  findAdmin(q: AdminEventQueryDto) {
    return this.list(q, q.status ? [q.status] : undefined, false);
  }

  async findPublicOne(where: Prisma.EventWhereUniqueInput) {
    const event = await this.prisma.event.findUnique({ where, include: { category: CATEGORY } });
    if (!event || !PUBLIC_EVENT_STATUSES.includes(event.status as EventStatus)) throw new NotFoundException('Evento não encontrado');
    return this.toPublic(event);
  }

  async findAdminOne(id: number) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: { category: CATEGORY } });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /** Cover and gallery come as URLs or as uploaded files, never both; files are validated and uploaded here. */
  private async resolveImages(dto: UpdateEventDto, files: EventFiles = {}) {
    const cover = files.cover ?? [];
    const gallery = files.gallery ?? [];
    const coverSource = imageSource(dto.coverImageUrl, cover, 'coverImageUrl', 'cover');
    const gallerySource = imageSource(dto.galleryUrls, gallery, 'galleryUrls', 'gallery');
    assertImages([...cover, ...gallery]);
    const images: { coverImageUrl?: string; galleryUrls?: string[] } = {};
    if (coverSource === 'file') images.coverImageUrl = await this.storage.upload(cover[0], 'events/covers', true);
    if (gallerySource === 'file') images.galleryUrls = await this.storage.uploadMany(gallery, 'events/gallery', true);
    return images;
  }

  /** Runs a database write; files uploaded for it are deleted again if the write fails. */
  private async withUploads<T>(images: { coverImageUrl?: string; galleryUrls?: string[] }, write: () => Promise<T>) {
    try {
      return await write();
    } catch (err) {
      await this.storage.deleteMany([images.coverImageUrl, ...(images.galleryUrls ?? [])].filter(Boolean));
      throw err;
    }
  }

  private async uniqueSlug(base: string, ignoreId?: number) {
    let slug = base;
    for (let n = 2; ; n++) {
      const hit = await this.prisma.event.findUnique({ where: { slug }, select: { id: true } });
      if (!hit || hit.id === ignoreId) return slug;
      slug = `${base}-${n}`;
    }
  }

  private assertDates(startsAt: Date, endsAt?: Date | null) {
    if (endsAt && endsAt < startsAt) throw new BadRequestException('endsAt deve ser igual ou posterior a startsAt');
  }

  async create(dto: CreateEventDto, userId: string, files?: EventFiles) {
    this.assertDates(dto.startsAt, dto.endsAt);
    const images = await this.resolveImages(dto, files);
    const { slug, categoryId, ...data } = dto;
    const status = dto.status ?? EventStatus.DRAFT;
    return this.withUploads(images, async () => this.prisma.event.create({
      data: {
        ...data, ...images, status, slug: await this.uniqueSlug(slug ?? slugify(dto.title)),
        category: { connect: { id: categoryId } },
        publishedAt: status === EventStatus.PUBLISHED ? new Date() : null,
        createdById: userId,
      },
      include: { category: CATEGORY },
    }));
  }

  async update(id: number, dto: UpdateEventDto, files?: EventFiles) {
    const current = await this.findAdminOne(id);
    this.assertDates(dto.startsAt ?? current.startsAt, dto.endsAt === undefined ? current.endsAt : dto.endsAt);
    const images = await this.resolveImages(dto, files);
    const { slug, categoryId, ...data } = dto;
    const updated = await this.withUploads(images, async () => this.prisma.event.update({
      where: { id },
      data: {
        ...data, ...images,
        slug: slug && slug !== current.slug ? await this.uniqueSlug(slug, id) : undefined,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        // publishedAt records the first publication only.
        publishedAt: dto.status === EventStatus.PUBLISHED && !current.publishedAt ? new Date() : undefined,
      },
      include: { category: CATEGORY },
    }));
    // Replaced or removed images are deleted from storage after the database points to the new ones.
    const kept = new Set([updated.coverImageUrl, ...updated.galleryUrls]);
    await this.storage.deleteMany([current.coverImageUrl, ...current.galleryUrls].filter((u) => u && !kept.has(u)));
    return updated;
  }

  async remove(id: number) {
    const event = await this.findAdminOne(id);
    await this.prisma.event.delete({ where: { id } });
    await this.storage.deleteMany([event.coverImageUrl, ...event.galleryUrls].filter(Boolean));
    return { message: 'Evento removido com sucesso' };
  }

  async setCover(id: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Envie o arquivo no campo image');
    assertImages([file]);
    const event = await this.findAdminOne(id);
    const url = await this.storage.upload(file, 'events/covers', true);
    const updated = await this.prisma.event.update({ where: { id }, data: { coverImageUrl: url }, include: { category: CATEGORY } });
    if (event.coverImageUrl) await this.storage.delete(event.coverImageUrl);
    return updated;
  }

  async removeCover(id: number) {
    const event = await this.findAdminOne(id);
    const updated = await this.prisma.event.update({ where: { id }, data: { coverImageUrl: null }, include: { category: CATEGORY } });
    if (event.coverImageUrl) await this.storage.delete(event.coverImageUrl);
    return updated;
  }

  async addGallery(id: number, files: Express.Multer.File[] = []) {
    if (!files.length) throw new BadRequestException('Envie ao menos um arquivo no campo images');
    assertImages(files);
    const event = await this.findAdminOne(id);
    if (event.galleryUrls.length + files.length > MAX_GALLERY) {
      throw new BadRequestException(`A galeria aceita no máximo ${MAX_GALLERY} imagens (atual: ${event.galleryUrls.length})`);
    }
    const urls = await this.storage.uploadMany(files, 'events/gallery', true);
    return this.prisma.event.update({ where: { id }, data: { galleryUrls: { push: urls } }, include: { category: CATEGORY } });
  }

  async removeGallery(id: number, url: string) {
    const event = await this.findAdminOne(id);
    if (!event.galleryUrls.includes(url)) throw new NotFoundException('Imagem não encontrada na galeria');
    const updated = await this.prisma.event.update({ where: { id },
      data: { galleryUrls: event.galleryUrls.filter((u) => u !== url) }, include: { category: CATEGORY } });
    await this.storage.delete(url);
    return updated;
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  findCategories() {
    return this.prisma.eventCategory.findMany({ orderBy: { name: 'asc' } });
  }

  createCategory(dto: CreateEventCategoryDto) {
    return this.prisma.eventCategory.create({ data: { ...dto, slug: dto.slug ?? slugify(dto.name) } });
  }

  updateCategory(id: number, dto: UpdateEventCategoryDto) {
    return this.prisma.eventCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: number) {
    await this.prisma.eventCategory.delete({ where: { id } });
    return { message: 'Categoria removida com sucesso' };
  }
}
