'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION_URL } from '@/lib/app-qr';

interface Release { versionName: string; sizeBytes: number; publishedAt: string; releaseNotes: string[] }

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Versão atual do app, lida da API a cada visita (o link de download não muda). */
export function AppVersionInfo() {
  const [release, setRelease] = useState<Release | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(APP_VERSION_URL, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => setRelease((body?.data ?? body) as Release))
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, []);

  if (failed) return <p className="text-sm text-fg-3">Sempre a versão mais recente do aplicativo.</p>;
  if (!release) return <p className="text-sm text-fg-3" aria-busy="true">Carregando a versão atual…</p>;
  return (
    <div data-testid="app-version">
      <p className="text-sm text-fg-2">
        <span className="font-semibold text-fg">Versão {release.versionName}</span>
        {' · '}{mb(release.sizeBytes)}{' · '}publicada em {date(release.publishedAt)}
      </p>
      {release.releaseNotes?.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm text-fg-2">
          {release.releaseNotes.slice(0, 4).map((n) => (
            <li key={n} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
