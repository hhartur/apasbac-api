import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { requestMeta } from './request-context';

const logger = new Logger('HTTP');

// Failure statuses that leave a security trail in the audit table.
// 401 is already recorded by the auth service (login/refresh) and is otherwise mostly expired
// tokens, so it is logged but not audited here to avoid duplicate/noisy entries.
const SECURITY_ACTIONS: Record<number, string> = {
  403: 'HTTP_FORBIDDEN', // role or ownership denied (possible privilege-escalation attempt)
  429: 'HTTP_RATE_LIMITED', // throttler tripped (possible brute force / scraping)
  500: 'HTTP_SERVER_ERROR', // unexpected server failure
};

export interface AccessLogLine {
  requestId?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  actorId: string | null;
  actorRole: string | null;
  ip?: string;
}

/**
 * Builds the structured access-log line for a finished request. Never includes the request body,
 * query string, headers, tokens or personal data — only routing/outcome metadata (AGENTS rule #4).
 */
export function accessLine(req: any, status: number, durationMs: number): AccessLogLine {
  return {
    requestId: req.requestId,
    method: req.method,
    // Drop the query string: it may carry filters that are not meant for the log drain.
    path: String(req.originalUrl || req.url || '').split('?')[0],
    status,
    durationMs,
    actorId: req.user?.id ?? null,
    actorRole: req.user?.role ?? null,
    ip: req.ip,
  };
}

/**
 * Structured access log for every API request, plus a security trail for denied, throttled or
 * failed calls. Runs as Express middleware — before the Nest guards — so it also captures requests
 * a guard rejects (401/403/429), which never reach a controller or a Nest interceptor. The actor is
 * read from `req.user` at response time (the guards populate it) and bodies/PII are never logged.
 */
export function httpLogger(audit: AuditService) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Keep access logs focused on the API; the static docs/assets are served outside it.
    if (!String(req.originalUrl || '').startsWith('/api/')) return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const status = res.statusCode;
      const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
      const line = accessLine(req, status, durationMs);
      const json = JSON.stringify(line);
      if (status >= 500) logger.error(json);
      else if (status >= 400) logger.warn(json);
      else logger.log(json);

      const action = SECURITY_ACTIONS[status];
      if (action) {
        const user = (req as any).user;
        void audit.record({
          action,
          resource: 'http',
          outcome: 'FAILURE',
          actorId: user?.id,
          actorRole: user?.role,
          description: `${line.method} ${line.path}`.slice(0, 500),
          metadata: { method: line.method, path: line.path, status },
          ...requestMeta(req),
        });
      }
    });
    next();
  };
}
