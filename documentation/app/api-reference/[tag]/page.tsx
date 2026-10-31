import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DocsPage } from '@/components/docs-page';
import { Badge, MethodBadge } from '@/components/ui';
import { authLabel, opHref, opsByTag, shortPath, TAGS, tagBySlug, tags } from '@/lib/openapi';

type Params = { tag: string };
export const dynamicParams = false;
export const generateStaticParams = () => tags.map((t) => ({ tag: TAGS[t].slug }));

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const tag = tagBySlug((await params).tag);
  return tag ? { title: `${TAGS[tag].label} — Referência da API`, description: TAGS[tag].description } : {};
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const slug = (await params).tag;
  const tag = tagBySlug(slug);
  if (!tag) notFound();
  const ops = opsByTag(tag);
  return (
    <DocsPage href={`/api-reference/${slug}`} title={TAGS[tag].label} description={TAGS[tag].description}
      crumbs={[{ label: 'Referência da API', href: '/api-reference' }, { label: TAGS[tag].label }]}
      badges={<Badge>{ops.length} endpoints</Badge>}
      toc={ops.map((o) => ({ id: o.slug, text: o.summary, depth: 2 as const }))}>
      <div className="space-y-4">
        {ops.map((o) => (
          <Link key={o.id} id={o.slug} href={opHref(o)} className="group block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2">
            <div className="flex flex-wrap items-center gap-3">
              <MethodBadge method={o.method} />
              <code className="font-mono text-[0.84rem] text-fg">{shortPath(o.path)}</code>
            </div>
            <p className="mt-2 font-medium text-fg group-hover:text-primary">{o.summary}</p>
            {o.description && <p className="mt-1 line-clamp-2 text-sm text-fg-2">{o.description}</p>}
            <p className="mt-2 text-xs text-fg-3">{authLabel(o)}</p>
          </Link>
        ))}
      </div>
    </DocsPage>
  );
}
