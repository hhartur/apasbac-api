import {
  authLabel, errorStatuses, exampleOf, fieldRows, resolve, shortPath, successStatus, typeLabel,
  type FieldRow, type Operation, type Parameter,
} from '@/lib/openapi';
import { buildSnippets } from '@/lib/snippets';
import { highlight } from '@/lib/highlight';
import { apiEnvironments } from '@/lib/site';
import { toPlaygroundOp } from '@/lib/playground-ops';
import { CodeBlock } from './code-block';
import { CodeTabs } from './code-tabs';
import { Playground } from './playground';
import { Badge, Callout, MethodBadge } from './ui';
import { CopyButton } from './copy-button';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <h2 id={id} className="mb-4 font-display text-[1.15rem] font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Fields({ rows }: { rows: { name: string; type: string; required: boolean; description?: string; rules: string[] }[] }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {rows.map((r) => (
        <li key={r.name} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-[0.84rem] font-semibold text-fg">{r.name}</code>
            <span className="font-mono text-xs text-fg-3">{r.type}</span>
            {r.required ? <Badge tone="danger">obrigatório</Badge> : <Badge>opcional</Badge>}
          </div>
          {r.description && <p className="mt-1 text-sm leading-relaxed text-fg-2">{r.description}</p>}
          {r.rules.length > 0 && <p className="mt-1 text-xs text-fg-3">{r.rules.join(' · ')}</p>}
        </li>
      ))}
    </ul>
  );
}

const paramRows = (ps: Parameter[]): FieldRow[] => ps.map((p) => {
  const s = resolve(p.schema) ?? {};
  const rules = [s.enum && `valores: ${s.enum.join(', ')}`, s.minimum !== undefined && `mín. ${s.minimum}`, s.maximum !== undefined && `máx. ${s.maximum}`,
    s.default !== undefined && `padrão: ${JSON.stringify(s.default)}`, s.format && `formato ${s.format}`].filter(Boolean) as string[];
  return { name: p.name, type: typeLabel(p.schema), required: !!p.required, description: p.description, rules };
});

export const endpointToc = (op: Operation) => [
  { id: 'autenticacao', text: 'Autenticação', depth: 2 as const },
  ...(op.parameters.some((p) => p.in === 'path') ? [{ id: 'parametros-de-rota', text: 'Parâmetros de rota', depth: 2 as const }] : []),
  ...(op.parameters.some((p) => p.in === 'query') ? [{ id: 'query', text: 'Query parameters', depth: 2 as const }] : []),
  ...(op.bodySchema ? [{ id: 'corpo', text: 'Corpo da requisição', depth: 2 as const }] : []),
  { id: 'exemplos', text: 'Exemplos de requisição', depth: 2 as const },
  { id: 'resposta', text: 'Resposta', depth: 2 as const },
  { id: 'erros', text: 'Erros', depth: 2 as const },
  { id: 'playground', text: 'Playground', depth: 2 as const },
];

export async function EndpointReference({ op }: { op: Operation }) {
  const snippets = buildSnippets(op);
  const tabs = await Promise.all(snippets.map(async (s) => ({ label: s.label, code: s.code, html: await highlight(s.code, s.lang) })));
  const status = successStatus(op);
  const success = op.responses[status];
  const schema = success?.content?.['application/json']?.schema;
  const dataSchema = resolve(schema)?.properties?.data;
  const responseExample = schema ? exampleOf(schema) : undefined;
  const pathParams = op.parameters.filter((p) => p.in === 'path');
  const queryParams = op.parameters.filter((p) => p.in === 'query');
  const bodyRows = fieldRows(op.bodySchema);
  const dataRows = fieldRows(dataSchema);
  const full = `https://apasbac-api.vercel.app${op.path}`;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface-2/60 px-3 py-2.5">
        <MethodBadge method={op.method} />
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-fg" title={full}>{shortPath(op.path)}</code>
        <CopyButton text={full} label="Copiar URL" />
      </div>

      <Section id="autenticacao" title="Autenticação">
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
          {op.isPublic ? <Badge tone="success">{authLabel(op)}</Badge> : <Badge tone="primary">{authLabel(op)}</Badge>}
          {op.roles.map((r) => <Badge key={r}>{r}</Badge>)}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-fg-2">
          {!op.isPublic && <li>Header <code className="font-mono text-[0.82rem] text-fg">Authorization: Bearer &lt;accessToken&gt;</code></li>}
          {op.optionalAuth && <li>Token opcional: sem ele a resposta é a versão pública; um token inválido retorna 401.</li>}
          {op.contentTypes.length > 0 && <li>Header <code className="font-mono text-[0.82rem] text-fg">Content-Type: {op.contentTypes.join(' ou ')}</code></li>}
          <li>Header opcional <code className="font-mono text-[0.82rem] text-fg">X-Request-Id</code> para correlacionar logs e auditoria.</li>
        </ul>
      </Section>

      {pathParams.length > 0 && <Section id="parametros-de-rota" title="Parâmetros de rota"><Fields rows={paramRows(pathParams)} /></Section>}
      {queryParams.length > 0 && <Section id="query" title="Query parameters"><Fields rows={paramRows(queryParams)} /></Section>}
      {op.bodySchema && (
        <Section id="corpo" title="Corpo da requisição">
          {op.contentTypes.includes('multipart/form-data') && (
            <div className="mb-3"><Callout type="info" title="Upload de arquivos">Envie <code>multipart/form-data</code>. Imagens: JPEG, PNG ou WebP, até 8 MB cada; o conteúdo real do arquivo é verificado.</Callout></div>
          )}
          {bodyRows.length ? <Fields rows={bodyRows} /> : <p className="text-sm text-fg-2">Campo de arquivo conforme descrito acima.</p>}
          <p className="mt-3 text-xs text-fg-3">Campos não listados são rejeitados com 400 (proteção contra mass assignment).</p>
        </Section>
      )}

      <Section id="exemplos" title="Exemplos de requisição">
        <CodeTabs tabs={tabs} title="Requisição" />
      </Section>

      <Section id="resposta" title={`Resposta ${status}`}>
        {success?.description && <p className="mb-3 text-sm text-fg-2">{success.description}</p>}
        {responseExample !== undefined ? (
          <>
            <CodeBlock code={JSON.stringify(responseExample, null, 2)} lang="json" title={`${status} application/json`} />
            {dataRows.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-medium text-fg">Campos de <code className="font-mono">data</code></p><Fields rows={dataRows} /></div>}
          </>
        ) : <p className="text-sm text-fg-2">Sem corpo de resposta.</p>}
      </Section>

      <Section id="erros" title="Erros">
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {errorStatuses(op).map(([code, r]) => (
            <li key={code} className="flex gap-4 px-4 py-2.5">
              <code className={`w-10 shrink-0 font-mono font-semibold ${code.startsWith('5') ? 'text-danger' : 'text-warning'}`}>{code}</code>
              <span className="text-fg-2">{r.description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-3">Formato: <code className="font-mono">{'{ success: false, statusCode, error, message, timestamp, path, requestId }'}</code>. Veja <a className="text-primary underline" href="/docs/fundamentos/erros">Tratamento de erros</a>.</p>
      </Section>

      <Section id="playground" title="Playground">
        <Playground ops={[toPlaygroundOp(op)]} environments={apiEnvironments()} />
      </Section>
    </div>
  );
}
