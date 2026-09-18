import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Erro interno do servidor';
    let error = 'Internal Server Error';
    let update: Record<string, unknown> = {};
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      if (status === 426 && res?.error === 'APP_UPDATE_REQUIRED') {
        update = { latestVersionCode: res.latestVersionCode, latestVersionName: res.latestVersionName,
          minimumSupportedVersionCode: res.minimumSupportedVersionCode, updateManifestUrl: res.updateManifestUrl };
      }
      if (typeof res === 'object') { message = res.message || message; error = res.error || error; }
      else { message = res; }
    } else { this.logger.error(exception); }
    response.status(status).json({ success: false, statusCode: status, error, message, ...update, timestamp: new Date().toISOString(), path: request.url });
  }
}
