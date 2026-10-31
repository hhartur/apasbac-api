'use client';
import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';

export const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    // Marks the page as interactive (the header is on every page); E2E tests wait for it before clicking.
    document.documentElement.dataset.hydrated = '1';
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} title="Alternar tema" data-testid="theme-toggle"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
      {dark ? <SunIcon width={17} height={17} /> : <MoonIcon width={17} height={17} />}
    </button>
  );
}
