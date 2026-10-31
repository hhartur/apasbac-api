import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UpdateUserRoleDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private safe(user: any) {
    const { password, ...rest } = user;
    return rest;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, include: { adoptedAnimals: { select: { id: true, name: true } } } }),
      this.prisma.user.count(),
    ]);
    return { data: data.map(this.safe), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { adoptedAnimals: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.safe(user);
  }

  async update(id: string, dto: UpdateUserDto, currentUser: any) {
    if (currentUser.id !== id && !['ADMIN', 'STAFF'].includes(currentUser.role))
      throw new ForbiddenException('Sem permissão');
    if (currentUser.id !== id && currentUser.role === 'STAFF') {
      const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!target) throw new NotFoundException('Usuário não encontrado');
      if (target.role === 'ADMIN') throw new ForbiddenException('STAFF não pode alterar dados de um ADMIN');
    }
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return this.safe(user);
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, currentUser: any) {
    if (currentUser.id === id) throw new BadRequestException('Não é possível alterar a própria role');
    const user = await this.prisma.user.update({ where: { id }, data: { role: dto.role } });
    return this.safe(user);
  }

  async remove(id: string, currentUser: any) {
    if (currentUser.id === id) throw new BadRequestException('Não é possível remover a própria conta por este endpoint');
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso' };
  }

  async me(id: string) {
    return this.findOne(id);
  }
}
