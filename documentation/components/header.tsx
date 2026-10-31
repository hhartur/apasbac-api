import Image from 'next/image';
import Link from 'next/link';
import { navigation, tagOperationsNav } from '@/lib/navigation';
import { TAGS, tags } from '@/lib/openapi';
import { site } from '@/lib/site';
import { GithubIcon } from './icons';
import { MobileNav } from './mobile-nav';
import { SearchButton, SearchDialog } from './search-dialog';
import { ThemeToggle } from './theme-toggle';
import type { SidebarOps } from './sidebar';

export function sidebarOps(): SidebarOps {
  return Object.fromEntries(tags.map((t) => [`/api-reference/${TAGS[t].slug}`, tagOperationsNav(t)]));
}

const LINKS = [
  { href: '/docs/inicio/introducao', label: 'Documentação' },
  { href: '/api-reference', label: 'Referência da API' },
  { href: '/docs/guias/javascript', label: 'Guias' },
  { href: '/docs/ia/como-uma-ia-deve-integrar', label: 'IA' },
  { href: '/playground', label: 'Playground' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">Pular para o conteúdo</a>
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
        <MobileNav sections={navigation} ops={sidebarOps()} />
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="APASBAC Developer Platform — início">
          <Image src="/logo/apasbac-logo.png" alt="APASBAC — Socorro Bicho" width={360} height={182} priority className="h-9 w-auto" />
          <span className="hidden border-l border-line pl-3 font-display text-[0.92rem] font-semibold leading-tight text-fg sm:block">
            Developer Platform
          </span>
        </Link>
        <nav aria-label="Principal" className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-2.5 py-1.5 text-sm text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden w-64 md:block"><SearchButton /></div>
          <div className="md:hidden"><SearchButton compact /></div>
          <span className="hidden rounded-md border border-line px-2 py-1 font-mono text-[0.7rem] text-fg-3 xl:inline">v{site.apiVersion}</span>
          <ThemeToggle />
          <a href={site.github} target="_blank" rel="noopener noreferrer" aria-label="Repositório no GitHub"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
            <GithubIcon width={18} height={18} />
          </a>
        </div>
      </div>
      <SearchDialog />
    </header>
  );
}

