import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

// Known Prisma errors become client errors instead of a generic 500.
const PRISMA_ERRORS: Record<string, [number, string, string]> = {
  P2025: [HttpStatus.NOT_FOUND, 'Not Found', 'Registro não encontrado'],
  P2002: [HttpStatus.CONFLICT, 'Conflict', 'Já existe um registro com estes dados únicos'],
  P2003: [HttpStatus.CONFLICT, 'Conflict', 'O registro está vinculado a outros dados e não pode ser alterado ou removido'],
};

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
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERRORS[exception.code]) {
      [status, error, message] = PRISMA_ERRORS[exception.code];
    } else { this.logger.error(exception); }
    const requestId = (request as any).requestId;
    response.status(status).json({ success: false, statusCode: status, error, message, ...update,
      timestamp: new Date().toISOString(), path: request.url, ...(requestId ? { requestId } : {}) });
  }
}
