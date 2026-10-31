'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { rank, type Searchable } from '@/lib/search-score';
import { FileIcon, SearchIcon } from './icons';
import { MethodBadge } from './ui';

export function SearchButton({ compact = false }: { compact?: boolean }) {
  const open = () => window.dispatchEvent(new Event('apasbac-open-search'));
  return compact ? (
    <button type="button" onClick={open} aria-label="Pesquisar na documentação" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg">
      <SearchIcon width={17} height={17} />
    </button>
  ) : (
    <button type="button" onClick={open} data-testid="search-button"
      className="flex h-9 w-full max-w-72 items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 text-sm text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2">
      <SearchIcon />
      <span className="flex-1 text-left">Pesquisar…</span>
      <kbd className="rounded border border-line bg-surface px-1.5 font-mono text-[0.68rem]">Ctrl K</kbd>
    </button>
  );
}

export function SearchDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<Searchable[] | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const listId = useId();

  const open = useCallback(() => {
    dialog.current?.showModal();
    input.current?.select();
    if (!index) fetch('/search-index.json').then((r) => r.json()).then(setIndex).catch(() => setIndex([]));
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('apasbac-open-search', open);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('apasbac-open-search', open); };
  }, [open]);

  const results = useMemo(() => (index ? rank(index, query, 24) : []), [index, query]);
  useEffect(() => setActive(0), [query]);

  const go = (href: string) => { dialog.current?.close(); setQuery(''); router.push(href); };

  return (
    <dialog ref={dialog} aria-label="Pesquisar na documentação" data-testid="search-dialog"
      onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[#120e0d]/45 backdrop:backdrop-blur-[2px] open:flex open:items-start open:justify-center sm:pt-[12vh]">
      <div className="fade-in flex max-h-full w-full flex-col overflow-hidden border-line bg-surface shadow-[0_24px_60px_-12px_rgb(18_14_13/0.35)] sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl sm:border">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="shrink-0 text-fg-3" width={18} height={18} />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Endpoints, guias, parâmetros, erros…"
            role="combobox" aria-expanded={results.length > 0} aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && results[active]) go(results[active].href);
            }}
            className="h-14 flex-1 bg-transparent text-[0.95rem] text-fg outline-none placeholder:text-fg-3" />
          <button type="button" onClick={() => dialog.current?.close()} className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.68rem] text-fg-3">Esc</button>
        </div>
        <ul id={listId} role="listbox" className="overflow-y-auto p-2 scrollbar-thin">
          {query && index && results.length === 0 && <li className="px-3 py-8 text-center text-sm text-fg-3">Nenhum resultado para “{query}”.</li>}
          {!query && <li className="px-3 py-6 text-center text-sm text-fg-3">Digite para pesquisar em toda a documentação e na referência da API.</li>}
          {results.map((r, i) => (
            <li key={r.href + i} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseMove={() => setActive(i)} onClick={() => go(r.href)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === active ? 'bg-surface-2' : ''}`}>
                {r.method ? <MethodBadge method={r.method} size="xs" /> : <FileIcon className="shrink-0 text-fg-3" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{r.title}</span>
                  <span className="block truncate text-xs text-fg-3">{r.section}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
