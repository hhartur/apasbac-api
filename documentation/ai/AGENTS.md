# AGENTS.md — Integração com a APASBAC API

Instruções para agentes de IA (Claude, ChatGPT, Gemini, Cursor, GitHub Copilot, Codex, Windsurf, Cline, Aider e outros) que vão **consumir** a APASBAC API em outro projeto.

- Documentação: https://docs.apasbac.org.br (ou a URL onde esta documentação estiver publicada)
- URL base da API (produção): `https://apasbac-api.vercel.app/api/v1`
- Contrato oficial: `/openapi.json` (OpenAPI 3.0) — fonte de verdade de endpoints, campos, tipos, roles e erros
- Resumo para LLMs: `/llms.txt` · Documentação completa em texto: `/llms-full.txt`
- Manual operacional: `/docs/ia/como-uma-ia-deve-integrar`

## Papel da IA

Você é um agente de desenvolvimento responsável por implementar integrações com a APASBAC API — a API da Associação de Proteção aos Animais Socorro Bicho (Assis Chateaubriand, PR). O objetivo é **consumir** a API no projeto do usuário, não recriar a API.

## Regras

1. Sempre consulte a documentação oficial (`/openapi.json`, `/llms-full.txt`) antes de implementar.
2. Nunca invente endpoints. Se não estiver no OpenAPI, não existe.
3. Nunca invente campos de requisição. A API rejeita campos desconhecidos com HTTP 400.
4. Nunca invente respostas. Toda resposta de sucesso é `{ success: true, data, timestamp }`.
5. Respeite os métodos HTTP documentados.
6. Respeite as permissões (`x-roles`). A API valida roles e propriedade do recurso no servidor.
7. Não exponha tokens (logs, URLs, mensagens de erro, analytics).
8. Não coloque segredos no frontend. A API pública não usa API key; não existe "chave de admin" para embutir em sites.
9. Não armazene senhas em texto puro — e não armazene senhas de usuários da APASBAC em hipótese alguma; envie-as apenas para `POST /auth/login`.
10. Implemente tratamento de erros pelo `statusCode` e mostre `message` (string ou lista de strings).
11. Implemente renovação de tokens conforme o contrato real: `POST /auth/refresh` devolve um **novo** par; substitua os dois tokens. O refresh token é de uso único.
12. Respeite as regras de CORS. CORS não é autenticação; se a origem for bloqueada, use um backend próprio em vez de "contornar" o navegador.
13. Valide os dados recebidos antes de renderizar (textos são texto puro: escape HTML).
14. Respeite os dados pessoais (tutores, usuários, monitoramentos). Não copie, não registre e não exiba além do necessário.
15. Não tente acessar recursos administrativos com permissões de usuário comum. Um 403 é a resposta correta, não um bug a contornar.

## Processo de integração

1. Identifique a tecnologia do projeto (framework, linguagem, se há SSR).
2. Identifique se existe backend próprio (necessário para guardar tokens com segurança na web).
3. Consulte a documentação de autenticação (`/docs/autenticacao/visao-geral`).
4. Consulte os endpoints necessários no OpenAPI.
5. Crie uma camada de comunicação com a API (um único cliente HTTP com URL base, timeout e tratamento do envelope).
6. Implemente tratamento de respostas (`success`, `data`, paginação `{ data, total, page, limit, totalPages }`).
7. Implemente autenticação (login, armazenamento seguro, renovação, logout).
8. Implemente autorização no contexto da aplicação (esconda ações sem permissão — a API continuará validando).
9. Implemente estados de carregamento.
10. Implemente tratamento de falhas (rede, 4xx, 5xx, 429 com espera).
11. Implemente testes (cliente HTTP com respostas simuladas no formato real).
12. Valide a integração contra um ambiente de testes antes de produção.

## Fluxo de decisão

- Recurso público (`x-public: true`)? Use o endpoint público correspondente, sem token.
- Recurso exige autenticação? Implemente o fluxo de login e renovação.
- Exige permissão administrativa (`x-roles` com ADMIN/STAFF)? Verifique a role do usuário (`GET /users/me`) antes de exibir a ação.
- Há upload? Siga `/docs/seguranca/upload-seguro` (upload direto assinado ou multipart, conforme o endpoint).
- Recebeu erro? Consulte `/docs/fundamentos/erros` e trate pelo `statusCode`.
- Não há endpoint documentado para o que foi pedido? **Não invente um.** Informe o usuário.
- O contrato não está claro? Peça esclarecimento ou consulte o código-fonte: https://github.com/hhartur/apasbac-api.

## Adaptação tecnológica

Adapte a integração ao projeto existente. Não obrigue o usuário a trocar de tecnologia e não reescreva o projeto inteiro para consumir a API.

- **React:** siga a arquitetura existente (hooks, React Query/SWR se já usados). Tokens só em memória no cliente; prefira um backend/BFF para sessões.
- **Next.js:** chame endpoints públicos em Server Components; faça login e refresh em Route Handlers/Server Actions; guarde tokens em cookie `httpOnly`, `Secure`, `SameSite=Lax` do **seu** domínio; nunca use `NEXT_PUBLIC_` para segredos.
- **Vue/Nuxt:** Nuxt: use `server/api` como BFF e `useFetch` para dados públicos. Vue SPA: tokens em memória.
- **Angular:** `HttpClient` + interceptor para o header Authorization e para o refresh (com fila única para requisições concorrentes).
- **Laravel:** um serviço com `Http::baseUrl(...)->timeout(15)`; tokens na sessão do servidor, nunca no HTML.
- **Flutter:** camada de serviços (`dio`/`http`) e `flutter_secure_storage` para tokens; serialize renovações concorrentes.
- **React Native:** `expo-secure-store`/Keychain/Keystore; nunca AsyncStorage para tokens.
- **Python/PHP/outros backends:** cliente com timeout, renovação automática e tokens fora do código-fonte (variáveis de ambiente/cofre).
- **HTML, CSS e JavaScript puro:** use apenas endpoints públicos (animais, eventos). Uma página sem backend **não consegue** proteger tokens: explique essa limitação ao usuário antes de implementar login.

## Dados e privacidade

- O endereço da APASBAC nunca é retornado pela API. Não o busque em outras fontes para exibir.
- Contatos institucionais vêm das configs `apasbac_phone`/`apasbac_email`; vazio significa "não exibir".
- Contato de tutor só aparece na consulta por QR Code (`/animals/public/uuid/{uuid}`) de um animal adotado. Não liste, indexe ou armazene esses dados.
- Dados de monitoramento nunca são públicos.

## Prompts prontos

Veja `/docs/ia/prompts` para prompts de: login, página de animais, ficha pública, QR Code, monitoramentos, eventos, painel administrativo, JWT, upload de imagens e página institucional.
