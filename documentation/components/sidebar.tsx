'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { NavSection } from '@/lib/navigation';
import { MethodBadge } from './ui';

export type SidebarOps = Record<string, { title: string; href: string; method: string }[]>;

export function SidebarNav({ sections, ops, onNavigate }: { sections: NavSection[]; ops: SidebarOps; onNavigate?: () => void }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);

  // Keeps the current page visible when the sidebar is longer than the viewport.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);

  return (
    <nav ref={nav} aria-label="Documentação" className="space-y-7 text-[0.875rem]">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 font-display text-[0.78rem] font-semibold tracking-[0.01em] text-fg">{section.title}</p>
          <ul className="space-y-px">
            {section.items.map((item) => {
              const current = pathname === item.href;
              const inside = pathname.startsWith(item.href + '/');
              const children = ops[item.href];
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} aria-current={current ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-[0.4rem] transition-colors ${current ? 'bg-primary-soft font-medium text-primary' : inside ? 'font-medium text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`}>
                    {item.title}
                  </Link>
                  {children && (current || inside) && (
                    <ul className="my-1 ml-3 space-y-px border-l border-line pl-2">
                      {children.map((op) => {
                        const active = pathname === op.href;
                        return (
                          <li key={op.href}>
                            <Link href={op.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                              className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-[0.82rem] leading-snug transition-colors ${active ? 'bg-primary-soft text-primary' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`}>
                              <MethodBadge method={op.method} size="xs" />
                              <span className="min-w-0">{op.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
