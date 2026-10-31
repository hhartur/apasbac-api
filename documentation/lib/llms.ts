import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allDocs, toPlainMarkdown } from './content';
import { navigation } from './navigation';
import { authLabel, exampleOf, fieldRows, operations, opHref, requestExample, resolve, shortPath, successStatus, TAGS, tags } from './openapi';
import { site } from './site';

export const agentsMarkdown = () => readFileSync(join(process.cwd(), 'ai', 'AGENTS.md'), 'utf8');

const abs = (href: string) => `${site.url}${href}`;

export function buildLlmsTxt(): string {
  const docs = new Map(allDocs().map((d) => [d.href, d]));
  const lines = [
    '# APASBAC API',
    '',
    `> API REST oficial da APASBAC — ${site.fullName} (${site.location}). Animais para adoção, QR Codes de identificação, monitoramento pós-adoção, eventos institucionais, configurações e auditoria.`,
    '',
    `- Documentação: ${site.url}`,
    `- URL base da API: ${site.apiBase}`,
    `- Versão: ${site.apiVersion}`,
    `- OpenAPI 3.0 (fonte de verdade dos contratos): ${abs('/openapi.json')}`,
    `- Documentação completa em texto: ${abs('/llms-full.txt')}`,
    `- Instruções para agentes: ${abs('/AGENTS.md')}`,
    `- Código-fonte: ${site.github}`,
    '',
    '## Essencial',
    '',
    '- Tecnologias: NestJS 10, TypeScript, Prisma, PostgreSQL, JWT, Cloudinary (mídias), Nodemailer, Google Sheets (planilha interna de monitoramento).',
    '- Respostas de sucesso: `{ "success": true, "data": <payload>, "timestamp": "<ISO 8601>" }`. Listas paginadas: `data = { data: [], total, page, limit, totalPages }`.',
    '- Erros: `{ "success": false, "statusCode", "error", "message" (string ou string[]), "timestamp", "path", "requestId" }`.',
    '- Autenticação: `POST /auth/login` retorna `accessToken` (JWT, 15 min) e `refreshToken` (JWT, 7 dias, uso único). Envie `Authorization: Bearer <accessToken>`.',
    '- Renovação: `POST /auth/refresh` com `{ "refreshToken" }` retorna um NOVO par; o refresh token anterior deixa de valer. Reutilizar um token rotacionado encerra a sessão.',
    '- Roles: ADMIN (acesso total), STAFF (equipe: animais, monitoramentos, eventos, configs), TUTOR (adotante: seus monitoramentos), USER (conta comum). A API valida roles e propriedade do recurso; a extensão `x-roles` do OpenAPI lista as roles de cada operação.',
    '- Públicos (sem token): listagem de animais, ficha por ID/UUID (QR Code), eventos e categorias, manifesto de versão do app, cadastro/login/recuperação de senha.',
    '- Limites: 100 req/min por IP (global); login 10/min, cadastro 5/min, refresh 30/min, recuperação de senha 5/min. Excesso: HTTP 429.',
    '- Nunca invente endpoints, campos ou respostas: consulte o OpenAPI. Campos não documentados no corpo são rejeitados (400).',
    '',
  ];
  for (const section of navigation) {
    lines.push(`## ${section.title}`, '');
    for (const item of section.items) {
      const doc = docs.get(item.href);
      lines.push(`- [${item.title}](${abs(item.href)})${doc?.meta.description ? `: ${doc.meta.description}` : ''}`);
    }
    lines.push('');
  }
  lines.push('## Endpoints', '');
  for (const t of tags) {
    lines.push(`### ${TAGS[t].label}`, '');
    for (const op of operations.filter((o) => o.tag === t)) lines.push(`- \`${op.method} ${shortPath(op.path)}\` — ${op.summary} (${authLabel(op)}): ${abs(opHref(op))}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function buildLlmsFull(): string {
  const docs = new Map(allDocs().map((d) => [d.href, d]));
  const out = [buildLlmsTxt(), '', '---', '', '# Documentação completa', ''];
  for (const section of navigation) {
    for (const item of section.items) {
      const doc = docs.get(item.href);
      if (!doc) continue;
      out.push(`# ${section.title} › ${doc.meta.title}`, '', `URL: ${abs(doc.href)}`, '');
      if (doc.meta.description) out.push(doc.meta.description, '');
      out.push(toPlainMarkdown(doc.body), '', '---', '');
    }
  }
  out.push('# Referência completa dos endpoints', '');
  for (const op of operations) {
    out.push(`## ${op.method} ${shortPath(op.path)} — ${op.summary}`, '', `URL: ${abs(opHref(op))}`, `Caminho completo: ${site.apiBase}${shortPath(op.path)}`, `Acesso: ${authLabel(op)}`);
    if (op.description) out.push('', op.description);
    const params = op.parameters.map((p) => `- ${p.in} \`${p.name}\`${p.required ? ' (obrigatório)' : ''}${p.description ? `: ${p.description}` : ''}`);
    if (params.length) out.push('', 'Parâmetros:', ...params);
    if (op.bodySchema) {
      out.push('', `Corpo (${op.contentTypes.join(' ou ')}):`);
      for (const r of fieldRows(op.bodySchema)) out.push(`- \`${r.name}\` ${r.type}${r.required ? ' (obrigatório)' : ''}${r.description ? ` — ${r.description}` : ''}${r.rules.length ? ` [${r.rules.join('; ')}]` : ''}`);
      const ex = requestExample(op);
      if (ex) out.push('', 'Exemplo:', '```json', JSON.stringify(ex, null, 2), '```');
    }
    const status = successStatus(op);
    const schema = op.responses[status]?.content?.['application/json']?.schema;
    if (schema) {
      out.push('', `Resposta ${status}:`);
      for (const r of fieldRows(resolve(schema)?.properties?.data)) out.push(`- \`data.${r.name}\` ${r.type}${r.description ? ` — ${r.description}` : ''}`);
      out.push('```json', JSON.stringify(exampleOf(schema), null, 2), '```');
    }
    const errors = Object.entries(op.responses).filter(([c]) => !c.startsWith('2')).map(([c, r]) => `${c} ${r.description ?? ''}`);
    out.push('', `Erros: ${errors.join('; ')}`, '', '---', '');
  }
  return out.join('\n');
}
