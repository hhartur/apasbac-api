import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword)
      throw new BadRequestException('Senhas não coincidem');
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { cpf: dto.cpf }] },
    });
    if (exists) throw new BadRequestException('E-mail ou CPF já cadastrado');
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { fullName: dto.fullName, phone: dto.phone, cpf: dto.cpf, email: dto.email, password: hash },
    });
    await this.mail.sendWelcome(user.email, user.fullName).catch(() => {});
    const tokens = this.generateTokens(user.id, user.email, user.role);
    await this.prisma.refreshToken.create({
      data: { token: tokens.refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    const { password: _, ...safe } = user;
    return { user: safe, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.password)))
      throw new UnauthorizedException('Credenciais inválidas');
    const tokens = this.generateTokens(user.id, user.email, user.role);
    await this.prisma.refreshToken.create({
      data: { token: tokens.refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    const { password: _, ...safe } = user;
    return { user: safe, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch { throw new UnauthorizedException('Refresh token inválido ou expirado'); }
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    await this.prisma.refreshToken.delete({ where: { token: refreshToken } });
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    const tokens = this.generateTokens(user.id, user.email, user.role);
    await this.prisma.refreshToken.create({
      data: { token: tokens.refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return { message: 'Se o e-mail existir, você receberá um link de redefinição' };
    const token = uuidv4();
    await this.prisma.passwordReset.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });
    await this.mail.sendPasswordReset(user.email, user.fullName, token).catch(() => {});
    return { message: 'Se o e-mail existir, você receberá um link de redefinição' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword)
      throw new BadRequestException('Senhas não coincidem');
    const reset = await this.prisma.passwordReset.findUnique({ where: { token: dto.token } });
    if (!reset || reset.used || reset.expiresAt < new Date())
      throw new BadRequestException('Token inválido ou expirado');
    const hash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({ where: { id: reset.userId }, data: { password: hash } });
    await this.prisma.passwordReset.update({ where: { token: dto.token }, data: { used: true } });
    return { message: 'Senha redefinida com sucesso' };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken, userId } });
    } else {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    return { message: 'Logout realizado com sucesso' };
  }
}
