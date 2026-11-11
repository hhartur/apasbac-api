import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../common/request-context';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface AuditEntry extends RequestMeta {
  action: string;
  resource: string;
  resourceId?: string | number | null;
  outcome?: 'SUCCESS' | 'FAILURE';
  description?: string;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorRole?: string | null;
}

// Keys whose values must never reach the audit table (credentials, tokens, personal documents, contact data).
const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|signature|api_?key|cpf|e-?mail|phone/i;

export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 3) return '[truncated]';
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeMetadata(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : sanitizeMetadata(v, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Failure policy: an audit write never undoes or blocks the audited operation (which has already
   * happened). If the database write fails, the sanitized entry is emitted to the application log
   * with the AUDIT_WRITE_FAILED marker so it can be recovered from the log drain.
   */
  async record(entry: AuditEntry): Promise<void> {
    const data: Prisma.AuditLogCreateInput = {
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId === undefined || entry.resourceId === null ? null : String(entry.resourceId),
      outcome: entry.outcome ?? 'SUCCESS',
      description: entry.description?.slice(0, 500),
      metadata: entry.metadata ? (sanitizeMetadata(entry.metadata) as Prisma.InputJsonValue) : undefined,
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      ipAddress: entry.ipAddress?.slice(0, 64),
      userAgent: entry.userAgent?.slice(0, 255),
      requestId: entry.requestId?.slice(0, 64),
    };
    try {
      await this.prisma.auditLog.create({ data });
    } catch (err) {
      this.logger.error(JSON.stringify({ marker: 'AUDIT_WRITE_FAILED', entry: data, error: String(err) }));
    }
  }

  async findAll(q: AuditQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const where: Prisma.AuditLogWhereInput = {
      actorId: q.actorId, actorRole: q.actorRole, action: q.action, resource: q.resource,
      resourceId: q.resourceId, ipAddress: q.ipAddress, requestId: q.requestId, outcome: q.outcome,
      createdAt: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findOne(id: string) {
    return this.prisma.auditLog.findUniqueOrThrow({ where: { id } });
  }

  // Actions that represent a security-relevant event, surfaced in the monitoring overview.
  static readonly SECURITY_ACTIONS = [
    'AUTH_LOGIN_FAILED',
    'AUTH_REFRESH_REUSE_DETECTED',
    'AUTH_PASSWORD_RESET_REQUESTED',
    'HTTP_FORBIDDEN',
    'HTTP_RATE_LIMITED',
    'HTTP_SERVER_ERROR',
  ];

  /**
   * Aggregated view of the recent security activity for monitoring/dashboards (Admin only).
   * Returns, for the last `hours`: total failures, a count per security action and the IPs with the
   * most failed/denied requests. Built from the append-only audit table — no personal data exposed.
   */
  async securityOverview(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const window = { createdAt: { gte: since } };
    const [byActionRows, topIpRows, totalFailures] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { ...window, action: { in: AuditService.SECURITY_ACTIONS } },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['ipAddress'],
        where: { ...window, outcome: 'FAILURE', ipAddress: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { ipAddress: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.count({ where: { ...window, outcome: 'FAILURE' } }),
    ]);
    const byAction: Record<string, number> = {};
    for (const action of AuditService.SECURITY_ACTIONS) byAction[action] = 0;
    for (const row of byActionRows) byAction[row.action] = row._count._all;
    return {
      windowHours: hours,
      from: since.toISOString(),
      to: new Date().toISOString(),
      totalFailures,
      byAction,
      topFailingIps: topIpRows.map((r) => ({ ip: r.ipAddress, count: r._count._all })),
    };
  }
}
