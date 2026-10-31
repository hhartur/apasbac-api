import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

// Reuses a well-formed X-Request-Id from the caller/proxy, otherwise generates one, and echoes it back.
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export function requestMeta(req: any): RequestMeta {
  if (!req) return {};
  const ua = req.headers?.['user-agent'];
  return {
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: typeof ua === 'string' ? ua.slice(0, 255) : undefined,
    requestId: req.requestId,
  };
}
