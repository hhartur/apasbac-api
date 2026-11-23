import { Body, Controller, Get, HttpCode, Logger, Post, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppVersionService } from './app-version.service';
import { SkipAppVersion } from './app-version.interceptor';

class UpdateEventDto {
  @IsIn(['update_available', 'update_download_started', 'update_download_completed',
    'update_hash_failed', 'update_install_requested', 'update_install_success_detected', 'update_install_failed'])
  event: string;
  @IsInt() @Min(1) @Max(2100000000)
  installedVersionCode: number;
  @IsInt() @Min(1) @Max(2100000000)
  targetVersionCode: number;
}

@ApiTags('App version')
@Controller('app')
export class AppVersionController {
  private readonly logger = new Logger(AppVersionController.name);
  constructor(private readonly versions: AppVersionService) {}
  @Public()
  @Get('version')
  @ApiOperation({ summary: 'Manifesto Android stable (cache do GitHub)' })
  async version() {
    const manifest = await this.versions.latest();
    if (!manifest) throw new ServiceUnavailableException('Informações de atualização temporariamente indisponíveis.');
    return manifest;
  }
  @Public()
  @Get('download')
  @SkipAppVersion()
  @ApiOperation({ summary: 'Baixar o aplicativo Android (sempre a versão mais recente)',
    description: 'Endereço fixo para links e QR Codes: redireciona (302) para o APK da última versão publicada no ' +
      'manifesto do GitHub. O destino é sempre uma Release de APASBAC/apasbac-app (validado pelo manifesto).' })
  @ApiResponse({ status: 302, description: 'Redireciona para o APK mais recente' })
  @ApiResponse({ status: 503, description: 'Nenhuma versão publicada ainda ou GitHub indisponível sem cache' })
  async download(@Res() res: Response) {
    const manifest = await this.versions.latest();
    if (!manifest) throw new ServiceUnavailableException('Download temporariamente indisponível. Tente novamente em instantes.');
    // Never cached: the next release must be served as soon as the manifest changes.
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, manifest.apkUrl);
  }
  @Post('update-events')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @SkipAppVersion()
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  event(@Body() event: UpdateEventDto) {
    // Deliberately no user ID, token, device identifier, URL or free text.
    this.logger.log({ event: event.event, installedVersionCode: event.installedVersionCode,
      targetVersionCode: event.targetVersionCode });
  }
}
