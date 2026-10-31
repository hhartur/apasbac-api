import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LogoutDto, RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { requestMeta } from '../common/request-context';
import { ApiEnvelope } from '../common/swagger';
import { AuthSessionResponse, MessageResponse, TokenPairResponse } from '../common/dto/responses';

// Per-IP limits on credential endpoints (brute force and e-mail flooding); the global limit still applies elsewhere.
const LIMIT = (limit: number) => Throttle({ default: { limit, ttl: 60_000 } });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @LIMIT(5)
  @ApiOperation({ summary: 'Cadastro de novo usuário', description: 'Cria uma conta com role USER e já retorna uma sessão (access + refresh token).' })
  @ApiEnvelope(AuthSessionResponse, { status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos, senhas diferentes ou e-mail/CPF já cadastrado' })
  register(@Body() dto: RegisterDto, @Req() req: any) { return this.authService.register(dto, requestMeta(req)); }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LIMIT(10)
  @ApiOperation({ summary: 'Login de usuário', description: 'Autentica por e-mail e senha. Cada login cria uma nova sessão (família de refresh tokens).' })
  @ApiEnvelope(AuthSessionResponse, { description: 'Tokens JWT retornados' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas (mesma resposta para e-mail inexistente e senha errada)' })
  login(@Body() dto: LoginDto, @Req() req: any) { return this.authService.login(dto, requestMeta(req)); }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @LIMIT(30)
  @ApiOperation({ summary: 'Renovar access token usando refresh token',
    description: 'Rotação obrigatória: o refresh token enviado é invalidado e um novo par é retornado. ' +
      'Reutilizar um refresh token já rotacionado (após 10 s) encerra toda a sessão correspondente.' })
  @ApiEnvelope(TokenPairResponse, { description: 'Novo par de tokens' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido, expirado, revogado ou reutilizado' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: any) { return this.authService.refresh(dto.refreshToken, requestMeta(req)); }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @LIMIT(5)
  @ApiOperation({ summary: 'Solicitar link de redefinição de senha por e-mail',
    description: 'Sempre responde 200 com a mesma mensagem, exista ou não a conta. O link expira em 2 horas.' })
  @ApiEnvelope(MessageResponse)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: any) { return this.authService.forgotPassword(dto, requestMeta(req)); }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @LIMIT(10)
  @ApiOperation({ summary: 'Redefinir senha usando o token recebido por e-mail',
    description: 'Após a redefinição, todas as sessões (refresh tokens) do usuário são encerradas.' })
  @ApiEnvelope(MessageResponse)
  @ApiResponse({ status: 400, description: 'Token inválido, expirado ou já usado; senhas diferentes; senha fraca' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: any) { return this.authService.resetPassword(dto, requestMeta(req)); }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Encerrar sessão do usuário',
    description: 'Com refreshToken: encerra aquela sessão. Sem refreshToken: encerra todas as sessões do usuário. ' +
      'O access token atual continua válido até expirar (padrão 15 min).' })
  @ApiEnvelope(MessageResponse)
  logout(@CurrentUser() user: any, @Body() dto: LogoutDto, @Req() req: any) {
    return this.authService.logout(user, dto?.refreshToken, requestMeta(req));
  }
}
