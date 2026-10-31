import Link from 'next/link';
import type { ReactNode } from 'react';
import { neighbours } from '@/lib/navigation';
import { site } from '@/lib/site';
import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon } from './icons';
import { Toc, type TocItem } from './toc';

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Trilha" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-[0.8rem] text-fg-3">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon width={13} height={13} />}
            {c.href ? <Link href={c.href} className="hover:text-fg">{c.label}</Link> : <span aria-current="page" className="text-primary">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Center column + "on this page" column shared by every documentation page. */
export function DocsPage({ href, crumbs, title, description, badges, toc, children }: {
  href: string; crumbs: { label: string; href?: string }[]; title: string; description?: string;
  badges?: ReactNode; toc: TocItem[]; children: ReactNode;
}) {
  const { prev, next } = neighbours(href);
  return (
    <div className="flex gap-10">
      <article id="conteudo" className="fade-in min-w-0 flex-1 pb-20 pt-8 lg:pt-10">
        <Breadcrumbs items={crumbs} />
        <h1 className="font-display text-[1.95rem] font-bold leading-tight tracking-[-0.025em] text-fg sm:text-[2.2rem]">{title}</h1>
        {description && <p className="mt-3 max-w-[46rem] text-[1.05rem] leading-relaxed text-fg-2">{description}</p>}
        {badges && <div className="mt-4 flex flex-wrap items-center gap-2">{badges}</div>}
        <div className="mt-8">{children}</div>
        <div className="mt-16 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={prev.href} className="group rounded-xl border border-line p-4 transition-colors hover:border-line-strong">
              <span className="flex items-center gap-1 text-xs text-fg-3"><ArrowLeftIcon width={13} height={13} /> Anterior</span>
              <span className="mt-1 block font-medium text-fg group-hover:text-primary">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={next.href} className="group rounded-xl border border-line p-4 text-right transition-colors hover:border-line-strong">
              <span className="flex items-center justify-end gap-1 text-xs text-fg-3">Próximo <ArrowRightIcon width={13} height={13} /></span>
              <span className="mt-1 block font-medium text-fg group-hover:text-primary">{next.title}</span>
            </Link>
          )}
        </div>
        <p className="mt-8 text-xs text-fg-3">
          Algo incorreto? <a className="underline hover:text-fg" href={`${site.github}/issues/new`} target="_blank" rel="noopener noreferrer">Abra uma issue no GitHub</a>.
        </p>
      </article>
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto py-10 scrollbar-thin xl:block">
        <Toc items={toc} />
      </aside>
    </div>
  );
}
