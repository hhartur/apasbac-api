import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs/operators';
import { requestMeta } from '../common/request-context';
import { AuditService } from './audit.service';

export interface AuditOptions {
  /** Fixed action name, or a function of the request body (e.g. approve vs reject). */
  action: string | ((body: any) => string);
  resource: string;
  /** Route param holding the resource ID; defaults to `id`, falls back to the response `id`. */
  idParam?: string;
}

export const AUDIT_KEY = 'audit';
export const Audited = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

// Records successful mutations after the handler completes. Only body field NAMES are stored, never values.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService, private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const options = this.reflector.get<AuditOptions>(AUDIT_KEY, context.getHandler());
    if (!options) return next.handle();
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(tap((result) => {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const files = [].concat(req.file ?? [], ...(Array.isArray(req.files) ? req.files : Object.values(req.files ?? {})));
      void this.audit.record({
        action: typeof options.action === 'function' ? options.action(body) : options.action,
        resource: options.resource,
        // The global TransformInterceptor may already have wrapped the result in { success, data }.
        resourceId: req.params?.[options.idParam ?? 'id'] ?? result?.id ?? result?.data?.id ?? null,
        actorId: req.user?.id,
        actorRole: req.user?.role,
        metadata: {
          method: req.method,
          route: req.route?.path,
          fields: Object.keys(body),
          ...(files.length ? { files: files.map((f: any) => ({ mimetype: f.mimetype, size: f.size })) } : {}),
        },
        ...requestMeta(req),
      });
    }));
  }
}
