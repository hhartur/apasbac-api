# 🐾 APASBAC API

API oficial da **APASBAC** — Associação Protetora de Animais de Dois Vizinhos, PR.

---

## 🚀 Tecnologias

- **NestJS 10** + TypeScript
- **Prisma ORM** + PostgreSQL
- **JWT** (Access + Refresh Token)
- **Cloudflare R2** (fotos, vídeos e QR Codes)
- **Google Sheets API** (relatórios de monitoramento)
- **Nodemailer** (e-mails transacionais)
- **QRCode** (geração por animal)
- **Swagger** com CSS personalizado (vermelho APASBAC)
- **Docker Compose** (ambiente local completo)

---

## 🐳 Rodando com Docker (recomendado para testes)

```bash
# 1. Copie o env de exemplo para Docker
cp .env.docker.example .env.docker
# Edite .env.docker com suas credenciais (R2, SMTP, etc.)

# 2. Suba os containers
docker compose up -d

# 3. Execute o seed (cria admin + configs padrão)
docker compose exec api npm run prisma:seed

# 4. Acesse
#    API:     http://localhost:3000/api/v1
#    Swagger: http://localhost:3000/docs
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
# Edite .env com DATABASE_URL e demais credenciais

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

---

## 🔑 Autenticação

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/v1/auth/register` | POST | Cadastro |
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/auth/refresh` | POST | Renovar tokens |
| `/api/v1/auth/forgot-password` | POST | Solicitar reset de senha |
| `/api/v1/auth/reset-password` | POST | Redefinir senha |
| `/api/v1/auth/logout` | POST | Logout |

---

## 👥 Roles

| Role | Descrição |
|---|---|
| `ADMIN` | Acesso total |
| `STAFF` | Gerencia animais, monitoramentos e configs |
| `TUTOR` | Usuário que adotou um animal |
| `USER` | Usuário comum (sem animal adotado) |

**Admin padrão** (criado pelo seed):
- Email: `admin@apasbac.org.br`
- Senha: `Admin@123`

---

## 🐕 Animais & QR Code

Cada animal possui dois identificadores:

| Tipo | Uso |
|---|---|
| `id` (numérico) | Uso interno / Admin — `GET /animals/:id` |
| `uuid` | QR Code — `GET /animals/public/uuid/:uuid` |

### Endpoints públicos (sem login)

- `GET /api/v1/animals/public/uuid/:uuid` — retorna dados do animal + contatos configurados da APASBAC + tutor (se adotado)
- `GET /api/v1/animals/public/:id` — retorna dados básicos do animal, **sem** contatos

> ⚠️ O endereço da APASBAC **nunca é exposto** na API. Telefone e e-mail de contato são opcionais e configuráveis pelo Admin a qualquer momento.

---

## 📞 Configurando os Contatos da APASBAC

Os dados de contato **não ficam no `.env`** — eles são gerenciados via banco de dados pelo Admin, evitando exposição acidental.

Após o primeiro deploy, configure pelo Swagger ou via curl:

```bash
# Telefone
curl -X PATCH http://localhost:3000/api/v1/configs/apasbac_phone \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"value": "+55 46 9XXXX-XXXX"}'

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
2. Tutor envia **vídeo** (obrigatório) + **imagens** (mínimo 1)
3. Dados enviados automaticamente ao Google Sheets
4. Admin/Staff **aprova** ou **rejeita**
5. Mídias deletadas do R2 após revisão
6. Tutor recebe e-mail com o resultado

---

## ⚙️ Configurações do Sistema (AppConfig)

| Chave | Padrão | Descrição |
|---|---|---|
| `monitoring_period_value` | `6` | Valor numérico do período |
| `monitoring_period_unit` | `MONTHS` | Unidade: `DAYS` / `WEEKS` / `MONTHS` / `YEARS` |
| `apasbac_phone` | _(vazio)_ | Telefone de contato exibido no QR Code |
| `apasbac_email` | _(vazio)_ | E-mail de contato exibido no QR Code |

---

## ☁️ Cloudflare R2

1. Crie um bucket em [dash.cloudflare.com](https://dash.cloudflare.com)
2. Ative acesso público (Public Bucket)
3. Crie API Token com permissão no bucket
4. Preencha `R2_*` no `.env` ou `.env.docker`

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
