import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsPage } from '@/components/docs-page';
import { Mdx } from '@/components/mdx';
import { Status } from '@/components/ui';
import { allDocs, getDoc, headings } from '@/lib/content';
import { sectionOf } from '@/lib/navigation';

type Params = { slug: string[] };

export const dynamicParams = false;
export const generateStaticParams = () => allDocs().map((d) => ({ slug: d.slug }));

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  if (!doc) return {};
  return { title: doc.meta.title, description: doc.meta.description, alternates: { canonical: doc.href }, openGraph: { title: doc.meta.title, description: doc.meta.description } };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();
  const section = sectionOf(doc.href) ?? 'Documentação';
  return (
    <DocsPage href={doc.href} title={doc.meta.title} description={doc.meta.description}
      crumbs={[{ label: 'Documentação', href: '/docs/inicio/introducao' }, { label: section }, { label: doc.meta.title }]}
      badges={doc.meta.status ? <Status value={doc.meta.status} /> : undefined}
      toc={headings(doc.body)}>
      <Mdx source={doc.body} />
    </DocsPage>
  );
}
