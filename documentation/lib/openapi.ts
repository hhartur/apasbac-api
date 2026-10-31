// Reads the OpenAPI document exported from the NestJS API (npm run openapi:export in the API).
// Every endpoint page is generated from it, so the docs cannot list an endpoint the API does not have.
import spec from '../openapi/openapi.json';

export type Schema = {
  $ref?: string; type?: string; format?: string; description?: string; enum?: unknown[]; example?: unknown;
  properties?: Record<string, Schema>; required?: string[]; items?: Schema; allOf?: Schema[]; oneOf?: Schema[];
  nullable?: boolean; minimum?: number; maximum?: number; minLength?: number; maxLength?: number;
  minItems?: number; maxItems?: number; pattern?: string; default?: unknown; additionalProperties?: unknown;
};
export type Parameter = { name: string; in: 'path' | 'query' | 'header'; required?: boolean; description?: string; schema?: Schema };
type RawOp = {
  operationId: string; summary?: string; description?: string; tags?: string[]; parameters?: Parameter[];
  requestBody?: { content: Record<string, { schema: Schema }> }; responses: Record<string, { description?: string; content?: Record<string, { schema: Schema }> }>;
  security?: Record<string, string[]>[]; 'x-roles'?: string[]; 'x-public'?: boolean;
};

export interface Operation {
  id: string; slug: string; tag: string; tagSlug: string; method: string; path: string;
  summary: string; description?: string; roles: string[]; isPublic: boolean; optionalAuth: boolean;
  parameters: Parameter[]; contentTypes: string[]; bodySchema?: Schema; responses: RawOp['responses'];
}

export const TAGS: Record<string, { slug: string; label: string; description: string }> = {
  Auth: { slug: 'autenticacao', label: 'Autenticação', description: 'Cadastro, login, renovação de sessão, logout e recuperação de senha.' },
  Users: { slug: 'usuarios', label: 'Usuários', description: 'Perfil do usuário autenticado e gestão de usuários e roles.' },
  Animals: { slug: 'animais', label: 'Animais', description: 'Animais, QR Codes e vínculo de adoção.' },
  Monitor: { slug: 'monitoramentos', label: 'Monitoramentos', description: 'Acompanhamento pós-adoção: criação, envio pelo tutor e revisão.' },
  Events: { slug: 'eventos', label: 'Eventos', description: 'Eventos institucionais, categorias e imagens.' },
  Config: { slug: 'configuracoes', label: 'Configurações', description: 'Configurações do sistema, incluindo contatos institucionais.' },
  Storage: { slug: 'uploads', label: 'Uploads e mídias', description: 'Assinatura para upload direto ao Cloudinary.' },
  Audit: { slug: 'auditoria', label: 'Auditoria', description: 'Consulta administrativa dos registros de auditoria.' },
  'App version': { slug: 'versao-do-app', label: 'Versão do app', description: 'Manifesto de versão e telemetria do app Android.' },
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const document = spec as unknown as {
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, Record<string, RawOp>>;
  components: { schemas: Record<string, Schema> };
};

export const operations: Operation[] = Object.entries(document.paths).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m]).map((method) => {
    const op = item[method];
    const [controller, handler] = op.operationId.split('_');
    const tag = op.tags?.[0] ?? 'Other';
    const content = op.requestBody?.content ?? {};
    const contentTypes = Object.keys(content);
    return {
      id: op.operationId,
      slug: (controller.startsWith('Admin') ? 'admin-' : '') + kebab(handler),
      tag, tagSlug: TAGS[tag]?.slug ?? kebab(tag),
      method: method.toUpperCase(), path,
      // Access level is shown as badges, so "[Público]" and "(Admin/Staff)" markers are dropped from titles.
      summary: (op.summary ?? op.operationId).replace(/^\[Público\]\s*/, '').replace(/\s*\((Admin|Staff|Tutor|Admin\/Staff|Admin\/Staff\/Tutor)\)$/, ''),
      description: op.description,
      roles: op['x-roles'] ?? [], isPublic: !!op['x-public'],
      optionalAuth: !!op['x-public'] && !!op.security?.length,
      parameters: op.parameters ?? [], contentTypes,
      bodySchema: contentTypes.length ? content[contentTypes[0]].schema : undefined,
      responses: op.responses,
    };
  }),
);

export const tags = Object.keys(TAGS).filter((t) => operations.some((o) => o.tag === t));
export const opsByTag = (tag: string) => operations.filter((o) => o.tag === tag);
export const findOperation = (tagSlug: string, slug: string) => operations.find((o) => o.tagSlug === tagSlug && o.slug === slug);
export const tagBySlug = (slug: string) => tags.find((t) => TAGS[t].slug === slug);
export const opHref = (o: Operation) => `/api-reference/${o.tagSlug}/${o.slug}`;
export const shortPath = (p: string) => p.replace(/^\/api\/v1/, '');

export function resolve(schema?: Schema): Schema | undefined {
  if (!schema) return undefined;
  if (schema.$ref) return resolve(document.components.schemas[schema.$ref.split('/').pop()!]);
  if (schema.allOf?.length === 1) return resolve(schema.allOf[0]);
  return schema;
}

export function typeLabel(s?: Schema): string {
  const r = resolve(s);
  if (!r) return 'any';
  if (s?.$ref) return s.$ref.split('/').pop()!;
  if (r.oneOf) return r.oneOf.map(typeLabel).join(' | ');
  if (r.type === 'array') return `${typeLabel(r.items)}[]`;
  if (r.enum) return 'enum';
  return [r.type ?? 'object', r.format ? `(${r.format})` : ''].join(' ').trim();
}

export interface FieldRow { name: string; type: string; required: boolean; description?: string; rules: string[] }

/** Flattens a schema into documentation rows (nested objects as `parent.child`, arrays as `items[].child`). */
export function fieldRows(schema?: Schema, prefix = '', depth = 0, seen = new Set<string>()): FieldRow[] {
  const s = resolve(schema);
  if (!s?.properties || depth > 3) return [];
  return Object.entries(s.properties).flatMap(([name, prop]) => {
    const r = resolve(prop) ?? {};
    const full = prefix + name;
    const rules: string[] = [];
    const src = { ...r, ...prop };
    if (src.enum) rules.push(`valores: ${src.enum.join(', ')}`);
    if (src.minLength !== undefined) rules.push(`mín. ${src.minLength} caracteres`);
    if (src.maxLength !== undefined) rules.push(`máx. ${src.maxLength} caracteres`);
    if (src.minimum !== undefined) rules.push(`mín. ${src.minimum}`);
    if (src.maximum !== undefined) rules.push(`máx. ${src.maximum}`);
    if (src.minItems !== undefined) rules.push(`mín. ${src.minItems} itens`);
    if (src.maxItems !== undefined) rules.push(`máx. ${src.maxItems} itens`);
    if (src.pattern) rules.push(`padrão ${src.pattern}`);
    if (src.nullable) rules.push('pode ser null');
    if (src.default !== undefined) rules.push(`padrão: ${JSON.stringify(src.default)}`);
    const row: FieldRow = { name: full, type: typeLabel(prop), required: !!s.required?.includes(name), description: prop.description ?? r.description, rules };
    const ref = prop.$ref ?? (r.type === 'array' ? r.items?.$ref : undefined);
    if (ref && seen.has(ref)) return [row];
    const nextSeen = new Set(seen); if (ref) nextSeen.add(ref);
    const child = r.type === 'array' ? fieldRows(r.items, `${full}[].`, depth + 1, nextSeen) : fieldRows(prop, `${full}.`, depth + 1, nextSeen);
    return [row, ...child];
  });
}

const FORMAT_EXAMPLES: Record<string, unknown> = {
  uuid: '3f2b9c1e-8a4d-4e2b-9c1a-7d5e6f8a9b0c', 'date-time': '2026-11-21T13:00:00.000Z', uri: 'https://res.cloudinary.com/<cloud>/image/upload/v1/exemplo.jpg', email: 'usuario@exemplo.com',
};

/** Builds an example value from the schema (explicit examples first). */
export function exampleOf(schema?: Schema, depth = 0): unknown {
  const s = resolve(schema);
  if (!s || depth > 4) return null;
  if (schema?.example !== undefined) return schema.example;
  if (s.example !== undefined) return s.example;
  if (s.enum) return s.enum[0];
  if (s.oneOf) return exampleOf(s.oneOf[0], depth + 1);
  switch (s.type) {
    case 'string': return FORMAT_EXAMPLES[s.format ?? ''] ?? 'string';
    case 'integer': case 'number': return s.minimum ?? 1;
    case 'boolean': return false;
    case 'array': return [exampleOf(s.items, depth + 1)];
  }
  if (s.properties) return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, exampleOf(v, depth + 1)]));
  return {};
}

/** Example request body: required fields always, optional ones only when they carry an explicit example. */
export function requestExample(op: Operation): Record<string, unknown> | undefined {
  const s = resolve(op.bodySchema);
  if (!s?.properties) return undefined;
  return Object.fromEntries(Object.entries(s.properties)
    .filter(([k, v]) => s.required?.includes(k) || v.example !== undefined || resolve(v)?.example !== undefined)
    .map(([k, v]) => [k, exampleOf(v)]));
}

export const PATH_EXAMPLES: Record<string, string> = { id: '1', uuid: '195057e8-fe28-4ee1-905e-6151a250454d', key: 'apasbac_phone', slug: 'feira-de-adocao-de-primavera' };
export const examplePath = (op: Operation) => op.path.replace(/\{(\w+)\}/g, (_, n) => PATH_EXAMPLES[n] ?? n);

export const successStatus = (op: Operation) => Object.keys(op.responses).find((c) => c.startsWith('2')) ?? '200';
export const errorStatuses = (op: Operation) => Object.entries(op.responses).filter(([c]) => !c.startsWith('2'));
export const isMutation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

export function authLabel(op: Operation) {
  if (op.optionalAuth) return 'Público (token opcional)';
  if (op.isPublic) return 'Público';
  return op.roles.length ? `Bearer token — ${op.roles.join(', ')}` : 'Bearer token — qualquer usuário autenticado';
}
