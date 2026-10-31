# AGENTS.md

Instruções para agentes de IA que trabalham **neste repositório** (APASBAC API + documentação).

> Vai **consumir** a APASBAC API em outro projeto? Use `documentation/ai/AGENTS.md`, publicado na documentação em `/AGENTS.md`.

## Estrutura

- `src/` — API NestJS 10 (Prisma, PostgreSQL, JWT, Cloudinary). Configuração global em `src/setup.ts`.
- `prisma/` — schema, migrations e seed.
- `test/` — testes unitários (`npm test`) e E2E com PostgreSQL real (`npm run test:e2e`, exige `E2E_DATABASE_URL` de um banco `*_test`, que é **resetado**).
- `scripts/export-openapi.ts` — gera `documentation/openapi/openapi.json` a partir dos decorators.
- `documentation/` — Developer Platform (Next.js). Veja `documentation/README.md`.

## Regras

1. Não invente funcionalidades na documentação: a referência vem do OpenAPI; páginas conceituais devem marcar o status real.
2. Ao alterar controllers ou DTOs, rode `npm run openapi:export` e versione o resultado.
3. Endpoints protegidos usam `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`; operações que alteram dados recebem `@Audited(...)`.
4. Nunca registre senhas, tokens, CPF, e-mail ou telefone em logs ou auditoria.
5. Uploads: valide com `assertImages` e use `imageUploadOptions` (limites de tamanho).
6. Preserve compatibilidade com o app Flutter (`APASBAC/apasbac-app`): envelope `{ success, data, timestamp }`, campos existentes e fluxo de refresh.

## Verificação antes de concluir

```bash
npm test && npx eslint "{src,test,scripts}/**/*.ts" && npx nest build && npm run openapi:check
E2E_DATABASE_URL=postgresql://user:pass@localhost:5432/apasbac_test npm run test:e2e
cd documentation && npm test && npm run build && npm run check:links && npm run test:e2e
```
