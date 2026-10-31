'use client';
import { useRef } from 'react';
import type { NavSection } from '@/lib/navigation';
import { CloseIcon, MenuIcon } from './icons';
import { SidebarNav, type SidebarOps } from './sidebar';

export function MobileNav({ sections, ops }: { sections: NavSection[]; ops: SidebarOps }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Abrir menu" data-testid="mobile-menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg lg:hidden">
        <MenuIcon width={19} height={19} />
      </button>
      <dialog ref={dialog} aria-label="Menu de navegação" onClick={(e) => { if (e.target === dialog.current) close(); }}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[#120e0d]/45 lg:hidden">
        <div className="fade-in flex h-full w-[min(20rem,86vw)] flex-col border-r border-line bg-bg">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="font-display font-semibold text-fg">Navegação</span>
            <button type="button" onClick={close} aria-label="Fechar menu" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2">
              <CloseIcon width={18} height={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-5 scrollbar-thin">
            <SidebarNav sections={sections} ops={ops} onNavigate={close} />
          </div>
        </div>
      </dialog>
    </>
  );
}
