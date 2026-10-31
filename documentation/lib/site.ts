import spec from '../openapi/openapi.json';

export const site = {
  name: 'APASBAC',
  fullName: 'Associação de Proteção aos Animais Socorro Bicho',
  location: 'Assis Chateaubriand, Paraná, Brasil',
  title: 'APASBAC Developer Platform',
  description:
    'Documentação oficial da APASBAC API. Descubra recursos, consulte dados, integre funcionalidades e desenvolva experiências conectadas à associação.',
  url: (process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3001').replace(/\/$/, ''),
  github: 'https://github.com/hhartur/apasbac-api',
  apiVersion: spec.info.version,
  apiBase: 'https://apasbac-api.vercel.app/api/v1',
  openapiUrl: '/openapi.json',
};

export interface ApiEnvironment { id: string; label: string; url: string; production?: boolean }

/**
 * Playground destinations. Only these origins can be called (also enforced by the CSP connect-src).
 * Override with NEXT_PUBLIC_PLAYGROUND_ENVIRONMENTS='[{"id":"staging","label":"Staging","url":"https://..."}]'.
 * The first entry is the default and should be a test environment.
 */
export function apiEnvironments(): ApiEnvironment[] {
  const raw = process.env.NEXT_PUBLIC_PLAYGROUND_ENVIRONMENTS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ApiEnvironment[];
      if (Array.isArray(parsed) && parsed.every((e) => e.id && e.label && /^https?:\/\/[^/]+$/.test(e.url))) return parsed;
    } catch { /* invalid JSON falls back to the defaults */ }
  }
  return [
    { id: 'local', label: 'Local (testes)', url: 'http://localhost:3000' },
    { id: 'production', label: 'Produção', url: 'https://apasbac-api.vercel.app', production: true },
  ];
}
