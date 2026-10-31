// Pure request-building rules of the playground (unit-tested). The browser calls the API directly:
// there is no proxy, so the docs server can never be used to reach arbitrary hosts.
export interface PlaygroundOp {
  id: string; method: string; path: string; summary: string; roles: string[]; isPublic: boolean; optionalAuth: boolean;
  pathParams: string[]; queryParams: { name: string; required: boolean; description?: string }[];
  contentType?: string; bodyExample?: string; fileField?: string; href: string;
}

export const ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'X-Request-Id'];

export function buildUrl(envUrl: string, path: string, pathValues: Record<string, string>, query: Record<string, string>): URL {
  const base = new URL(envUrl);
  const filled = path.replace(/\{(\w+)\}/g, (_, n) => {
    const v = (pathValues[n] ?? '').trim();
    if (!v) throw new Error(`Informe o parâmetro de rota "${n}".`);
    return encodeURIComponent(v);
  });
  const url = new URL(filled, base);
  for (const [k, v] of Object.entries(query)) if (v.trim() !== '') url.searchParams.set(k, v.trim());
  // Defense in depth: the final URL must stay on the selected environment origin.
  if (url.origin !== base.origin) throw new Error('Destino fora do ambiente selecionado.');
  return url;
}

export function curlFor(method: string, url: string, opts: { auth: boolean; json?: string; fileField?: string; requestId?: string }) {
  const lines = [`curl -X ${method} "${url}"`];
  if (opts.auth) lines.push('  -H "Authorization: Bearer $APASBAC_ACCESS_TOKEN"');
  if (opts.requestId) lines.push(`  -H "X-Request-Id: ${opts.requestId}"`);
  if (opts.fileField) lines.push(`  -F "${opts.fileField}=@./imagem.jpg"`);
  else if (opts.json?.trim()) lines.push('  -H "Content-Type: application/json"', `  -d '${opts.json.replace(/'/g, "'\\''")}'`);
  return lines.join(' \\\n');
}

export const needsConfirmation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
