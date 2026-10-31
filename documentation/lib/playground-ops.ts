import { opHref, operations, requestExample, type Operation } from './openapi';
import type { PlaygroundOp } from './playground';

export function toPlaygroundOp(op: Operation): PlaygroundOp {
  const contentType = op.contentTypes[0];
  const example = requestExample(op);
  return {
    id: op.id, method: op.method, path: op.path, summary: op.summary, roles: op.roles, isPublic: op.isPublic, optionalAuth: op.optionalAuth,
    pathParams: op.parameters.filter((p) => p.in === 'path').map((p) => p.name),
    queryParams: op.parameters.filter((p) => p.in === 'query').map((p) => ({ name: p.name, required: !!p.required, description: p.description })),
    contentType, bodyExample: contentType === 'application/json' ? JSON.stringify(example ?? {}, null, 2) : undefined,
    fileField: op.path.endsWith('/gallery') ? 'images' : op.path.endsWith('/image') ? 'image' : 'photos',
    href: opHref(op),
  };
}

export const playgroundOps = () => operations.map(toPlaygroundOp);
