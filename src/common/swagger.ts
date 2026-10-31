import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

interface EnvelopeOptions { status?: number; description?: string; isArray?: boolean; paginated?: boolean }

/** Documents the success envelope added by TransformInterceptor: { success: true, data, timestamp }. */
export function ApiEnvelope(model: Type<unknown>, opts: EnvelopeOptions = {}) {
  const ref = { $ref: getSchemaPath(model) };
  const data = opts.paginated
    ? { type: 'object', required: ['data', 'total', 'page', 'limit', 'totalPages'], properties: {
        data: { type: 'array', items: ref }, total: { type: 'integer', example: 42 }, page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 }, totalPages: { type: 'integer', example: 3 } } }
    : opts.isArray ? { type: 'array', items: ref } : ref;
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({ status: opts.status ?? 200, description: opts.description ?? 'Sucesso', schema: {
      type: 'object', required: ['success', 'data', 'timestamp'],
      properties: { success: { type: 'boolean', example: true }, data, timestamp: { type: 'string', format: 'date-time' } },
    } }),
  );
}
