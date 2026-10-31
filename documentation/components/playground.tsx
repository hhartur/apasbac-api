'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ApiEnvironment } from '@/lib/site';
import { buildUrl, curlFor, needsConfirmation, type PlaygroundOp } from '@/lib/playground';
import { CopyButton } from './copy-button';
import { LockIcon, WarningIcon } from './icons';
import { MethodBadge } from './ui';

interface Result { status: number; statusText: string; ms: number; headers: [string, string][]; body: string }

const input = 'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-primary';
const label = 'mb-1.5 block text-xs font-medium text-fg-2';

export function Playground({ ops, environments, initialId, selectable = false }: {
  ops: PlaygroundOp[]; environments: ApiEnvironment[]; initialId?: string; selectable?: boolean;
}) {
  const [opId, setOpId] = useState(initialId ?? ops[0]?.id);
  const op = ops.find((o) => o.id === opId) ?? ops[0];
  const [envId, setEnvId] = useState(environments[0]?.id);
  const env = environments.find((e) => e.id === envId) ?? environments[0];
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Record<string, string>>({});
  const [body, setBody] = useState(op.bodyExample ?? '');
  const [file, setFile] = useState<File | null>(null);
  // The token lives only in component memory: never written to storage, never sent anywhere but the selected API.
  const [token, setToken] = useState('');
  const [requestId, setRequestId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const selectOp = (id: string) => {
    const next = ops.find((o) => o.id === id)!;
    setOpId(id); setPathValues({}); setQuery({}); setBody(next.bodyExample ?? ''); setFile(null); setResult(null); setError(''); setConfirmed(false);
  };

  const preview = useMemo(() => {
    try { return buildUrl(env.url, op.path, pathValues, query).toString(); } catch { return `${env.url}${op.path}`; }
  }, [env, op, pathValues, query]);

  const mutation = needsConfirmation(op.method);
  const authRequired = !op.isPublic;

  async function send() {
    setError(''); setResult(null);
    let url: URL;
    try { url = buildUrl(env.url, op.path, pathValues, query); } catch (e) { setError((e as Error).message); return; }
    if (authRequired && !token.trim()) { setError('Este endpoint exige um access token.'); return; }
    if (mutation && !confirmed) { setError('Confirme que esta requisição pode alterar dados.'); return; }
    if (mutation && env.production && !window.confirm(`Executar ${op.method} ${op.path} em PRODUÇÃO? Os dados reais serão alterados.`)) return;
    const headers: Record<string, string> = {};
    if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
    if (requestId.trim()) headers['X-Request-Id'] = requestId.trim();
    let payload: BodyInit | undefined;
    if (op.contentType === 'multipart/form-data') {
      if (!file) { setError(`Selecione um arquivo para o campo "${op.fileField}".`); return; }
      const form = new FormData(); form.append(op.fileField ?? 'file', file); payload = form;
    } else if (op.contentType && body.trim()) {
      try { JSON.parse(body); } catch { setError('O corpo não é um JSON válido.'); return; }
      headers['Content-Type'] = 'application/json'; payload = body;
    }
    setBusy(true);
    const started = performance.now();
    try {
      // credentials: 'omit' — the API uses Bearer tokens; no cookies are ever sent.
      const res = await fetch(url, { method: op.method, headers, body: payload, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }
      setResult({ status: res.status, statusText: res.statusText, ms: Math.round(performance.now() - started), headers: [...res.headers.entries()], body: pretty });
    } catch (e) {
      setError(`Falha de rede: ${(e as Error).message}. Verifique se a API está acessível e se CORS_ORIGINS permite esta origem.`);
    } finally { setBusy(false); }
  }

  const tone = !result ? '' : result.status < 300 ? 'text-success bg-success-soft' : result.status < 500 ? 'text-warning bg-warning-soft' : 'text-danger bg-danger-soft';

  return (
    <section aria-label="Playground" data-testid="playground" className="not-prose overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-3">
        <MethodBadge method={op.method} />
        <code className="min-w-0 flex-1 truncate font-mono text-[0.8rem] text-fg" title={preview}>{preview}</code>
        <label className="sr-only" htmlFor="pg-env">Ambiente</label>
        <select id="pg-env" value={envId} onChange={(e) => { setEnvId(e.target.value); setConfirmed(false); }}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-fg">
          {environments.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </div>

      <div className="grid gap-4 p-4">
        {selectable && (
          <div>
            <label className={label} htmlFor="pg-op">Endpoint</label>
            <select id="pg-op" value={opId} onChange={(e) => selectOp(e.target.value)} className={input}>
              {ops.map((o) => <option key={o.id} value={o.id}>{o.method} {o.path.replace('/api/v1', '')} — {o.summary}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-fg-3">Documentação: <Link className="text-primary underline" href={op.href}>{op.summary}</Link></p>
          </div>
        )}

        {env.production && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            <WarningIcon className="mt-px shrink-0" width={14} height={14} /> Ambiente de produção: use somente consultas ou dados de teste autorizados.
          </p>
        )}

        {op.pathParams.length > 0 && (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-semibold text-fg">Parâmetros de rota</legend>
            {op.pathParams.map((p) => (
              <div key={p}>
                <label className={label} htmlFor={`pg-path-${p}`}>{p} <span className="text-danger">*</span></label>
                <input id={`pg-path-${p}`} className={input} value={pathValues[p] ?? ''} onChange={(e) => setPathValues({ ...pathValues, [p]: e.target.value })} />
              </div>
            ))}
          </fieldset>
        )}

        {op.queryParams.length > 0 && (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-semibold text-fg">Query</legend>
            {op.queryParams.map((q) => (
              <div key={q.name}>
                <label className={label} htmlFor={`pg-q-${q.name}`}>{q.name}{q.required && <span className="text-danger"> *</span>}</label>
                <input id={`pg-q-${q.name}`} className={input} placeholder={q.description?.slice(0, 40)} value={query[q.name] ?? ''}
                  onChange={(e) => setQuery({ ...query, [q.name]: e.target.value })} />
              </div>
            ))}
          </fieldset>
        )}

        {(authRequired || op.optionalAuth) && (
          <div>
            <label className={label} htmlFor="pg-token"><LockIcon className="mr-1 inline" width={12} height={12} />Access token {authRequired ? <span className="text-danger">*</span> : '(opcional)'}</label>
            <input id="pg-token" type="password" autoComplete="off" spellCheck={false} className={`${input} font-mono`} placeholder="eyJhbGciOi…"
              value={token} onChange={(e) => setToken(e.target.value)} />
            <p className="mt-1.5 text-xs text-fg-3">Mantido só na memória desta aba; some ao recarregar. {op.roles.length > 0 && <>Exige: <strong className="text-fg-2">{op.roles.join(', ')}</strong>.</>}</p>
          </div>
        )}

        {op.contentType === 'multipart/form-data' && (
          <div>
            <label className={label} htmlFor="pg-file">Arquivo ({op.fileField})</label>
            <input id="pg-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-fg-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-sm file:text-fg" />
          </div>
        )}

        {op.contentType === 'application/json' && (
          <div>
            <label className={label} htmlFor="pg-body">Corpo (JSON)</label>
            <textarea id="pg-body" rows={Math.min(14, Math.max(4, body.split('\n').length + 1))} spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-line bg-code px-3 py-2 font-mono text-[0.8rem] leading-relaxed text-fg outline-none focus:border-primary" />
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-fg-2">Headers adicionais</summary>
          <div className="mt-2">
            <label className={label} htmlFor="pg-rid">X-Request-Id (opcional, 8–64 caracteres)</label>
            <input id="pg-rid" className={`${input} font-mono`} value={requestId} onChange={(e) => setRequestId(e.target.value)} placeholder="meu-teste-0001" />
            <p className="mt-1.5 text-xs text-fg-3">Somente Authorization, Content-Type e X-Request-Id são enviados.</p>
          </div>
        </details>

        {mutation && (
          <label className="flex items-start gap-2 text-xs text-fg-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
            Entendo que esta requisição {op.method === 'DELETE' ? 'remove' : 'cria ou altera'} dados em <strong className="text-fg">{env.label}</strong>.
          </label>
        )}

        {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={send} disabled={busy} data-testid="playground-send"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast transition-colors hover:bg-primary-hover disabled:opacity-60">
            {busy ? 'Enviando…' : 'Enviar requisição'}
          </button>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-fg-3">
            Copiar cURL
            <CopyButton label="Copiar cURL" text={curlFor(op.method, preview, { auth: authRequired || !!token, json: op.contentType === 'application/json' ? body : undefined,
              fileField: op.contentType === 'multipart/form-data' ? op.fileField : undefined, requestId: requestId || undefined })} />
          </span>
        </div>
      </div>

      {result && (
        <div className="border-t border-line" aria-live="polite">
          <div className="flex items-center gap-3 px-4 py-2.5 text-xs">
            <span className={`rounded-md px-2 py-0.5 font-mono font-semibold ${tone}`}>{result.status} {result.statusText}</span>
            <span className="text-fg-3">{result.ms} ms</span>
            <CopyButton label="Copiar resposta" text={result.body} className="ml-auto" />
          </div>
          <details className="border-t border-line px-4 py-2 text-xs">
            <summary className="cursor-pointer text-fg-2">Headers da resposta ({result.headers.length})</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[0.72rem]">
              {result.headers.map(([k, v]) => <div key={k} className="contents"><dt className="text-fg-3">{k}</dt><dd className="break-all text-fg-2">{v}</dd></div>)}
            </dl>
          </details>
          <pre className="max-h-[28rem] overflow-auto border-t border-line bg-code px-4 py-3 font-mono text-[0.78rem] leading-relaxed text-fg scrollbar-thin">{result.body || '(sem corpo)'}</pre>
        </div>
      )}
    </section>
  );
}
