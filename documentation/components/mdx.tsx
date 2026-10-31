import Link from 'next/link';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import { slugifyHeading } from '@/lib/content';
import { highlight } from '@/lib/highlight';
import { Badge, Callout, Card, Cards, Endpoint, Status, Step, Steps, TableWrap } from './ui';
import { CodeBlock } from './code-block';
import { CodeTabs } from './code-tabs';

const text = (node: ReactNode): string =>
  typeof node === 'string' || typeof node === 'number' ? String(node)
    : Array.isArray(node) ? node.map(text).join('')
    : isValidElement(node) ? text((node.props as { children?: ReactNode }).children) : '';

function heading(Tag: 'h2' | 'h3') {
  return function Heading({ children }: { children?: ReactNode }) {
    const id = slugifyHeading(text(children));
    return <Tag id={id}>{children}<a href={`#${id}`} className="heading-anchor no-prose" aria-label="Link para esta seção">#</a></Tag>;
  };
}

/** Code fence: <pre><code class="language-x">…</code></pre> */
function fence(props: { children?: ReactNode }) {
  const code = Children.only(props.children) as ReactElement<{ className?: string; children?: ReactNode }>;
  return { code: text(code.props.children), lang: code.props.className?.replace('language-', '') ?? 'text' };
}

function Pre(props: { children?: ReactNode }) {
  const { code, lang } = fence(props);
  return <CodeBlock code={code} lang={lang} />;
}

async function CodeGroup({ titles, title, children }: { titles: string; title?: string; children: ReactNode }) {
  const labels = titles.split(',').map((t) => t.trim());
  const blocks = Children.toArray(children).filter(isValidElement).map((c) => fence((c as ReactElement<{ children?: ReactNode }>).props));
  const tabs = await Promise.all(blocks.map(async (b, i) => ({ label: labels[i] ?? b.lang, code: b.code, html: await highlight(b.code, b.lang) })));
  return <CodeTabs tabs={tabs} title={title} />;
}

function A({ href = '', children }: { href?: string; children?: ReactNode }) {
  if (href.startsWith('/') || href.startsWith('#')) return <Link href={href}>{children}</Link>;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const components = {
  h2: heading('h2'), h3: heading('h3'), pre: Pre, a: A,
  table: ({ children }: { children?: ReactNode }) => <TableWrap>{children}</TableWrap>,
  Callout, Cards, Card, Steps, Step, Status, Endpoint, Badge, CodeGroup,
};

export async function Mdx({ source }: { source: string }) {
  const { content } = await compileMDX({ source, components, options: { parseFrontmatter: false, blockJS: true, mdxOptions: { remarkPlugins: [remarkGfm] } } });
  return <div className="prose-docs">{content}</div>;
}
