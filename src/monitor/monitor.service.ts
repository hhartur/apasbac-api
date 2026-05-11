import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SheetsService } from '../sheets/sheets.service';
import { MailService } from '../mail/mail.service';
import { ConfigAppService } from '../config-app/config-app.service';
import { CreateMonitoringDto } from './dto/create-monitoring.dto';
import { ReviewMonitoringDto } from './dto/review-monitoring.dto';
import { MonitoringStatus } from '../common/enums';

@Injectable()
export class MonitorService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private sheets: SheetsService,
    private mail: MailService,
    private configService: ConfigAppService,
  ) { }

  async create(dto: CreateMonitoringDto) {
    const animal = await this.prisma.animal.findUnique({ where: { id: dto.animalId } });
    if (!animal) throw new NotFoundException('Animal não encontrado');

    const tutor = await this.prisma.user.findUnique({ where: { id: dto.tutorId } });
    if (!tutor) throw new NotFoundException('Tutor não encontrado');

    const period = await this.configService.getMonitoringPeriod();
    const dueDate = this.calculateDueDate(period.value, period.unit);

    return this.prisma.monitoring.create({
      data: { userId: dto.tutorId, animalId: dto.animalId, notes: dto.notes, dueDate, status: MonitoringStatus.PENDING },
      include: { user: { select: { fullName: true, email: true } }, animal: { select: { name: true, breed: true } } },
    });
  }

  private calculateDueDate(value: number, unit: string): Date {
    const now = new Date();
    const ms = { DAYS: 86400000, WEEKS: 604800000, MONTHS: 0, YEARS: 0 };
    if (unit === 'MONTHS') { now.setMonth(now.getMonth() + value); return now; }
    if (unit === 'YEARS') { now.setFullYear(now.getFullYear() + value); return now; }
    return new Date(now.getTime() + value * (ms[unit] || 86400000));
  }

  async submit(id: string, userId: string, video: Express.Multer.File, images: Express.Multer.File[]) {
    const monitoring = await this.prisma.monitoring.findUnique({
      where: { id },
      include: { user: true, animal: true },
    });
    if (!monitoring) throw new NotFoundException('Monitoramento não encontrado');
    if (monitoring.userId !== userId) throw new ForbiddenException('Sem permissão');
    if (!video) throw new BadRequestException('Vídeo obrigatório');
    if (!images || images.length === 0) throw new BadRequestException('Pelo menos 1 imagem obrigatória');

    const videoUrl = await this.storage.upload(video, 'monitoring/videos');
    const imageUrls = await this.storage.uploadMany(images, 'monitoring/images');

    const sheetsRowId = await this.sheets.appendRow({
      monitoringId: id,
      submittedAt: new Date(),
      tutorName: monitoring.user.fullName,
      tutorEmail: monitoring.user.email,
      animalName: monitoring.animal.name,
      animalBreed: monitoring.animal.breed,
      videoUrl,
      imageUrls,
      status: 'EM ANÁLISE',
    }).catch(() => '');

    return this.prisma.monitoring.update({
      where: { id },
      data: { status: MonitoringStatus.IN_REVIEW, videoUrl, imageUrls, submittedAt: new Date(), sheetsRowId },
      include: { user: { select: { fullName: true, email: true } }, animal: { select: { name: true, breed: true } } },
    });
  }

  async review(id: string, dto: ReviewMonitoringDto) {
    const monitoring = await this.prisma.monitoring.findUnique({
      where: { id },
      include: { user: true, animal: true },
    });
    if (!monitoring) throw new NotFoundException('Monitoramento não encontrado');
    if (monitoring.status === MonitoringStatus.APPROVED || monitoring.status === MonitoringStatus.REJECTED)
      throw new BadRequestException('Monitoramento já revisado');

    const status = dto.approved ? MonitoringStatus.APPROVED : MonitoringStatus.REJECTED;

    if (monitoring.sheetsRowId) {
      await this.sheets.updateStatus(monitoring.sheetsRowId, dto.approved ? 'APROVADO' : 'REJEITADO', dto.notes).catch(() => { });
    }

    const updated = await this.prisma.monitoring.update({
      where: { id },
      data: { status, notes: dto.notes, reviewedAt: new Date() },
      include: { user: { select: { fullName: true, email: true } }, animal: { select: { name: true, breed: true } } },
    });

    await this.mail.sendMonitoringResult(
      monitoring.user.email, monitoring.user.fullName,
      monitoring.animal.name, dto.approved, dto.notes,
    ).catch(() => { });

    if (monitoring.videoUrl) await this.storage.delete(monitoring.videoUrl).catch(() => { });
    if (monitoring.imageUrls?.length) await this.storage.deleteMany(monitoring.imageUrls).catch(() => { });

    await this.prisma.monitoring.update({ where: { id }, data: { videoUrl: null, imageUrls: [] } });

    return updated;
  }

  async findAll(page = 1, limit = 20, status?: MonitoringStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.monitoring.findMany({
        skip, take: limit, where, orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } }, animal: { select: { id: true, name: true, breed: true } } },
      }),
      this.prisma.monitoring.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findMine(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.monitoring.findMany({
        skip, take: limit, where: { userId }, orderBy: { createdAt: 'desc' },
        include: { animal: { select: { id: true, name: true, breed: true } } },
      }),
      this.prisma.monitoring.count({ where: { userId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const m = await this.prisma.monitoring.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } }, animal: { select: { id: true, name: true, breed: true } } },
    });
    if (!m) throw new NotFoundException('Monitoramento não encontrado');
    return m;
  }

  async remove(id: string) {
    const m = await this.findOne(id);
    if (m.videoUrl) await this.storage.delete(m.videoUrl).catch(() => { });
    if (m.imageUrls?.length) await this.storage.deleteMany(m.imageUrls as string[]).catch(() => { });
    await this.prisma.monitoring.delete({ where: { id } });
    return { message: 'Monitoramento removido' };
  }
}