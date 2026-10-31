import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { RequestMeta } from '../common/request-context';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
// Parallel refreshes from one client within this window are a race, not theft: no family revocation.
export const REUSE_GRACE_MS = 10_000;
// Compared against when the e-mail does not exist, so response time does not reveal registered accounts.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 12);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private audit: AuditService,
  ) {}

  private async issueTokens(user: { id: string; email: string; role: string }, familyId: string = randomUUID()) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });
    // jti makes every refresh token unique, even when two are issued for the same user in the same second.
    const refreshToken = this.jwt.sign({ ...payload, jti: randomUUID() }, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
    const { exp } = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: { token: sha256(refreshToken), familyId, userId: user.id, expiresAt: new Date(exp * 1000) },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
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
    const tokens = await this.issueTokens(user);
    await this.audit.record({ action: 'AUTH_REGISTER', resource: 'user', resourceId: user.id,
      actorId: user.id, actorRole: user.role, ...meta });
    const { password: _, ...safe } = user;
    return { user: safe, ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
      await this.audit.record({ action: 'AUTH_LOGIN_FAILED', resource: 'auth', outcome: 'FAILURE',
        actorId: user?.id, actorRole: user?.role, metadata: { reason: user ? 'wrong_password' : 'unknown_account' }, ...meta });
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const tokens = await this.issueTokens(user);
    await this.audit.record({ action: 'AUTH_LOGIN', resource: 'auth', actorId: user.id, actorRole: user.role, ...meta });
    const { password: _, ...safe } = user;
    return { user: safe, ...tokens };
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch { throw new UnauthorizedException('Refresh token inválido ou expirado'); }
    // Tokens issued before v1.1.0 were stored in plain text; they are still accepted until they expire.
    const stored = await this.prisma.refreshToken.findFirst({ where: { token: { in: [sha256(refreshToken), refreshToken] } } });
    if (!stored || stored.expiresAt < new Date()) throw new UnauthorizedException('Refresh token inválido');

    const rotated = stored.revokedAt ? 0 : (await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() },
    })).count;
    if (rotated === 0) {
      const revokedAt = stored.revokedAt ?? new Date();
      if (Date.now() - revokedAt.getTime() > REUSE_GRACE_MS) {
        // A rotated token came back: assume it leaked and end that whole session.
        await this.prisma.refreshToken.updateMany({
          where: stored.familyId ? { familyId: stored.familyId } : { userId: stored.userId },
          data: { revokedAt: new Date() },
        });
        await this.audit.record({ action: 'AUTH_REFRESH_REUSE_DETECTED', resource: 'auth', outcome: 'FAILURE',
          actorId: stored.userId, metadata: { familyId: stored.familyId }, ...meta });
      }
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    const tokens = await this.issueTokens(user, stored.familyId ?? randomUUID());
    await this.audit.record({ action: 'AUTH_REFRESH', resource: 'auth', actorId: user.id, actorRole: user.role, ...meta });
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user) {
      const token = randomUUID();
      await this.prisma.passwordReset.create({
        data: { token: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
      });
      await this.mail.sendPasswordReset(user.email, user.fullName, token).catch(() => {});
      await this.audit.record({ action: 'AUTH_PASSWORD_RESET_REQUESTED', resource: 'user', resourceId: user.id,
        actorId: user.id, actorRole: user.role, ...meta });
    }
    return { message: 'Se o e-mail existir, você receberá um link de redefinição' };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta = {}) {
    if (dto.password !== dto.confirmPassword)
      throw new BadRequestException('Senhas não coincidem');
    const reset = await this.prisma.passwordReset.findFirst({ where: { token: { in: [sha256(dto.token), dto.token] } } });
    if (!reset || reset.used || reset.expiresAt < new Date())
      throw new BadRequestException('Token inválido ou expirado');
    const hash = await bcrypt.hash(dto.password, 12);
    // New password: every other reset link and every open session of this user stop working.
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { password: hash } }),
      this.prisma.passwordReset.updateMany({ where: { userId: reset.userId, used: false }, data: { used: true } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: reset.userId } }),
    ]);
    await this.audit.record({ action: 'AUTH_PASSWORD_RESET', resource: 'user', resourceId: reset.userId,
      actorId: reset.userId, ...meta });
    return { message: 'Senha redefinida com sucesso' };
  }

  async logout(user: { id: string; role?: string }, refreshToken?: string, meta: RequestMeta = {}) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({ where: { token: { in: [sha256(refreshToken), refreshToken] }, userId: user.id } });
    } else {
      await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    }
    await this.audit.record({ action: 'AUTH_LOGOUT', resource: 'auth', actorId: user.id, actorRole: user.role,
      metadata: { scope: refreshToken ? 'session' : 'all_sessions' }, ...meta });
    return { message: 'Logout realizado com sucesso' };
  }
}
