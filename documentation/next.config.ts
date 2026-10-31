import type { NextConfig } from 'next';
import { apiEnvironments } from './lib/site';

const dev = process.env.NODE_ENV !== 'production';
// The playground may only reach the configured API environments: connect-src is the browser-level allowlist.
const apiOrigins = apiEnvironments().map((e) => e.url).join(' ');

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigins}${dev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  // The API's package-lock.json sits one level up; the docs app is its own project root.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
      {
        // Machine-readable files for any integration tool or AI agent.
        source: '/:file(openapi.json|llms.txt|llms-full.txt|AGENTS.md)',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
    ];
  },
};

export default config;
