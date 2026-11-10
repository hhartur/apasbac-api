import Link from 'next/link';
import { CodeTabs } from '@/components/code-tabs';
import { highlight } from '@/lib/highlight';
import { operations, opsByTag, TAGS, tags } from '@/lib/openapi';
import { site } from '@/lib/site';
import { ArrowRightIcon, BookIcon, CalendarIcon, GithubIcon, PawIcon, ShieldIcon, SparkIcon, TerminalIcon } from '@/components/icons';
import { MethodBadge } from '@/components/ui';

const QUICK = {
  curl: `curl "https://apasbac-api.vercel.app/api/v1/animals?isAdopted=false&limit=3"`,
  js: `const res = await fetch(
  'https://apasbac-api.vercel.app/api/v1/animals?isAdopted=false&limit=3',
);
const { data } = await res.json();

for (const animal of data.data) {
  console.log(animal.name, animal.species, animal.breed, animal.size);
}`,
  py: `import requests

r = requests.get(
    "https://apasbac-api.vercel.app/api/v1/animals",
    params={"isAdopted": "false", "limit": 3},
    timeout=15,
)
for animal in r.json()["data"]["data"]:
    print(animal["name"], animal["species"], animal["breed"], animal["size"])`,
};

const RESPONSE = `{
  "success": true,
  "data": {
    "data": [
      {
        "id": 11,
        "name": "Leão",
        "species": "Cachorro",
        "breed": "Vira-Lata",
        "sex": "MALE",
        "size": "LARGE",
        "temperament": "Brincalhão, animado",
        "isAdopted": false,
        "photos": ["https://res.cloudinary.com/..."]
      }
    ],
    "total": 5, "page": 1, "limit": 3, "totalPages": 2
  },
  "timestamp": "2026-10-31T12:00:00.000Z"
}`;

const RESOURCES = [
  { icon: PawIcon, title: 'Animais e QR Codes', href: '/api-reference/animais', text: 'Lista pública, ficha do animal e consulta pela coleira com QR Code.' },
  { icon: CalendarIcon, title: 'Eventos', href: '/docs/eventos/introducao', text: 'Feiras de adoção, campanhas e ações, prontos para qualquer site.' },
  { icon: ShieldIcon, title: 'Autenticação JWT', href: '/docs/autenticacao/visao-geral', text: 'Access e refresh token com rotação e detecção de reutilização.' },
  { icon: BookIcon, title: 'Monitoramento de adoções', href: '/api-reference/monitoramentos', text: 'Envio de fotos e vídeo pelo tutor e revisão pela equipe.' },
  { icon: TerminalIcon, title: 'Playground', href: '/playground', text: 'Teste requisições com segurança, sem proxy e sem guardar tokens.' },
  { icon: SparkIcon, title: 'Integração com IA', href: '/docs/ia/como-uma-ia-deve-integrar', text: 'llms.txt, AGENTS.md e OpenAPI para qualquer agente de código.' },
];

export default async function Home() {
  const tabs = await Promise.all([
    { label: 'cURL', code: QUICK.curl, lang: 'bash' },
    { label: 'JavaScript', code: QUICK.js, lang: 'javascript' },
    { label: 'Python', code: QUICK.py, lang: 'python' },
  ].map(async (t) => ({ label: t.label, code: t.code, html: await highlight(t.code, t.lang) })));
  const response = [{ label: '200 OK', code: RESPONSE, html: await highlight(RESPONSE, 'json') }];
  const publicOps = operations.filter((o) => o.isPublic).length;

  return (
    <main id="conteudo">
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-24">
          <div className="fade-in">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              APASBAC API v{site.apiVersion} · {operations.length} operações documentadas
            </p>
            <h1 className="max-w-[16ch] font-display text-[2.6rem] font-bold leading-[1.04] tracking-[-0.035em] text-fg sm:text-[3.4rem] lg:text-[3.9rem]">
              Construa integrações com a APASBAC.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.08rem] leading-relaxed text-fg-2">{site.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/docs/inicio/primeiros-passos" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-contrast transition-colors hover:bg-primary-hover">
                Começar <ArrowRightIcon />
              </Link>
              <Link href="/api-reference" className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2">
                Explorar a API
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <li><Link href="/docs/ia/como-uma-ia-deve-integrar" className="text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg">Integração com IA</Link></li>
              <li><Link href="/docs/seguranca/boas-praticas" className="text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg">Segurança</Link></li>
              <li><a href={site.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg"><GithubIcon width={14} height={14} />GitHub</a></li>
            </ul>
          </div>
          <div className="fade-in min-w-0 space-y-3 lg:pt-4">
            <CodeTabs tabs={tabs} title="Primeira requisição" />
            <CodeTabs tabs={response} title="Resposta" />
            <p className="text-xs text-fg-3">Endpoint público: não exige cadastro nem token.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="recursos">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="recursos" className="font-display text-[1.7rem] font-bold tracking-[-0.02em] text-fg">O que a API oferece</h2>
            <p className="mt-2 max-w-xl text-fg-2">Recursos reais, extraídos do código da API. Nada aqui é promessa.</p>
          </div>
          <dl className="flex gap-8 text-sm">
            <div><dt className="text-fg-3">Operações</dt><dd className="font-display text-2xl font-bold text-fg">{operations.length}</dd></div>
            <div><dt className="text-fg-3">Públicas</dt><dd className="font-display text-2xl font-bold text-fg">{publicOps}</dd></div>
            <div><dt className="text-fg-3">Recursos</dt><dd className="font-display text-2xl font-bold text-fg">{tags.length}</dd></div>
          </dl>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map(({ icon: Icon, title, href, text }) => (
            <Link key={href} href={href} className="group bg-surface p-6 transition-colors hover:bg-surface-2">
              <Icon className="text-primary" width={20} height={20} />
              <p className="mt-4 font-display font-semibold text-fg">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface-2/50" aria-labelledby="inicio-rapido">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-20">
          <div>
            <h2 id="inicio-rapido" className="font-display text-[1.7rem] font-bold tracking-[-0.02em] text-fg">Início rápido</h2>
            <ol className="mt-6 space-y-5">
              {[
                ['Faça uma consulta pública', 'Liste animais ou eventos sem nenhuma credencial.', '/docs/inicio/primeiros-passos'],
                ['Autentique um usuário', 'Login devolve access token (15 min) e refresh token (7 dias).', '/docs/autenticacao/login'],
                ['Renove a sessão', 'Troque o refresh token a cada uso: ele é de uso único.', '/docs/autenticacao/renovacao'],
                ['Trate erros pelo statusCode', 'Todas as falhas seguem o mesmo formato JSON.', '/docs/fundamentos/erros'],
              ].map(([t, d, h], i) => (
                <li key={h} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-xs font-semibold text-fg">{i + 1}</span>
                  <div><Link href={h} className="font-semibold text-fg hover:text-primary">{t}</Link><p className="mt-0.5 text-sm text-fg-2">{d}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-fg">Recursos da referência</p>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {tags.map((t) => (
                <li key={t}>
                  <Link href={`/api-reference/${TAGS[t].slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                    <span className="flex gap-1">{[...new Set(opsByTag(t).map((o) => o.method))].map((m) => <MethodBadge key={m} method={m} size="xs" />)}</span>
                    <span className="flex-1 text-sm font-medium text-fg">{TAGS[t].label}</span>
                    <span className="text-xs text-fg-3">{opsByTag(t).length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-fg-3 sm:px-6">
        <p>{site.name} — {site.fullName} · {site.location}</p>
        <p className="flex gap-4">
          <a href="/llms.txt" className="hover:text-fg">llms.txt</a>
          <a href="/openapi.json" className="hover:text-fg">openapi.json</a>
          <a href="/AGENTS.md" className="hover:text-fg">AGENTS.md</a>
        </p>
      </footer>
    </main>
  );
}
