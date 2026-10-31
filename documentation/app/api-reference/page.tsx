import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsPage } from '@/components/docs-page';
import { Badge, Callout, MethodBadge } from '@/components/ui';
import { CodeBlock } from '@/components/code-block';
import { document, operations, opHref, opsByTag, shortPath, TAGS, tags } from '@/lib/openapi';

export const metadata: Metadata = { title: 'Referência da API', description: 'Todos os endpoints da APASBAC API, gerados a partir da especificação OpenAPI.' };

export default function Page() {
  const publicCount = operations.filter((o) => o.isPublic).length;
  return (
    <DocsPage href="/api-reference" title="Referência da API" crumbs={[{ label: 'Referência da API' }]}
      description="Cada página desta seção é gerada a partir da especificação OpenAPI exportada do código da API. Se um endpoint não está aqui, ele não existe."
      badges={<><Badge tone="primary">OpenAPI {document.info.version}</Badge><Badge>{operations.length} operações</Badge><Badge tone="success">{publicCount} públicas</Badge></>}
      toc={tags.map((t) => ({ id: TAGS[t].slug, text: TAGS[t].label, depth: 2 as const }))}>
      <div className="space-y-6">
        <CodeBlock title="URL base (produção)" lang="text" code="https://apasbac-api.vercel.app/api/v1" />
        <Callout type="info" title="Especificação">
          Baixe <a href="/openapi.json">/openapi.json</a> (OpenAPI 3.0) para gerar clientes, importar no Postman/Insomnia ou fornecer a agentes de IA.
          As extensões <code>x-public</code> e <code>x-roles</code> indicam acesso público e roles exigidas.
        </Callout>
      </div>
      {tags.map((t) => (
        <section key={t} className="mt-12" aria-labelledby={TAGS[t].slug}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id={TAGS[t].slug} className="font-display text-[1.25rem] font-semibold text-fg">
              <Link href={`/api-reference/${TAGS[t].slug}`} className="hover:text-primary">{TAGS[t].label}</Link>
            </h2>
            <span className="text-xs text-fg-3">{opsByTag(t).length} endpoints</span>
          </div>
          <p className="mb-4 text-sm text-fg-2">{TAGS[t].description}</p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {opsByTag(t).map((o) => (
              <li key={o.id}>
                <Link href={opHref(o)} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
                  <MethodBadge method={o.method} />
                  <code className="min-w-0 shrink-0 font-mono text-[0.8rem] text-fg sm:w-72 sm:truncate">{shortPath(o.path)}</code>
                  <span className="hidden min-w-0 flex-1 truncate text-sm text-fg-2 md:block">{o.summary}</span>
                  {o.isPublic ? <Badge tone="success">público</Badge> : o.roles.length ? <Badge>{o.roles.join(' · ')}</Badge> : <Badge tone="primary">autenticado</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </DocsPage>
  );
}
