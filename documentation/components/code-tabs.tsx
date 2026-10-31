'use client';
import { useEffect, useId, useState } from 'react';
import { CopyButton } from './copy-button';

export interface CodeTab { label: string; html: string; code: string }

const KEY = 'apasbac-docs-lang';
const EVENT = 'apasbac-lang-change';

/** Language tabs; the chosen language is remembered (a UI preference, never credentials) and synced across blocks. */
export function CodeTabs({ tabs, title }: { tabs: CodeTab[]; title?: string }) {
  const [active, setActive] = useState(0);
  const id = useId();

  useEffect(() => {
    const apply = () => {
      const saved = localStorage.getItem(KEY);
      const i = tabs.findIndex((t) => t.label === saved);
      if (i >= 0) setActive(i);
    };
    apply();
    window.addEventListener(EVENT, apply);
    return () => window.removeEventListener(EVENT, apply);
  }, [tabs]);

  const select = (i: number) => {
    setActive(i);
    localStorage.setItem(KEY, tabs[i].label);
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="not-prose overflow-hidden rounded-xl border border-line bg-code">
      <div className="flex items-center gap-1 border-b border-line pr-2">
        {title && <span className="hidden shrink-0 border-r border-line px-4 font-mono text-xs text-fg-3 sm:block">{title}</span>}
        <div role="tablist" aria-label="Linguagem" className="flex min-w-0 flex-1 overflow-x-auto scrollbar-thin px-2"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const n = (active + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
            select(n);
            document.getElementById(`${id}-tab-${n}`)?.focus();
          }}>
          {tabs.map((t, i) => (
            <button key={t.label} id={`${id}-tab-${i}`} role="tab" type="button" aria-selected={i === active} aria-controls={`${id}-panel`}
              tabIndex={i === active ? 0 : -1} onClick={() => select(i)}
              className={`relative h-10 shrink-0 px-2.5 text-[0.8rem] font-medium transition-colors ${i === active ? 'text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-primary' : 'text-fg-3 hover:text-fg-2'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={tabs[active].code} />
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="scrollbar-thin"
        dangerouslySetInnerHTML={{ __html: tabs[active].html }} />
    </div>
  );
}
