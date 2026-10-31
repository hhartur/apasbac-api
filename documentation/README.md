# APASBAC Developer Platform

Documentação oficial da APASBAC API: guias, referência gerada do OpenAPI, playground, busca e arquivos para agentes de IA (`/llms.txt`, `/llms-full.txt`, `/AGENTS.md`, `/openapi.json`).

Next.js 16 (App Router, páginas estáticas) · TypeScript · Tailwind CSS 4 · MDX (`next-mdx-remote`) · Shiki.

## Estrutura

```
documentation/
├── app/                  rotas (home, /docs/[...slug], /api-reference, /playground, llms.txt, AGENTS.md, sitemap, robots)
├── components/           design system (header, sidebar, busca, tabs de código, playground, callouts…)
├── content/              páginas em MDX, uma pasta por seção da navegação
├── lib/                  openapi, snippets, navegação, busca, llms, playground (lógica pura, testada)
├── ai/AGENTS.md          instruções para agentes de IA (servido em /AGENTS.md)
├── openapi/openapi.json  especificação gerada pela API (fonte da referência)
├── public/               logo oficial, openapi.json público
├── assets/               logo original (fonte dos ícones gerados)
├── scripts/              build-assets, check-links, screenshot
└── tests/                unit (node:test + tsx) e e2e (Playwright)
```

## Rodando localmente

```bash
cd documentation
npm install
npm run dev          # http://localhost:3000 (use -p 3001 se a API estiver na 3000)
```

## Sincronizando com a API

A referência, a busca e os arquivos de IA são gerados de `openapi/openapi.json`. Depois de alterar endpoints ou DTOs na API:

```bash
# na raiz do repositório
npm run openapi:export   # atualiza documentation/openapi/openapi.json e documentation/public/openapi.json
```

O CI da API roda `npm run openapi:check` e falha se o arquivo versionado estiver desatualizado.

## Variáveis de ambiente

| Variável | Uso | Padrão |
| --- | --- | --- |
| `NEXT_PUBLIC_DOCS_URL` | URL pública da documentação (sitemap, canonical, links absolutos em llms.txt) | `http://localhost:3001` |
| `NEXT_PUBLIC_PLAYGROUND_ENVIRONMENTS` | JSON com os destinos permitidos do playground. O primeiro é o padrão (use um ambiente de testes) | Local (`http://localhost:3000`) e Produção |

Exemplo: `NEXT_PUBLIC_PLAYGROUND_ENVIRONMENTS='[{"id":"staging","label":"Staging","url":"https://staging-api.exemplo.org"},{"id":"production","label":"Produção","url":"https://apasbac-api.vercel.app","production":true}]'`

Os destinos também entram no `connect-src` da Content-Security-Policy: o navegador bloqueia qualquer outro host.

## Testes

```bash
npm test               # unit: OpenAPI, snippets, navegação, conteúdo, busca, llms, playground
npx tsc --noEmit
npm run build
npm run check:links    # links internos e âncoras de todas as páginas geradas
npx playwright install chromium
npm run test:e2e       # navegação, busca, tema, mobile, playground, headers, acessibilidade (desktop + mobile)
```

## Publicação

**Padrão: no mesmo projeto da API.** O `npm run build` da raiz executa `scripts/build-docs.mjs`, que gera o export estático (`DOCS_EXPORT=1`, `output: 'export'`) e copia para `public/`. Na Vercel, `public/**` é servido pelo CDN na raiz do domínio da API; localmente e em Docker, o Nest serve a mesma pasta. Headers de segurança vêm do helmet (API) e do `vercel.json` (CDN). `npm run docs:build` refaz só a documentação.

**Alternativa: projeto separado** (não reinicia a API ao publicar a documentação):

**Vercel (recomendado)**

1. Novo projeto apontando para este repositório, com **Root Directory** = `documentation`.
2. Framework: Next.js (detectado). Build `npm run build`.
3. Variáveis: `NEXT_PUBLIC_DOCS_URL=https://docs.apasbac.org.br` (e, se houver, `NEXT_PUBLIC_PLAYGROUND_ENVIRONMENTS`).
4. Domínio: em *Settings › Domains* adicione `docs.apasbac.org.br` e crie no DNS do domínio um `CNAME docs → cname.vercel-dns.com`. HTTPS é emitido automaticamente.
5. Na API, se `CORS_ORIGINS` estiver definido, inclua a origem da documentação para o playground funcionar.

> O domínio `docs.apasbac.org.br` é um exemplo: não presuma que ele já está configurado.

**Outro provedor (Node 20+)**: `npm ci && npm run build && npm start -p 3000`. Os headers de segurança vêm de `next.config.ts` e funcionam em qualquer hospedagem Node.

SEO incluído: metadata por página, Open Graph, `sitemap.xml`, `robots.txt`, favicon e ícone Apple derivados da logo oficial (`npm run assets`).
