import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppVersionService } from './app-version.service';
import { UPDATE_MANIFEST_URL } from './update-manifest';

export const SkipAppVersion = () => SetMetadata('skipAppVersion', true);

@Injectable()
export class AppVersionInterceptor implements NestInterceptor {
  constructor(private readonly versions: AppVersionService, private readonly reflector: Reflector) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    // Interceptors run after JWT guards. Public endpoints and non-Android consumers stay independent.
    if (!request.user || request.headers['x-app-platform'] !== 'android' ||
        this.reflector.getAllAndOverride<boolean>('skipAppVersion', [context.getHandler(), context.getClass()])) return next.handle();
    const header = request.headers['x-app-version-code'];
    const code = typeof header === 'string' && /^[1-9]\d{0,9}$/.test(header) && Number(header) <= 2100000000 ? Number(header) : 0;
    const latest = await this.versions.latest();
    if (latest && code < latest.minimumSupportedVersionCode) {
      throw new HttpException({ error: 'APP_UPDATE_REQUIRED',
        message: 'Esta versão do aplicativo não é mais suportada.',
        latestVersionCode: latest.versionCode, latestVersionName: latest.versionName,
        minimumSupportedVersionCode: latest.minimumSupportedVersionCode,
        updateManifestUrl: UPDATE_MANIFEST_URL }, 426);
    }
    return next.handle();
  }
}
