import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConfigDto, UpdateConfigDto } from './dto/config.dto';

@Injectable()
export class ConfigAppService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateConfigDto) {
    const exists = await this.prisma.appConfig.findUnique({ where: { key: dto.key } });
    if (exists) throw new ConflictException(`Config '${dto.key}' já existe`);
    return this.prisma.appConfig.create({ data: dto });
  }

  async findAll() { return this.prisma.appConfig.findMany({ orderBy: { key: 'asc' } }); }

  async findOne(key: string) {
    const c = await this.prisma.appConfig.findUnique({ where: { key } });
    if (!c) throw new NotFoundException(`Config '${key}' não encontrada`);
    return c;
  }

  async update(key: string, dto: UpdateConfigDto) {
    await this.findOne(key);
    return this.prisma.appConfig.update({ where: { key }, data: dto });
  }

  async remove(key: string) {
    await this.findOne(key);
    await this.prisma.appConfig.delete({ where: { key } });
    return { message: `Config '${key}' removida` };
  }

  async getMonitoringPeriod(): Promise<{ value: number; unit: string }> {
    const val = await this.prisma.appConfig.findUnique({ where: { key: 'monitoring_period_value' } });
    const unit = await this.prisma.appConfig.findUnique({ where: { key: 'monitoring_period_unit' } });
    return { value: parseInt(val?.value || '6'), unit: unit?.value || 'MONTHS' };
  }
}
