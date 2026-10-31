import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsPage } from '@/components/docs-page';
import { EndpointReference, endpointToc } from '@/components/endpoint';
import { Badge } from '@/components/ui';
import { findOperation, operations, shortPath, TAGS } from '@/lib/openapi';

type Params = { tag: string; operation: string };
export const dynamicParams = false;
export const generateStaticParams = () => operations.map((o) => ({ tag: o.tagSlug, operation: o.slug }));

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const op = findOperation(p.tag, p.operation);
  return op ? { title: `${op.method} ${shortPath(op.path)} — ${op.summary}`, description: op.description ?? op.summary } : {};
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const p = await params;
  const op = findOperation(p.tag, p.operation);
  if (!op) notFound();
  const tagLabel = TAGS[op.tag]?.label ?? op.tag;
  return (
    <DocsPage href={`/api-reference/${op.tagSlug}`} title={op.summary} description={op.description}
      crumbs={[{ label: 'Referência da API', href: '/api-reference' }, { label: tagLabel, href: `/api-reference/${op.tagSlug}` }, { label: op.summary }]}
      badges={<><Badge tone="success">Implementado</Badge>{op.isPublic ? <Badge tone="success">Público</Badge> : <Badge tone="primary">Requer autenticação</Badge>}</>}
      toc={endpointToc(op)}>
      <EndpointReference op={op} />
    </DocsPage>
  );
}
