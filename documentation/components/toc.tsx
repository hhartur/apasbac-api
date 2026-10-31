'use client';
import { useEffect, useState } from 'react';

export interface TocItem { id: string; text: string; depth: 2 | 3 }

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-80px 0px -70% 0px' });
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;
  return (
    <nav aria-label="Nesta página" className="text-[0.82rem]">
      <p className="mb-3 font-display text-[0.78rem] font-semibold text-fg">Nesta página</p>
      <ul className="space-y-1.5 border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? 'location' : undefined}
              className={`-ml-px block border-l py-0.5 leading-snug transition-colors ${i.depth === 3 ? 'pl-6' : 'pl-3'} ${active === i.id ? 'border-primary text-primary' : 'border-transparent text-fg-3 hover:text-fg'}`}>
              {i.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
