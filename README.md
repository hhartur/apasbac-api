# 🐾 APASBAC API

API oficial da **APASBAC** — Associação de Proteção aos Animais Socorro Bicho Assis Chateaubriand, PR.

- **Developer Platform** (documentação, referência, playground, arquivos para IA): pasta [`documentation/`](documentation/README.md)
- **OpenAPI**: `GET /openapi.json` na API e `documentation/openapi/openapi.json`
- **Swagger UI**: `/docs`
- Política de versões Android, HTTP 426 e telemetria de atualização: [documentação](docs/APP_VERSION.md)

---

## 🚀 Tecnologias

- **NestJS 10** + TypeScript
- **Prisma ORM** + PostgreSQL
- **JWT** (Access + Refresh Token com rotação)
- **Cloudinary** (fotos, vídeos e QR Codes) — o README antigo citava Cloudflare R2, mas o código usa Cloudinary
- **Google Sheets API** (serviço de planilha de monitoramento; ver limitações abaixo)
- **Nodemailer** (e-mails transacionais)
- **QRCode** (geração por animal)
- **helmet**, **@nestjs/throttler** (headers de segurança e rate limiting)
- **Swagger** com CSS personalizado (vermelho APASBAC)
- **Docker Compose** (ambiente local completo)

---

## 🐳 Rodando com Docker (recomendado para testes)

```bash
# 1. Copie o env de exemplo para Docker
cp .env.example .env.docker
# Edite .env.docker com suas credenciais (Cloudinary, SMTP, etc.)

# 2. Suba os containers
docker compose up -d

# 3. Execute o seed (cria admin local + configs padrão + categorias de eventos)
docker compose exec api npm run prisma:seed

# 4. Acesse
#    API:     http://localhost:3000/api/v1
#    Swagger: http://localhost:3000/docs
#    OpenAPI: http://localhost:3000/openapi.json
#    Adminer: http://localhost:8080  (GUI do banco)
```

Para parar:
```bash
docker compose down          # para os containers
docker compose down -v       # para e apaga os volumes (banco zerado)
```

---

## ⚙️ Rodando sem Docker

```bash
cp .env.example .env
# Edite .env com DATABASE_URL, DIRECT_URL e demais credenciais

npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

### Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). Novas na v1.1.0:

| Variável | Uso |
|---|---|
| `CORS_ORIGINS` | Origens de navegador permitidas (vírgula). Vazio = qualquer origem (a API usa Bearer token, não cookies) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Admin inicial criado pelo seed. Em produção, sem `SEED_ADMIN_PASSWORD`, nenhum admin é criado |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Armazenamento de mídias (já usadas antes, agora documentadas) |

Configuração por ambiente:

| Ambiente | Observações |
|---|---|
| Local | `.env` com banco local; seed cria `admin@apasbac.org.br` / `Admin@123` **somente fora de produção** |
| Desenvolvimento/Staging | Banco e conta Cloudinary próprios; segredos JWT distintos de produção |
| Produção | `NODE_ENV=production`, segredos JWT longos e aleatórios (`openssl rand -base64 48`), `SEED_ADMIN_PASSWORD` só no primeiro deploy, troque a senha do admin após o primeiro login |

---

## 🔑 Autenticação

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/v1/auth/register` | POST | Cadastro |
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/auth/refresh` | POST | Renovar tokens (rotação: o refresh token é de uso único) |
| `/api/v1/auth/forgot-password` | POST | Solicitar reset de senha |
| `/api/v1/auth/reset-password` | POST | Redefinir senha (encerra todas as sessões) |
| `/api/v1/auth/logout` | POST | Logout (sem `refreshToken`, encerra todas as sessões) |

Refresh tokens são armazenados como hash, agrupados por sessão; reutilizar um token já rotacionado revoga a sessão inteira.

---

## 👥 Roles

| Role | Descrição |
|---|---|
| `ADMIN` | Acesso total (roles, exclusões, auditoria, categorias de eventos) |
| `STAFF` | Gerencia animais, monitoramentos, eventos e configs |
| `TUTOR` | Usuário que adotou um animal |
| `USER` | Usuário comum (sem animal adotado) |

Matriz completa em `documentation/content/seguranca/autorizacao.mdx`.

---

## 🐕 Animais & QR Code

Cada animal possui dois identificadores:

| Tipo | Uso |
|---|---|
| `id` (numérico) | Uso interno / Admin — `GET /animals/:id` |
| `uuid` | QR Code — `GET /animals/public/uuid/:uuid` |

### Endpoints públicos (sem login)

- `GET /api/v1/animals` — lista (sem `uuid`, `qrCodeUrl` e dados do adotante para visitantes)
- `GET /api/v1/animals/public/uuid/:uuid` — retorna dados do animal + contatos configurados da APASBAC + tutor (se adotado)
- `GET /api/v1/animals/public/:id` — retorna dados básicos do animal, **sem** contatos

> ⚠️ O endereço da APASBAC **nunca é exposto** na API. Telefone e e-mail de contato são opcionais e configuráveis pelo Admin a qualquer momento.

---

## 📅 Eventos (v1.1.0)

Feiras de adoção, campanhas e ações institucionais com categorias administráveis, capa, galeria, datas, local e coordenadas.

- Públicos: `GET /events`, `GET /events/:id`, `GET /events/slug/:slug`, `GET /events/categories`
- Equipe: `POST /events`, `PATCH /events/:id`, imagens (`/events/:id/image`, `/events/:id/gallery`), `GET /admin/events`
- Admin: `DELETE /events/:id`, CRUD de categorias

Status: `DRAFT` (não público), `PUBLISHED`, `CANCELLED`, `FINISHED`.

---

## 🧾 Auditoria (v1.1.0)

Operações importantes (login, falhas de login, alterações de usuários, animais, adoções, monitoramentos, eventos, configs, uploads) são gravadas em `audit_logs`, sem senhas, tokens ou dados pessoais. Um trigger no banco impede `UPDATE`/`DELETE`. Consulta: `GET /api/v1/admin/audit-logs` (ADMIN).

---

## 📞 Configurando os Contatos da APASBAC

Os dados de contato **não ficam no `.env`** — eles são gerenciados via banco de dados pelo Admin, evitando exposição acidental.

Após o primeiro deploy, configure pelo Swagger ou via curl:

```bash
# Telefone
curl -X PATCH http://localhost:3000/api/v1/configs/apasbac_phone \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"value": "+55 44 9XXXX-XXXX"}'

# E-mail
curl -X PATCH http://localhost:3000/api/v1/configs/apasbac_email \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"value": "contato@apasbac.org.br"}'
```

Para **deixar sem contato** (não exibir nada no QR Code), mantenha o valor como string vazia `""`.

---

## 📋 Monitoramento

1. Admin/Staff cria o registro de monitoramento vinculado ao tutor
2. Tutor envia **vídeo** + **imagens** (1 a 10) via upload direto ao Cloudinary
3. Admin/Staff **aprova** ou **rejeita**
4. Mídias deletadas do storage após revisão
5. Tutor recebe e-mail com o resultado

> Google Sheets: o serviço existe, mas nenhum fluxo atual envia linhas para a planilha (a atualização de status só ocorre quando `sheetsRowId` está preenchido, o que hoje não acontece).

---

## ⚙️ Configurações do Sistema (AppConfig)

| Chave | Padrão | Descrição |
|---|---|---|
| `monitoring_period_value` | `6` | Valor numérico do período |
| `monitoring_period_unit` | `MONTHS` | Unidade: `DAYS` / `WEEKS` / `MONTHS` / `YEARS` |
| `apasbac_phone` | _(vazio)_ | Telefone de contato exibido no QR Code |
| `apasbac_email` | _(vazio)_ | E-mail de contato exibido no QR Code |

---

## ☁️ Cloudinary

1. Crie uma conta em [cloudinary.com](https://cloudinary.com)
2. Copie Cloud name, API Key e API Secret para `CLOUDINARY_*`
3. Uploads diretos usam `POST /api/v1/storage/signed-upload`; pastas permitidas por role: `monitoring/images`, `monitoring/videos` (todos) e `animals/photos`, `events/covers`, `events/gallery` (ADMIN/STAFF)

---

## 📊 Google Sheets

1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com)
2. Ative a **Google Sheets API**
3. Crie uma **Service Account** e baixe o JSON
4. Compartilhe a planilha com o e-mail da Service Account
5. Preencha `GOOGLE_*` no `.env` ou `.env.docker`

> Para testes locais sem Sheets, deixe as variáveis `GOOGLE_*` em branco — os erros são capturados silenciosamente.

---

## 📧 E-mails (SMTP)

Para testes locais, use **Mailtrap** ou **Ethereal Email** (gratuitos):
- [mailtrap.io](https://mailtrap.io) — captura e-mails sem enviar de verdade
- [ethereal.email](https://ethereal.email) — gerador de conta SMTP fake instantâneo

---

## 🧪 Testes e qualidade

```bash
npm test                    # unitários (versão do app, auth/rotação, uploads, políticas, permissões, erros)
E2E_DATABASE_URL=postgresql://user:pass@localhost:5432/apasbac_test npm run test:e2e   # API completa + PostgreSQL (banco *_test é RESETADO)
npx eslint "{src,test,scripts}/**/*.ts"
npx nest build
npm run openapi:export      # regenera a especificação usada pela documentação
npm run openapi:check       # falha se a especificação versionada estiver desatualizada
```

O CI (`.github/workflows/ci.yml`) executa tudo isso, mais testes, build, verificação de links e Playwright da documentação.
