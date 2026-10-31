import { opHref, opsByTag, TAGS, tags } from './openapi';

export interface NavItem { title: string; href: string; method?: string }
export interface NavSection { title: string; items: NavItem[] }

const d = (section: string, pages: [string, string][]): NavItem[] => pages.map(([slug, title]) => ({ title, href: `/docs/${section}/${slug}` }));

export const navigation: NavSection[] = [
  { title: 'Início', items: d('inicio', [
    ['introducao', 'Introdução'], ['visao-geral', 'Visão geral'], ['primeiros-passos', 'Primeiros passos'],
    ['como-funciona', 'Como funciona a API'], ['ambientes', 'Ambientes e URLs'], ['versionamento', 'Versionamento'], ['status', 'Status da API'],
  ]) },
  { title: 'Fundamentos', items: d('fundamentos', [
    ['conceitos', 'Conceitos básicos'], ['respostas', 'Estrutura das respostas'], ['codigos-http', 'Códigos HTTP'], ['paginacao', 'Paginação'],
    ['filtros', 'Filtros'], ['ordenacao', 'Ordenação'], ['datas', 'Datas e horários'], ['erros', 'Tratamento de erros'], ['limites', 'Limites de requisições'],
  ]) },
  { title: 'Autenticação', items: d('autenticacao', [
    ['visao-geral', 'Visão geral'], ['cadastro', 'Cadastro'], ['login', 'Login'], ['access-token', 'Access Token'], ['refresh-token', 'Refresh Token'],
    ['renovacao', 'Renovação de sessão'], ['logout', 'Logout'], ['recuperacao-de-senha', 'Recuperação de senha'], ['redefinicao-de-senha', 'Redefinição de senha'],
    ['expiracao', 'Expiração de tokens'], ['credenciais', 'Segurança de credenciais'],
  ]) },
  { title: 'Referência da API', items: [
    { title: 'Visão geral', href: '/api-reference' },
    ...tags.map((t) => ({ title: TAGS[t].label, href: `/api-reference/${TAGS[t].slug}` })),
    ...d('referencia', [['tutores', 'Tutores'], ['adocoes', 'Adoções'], ['qr-codes', 'QR Codes'], ['contatos-institucionais', 'Contatos institucionais'],
      ['administracao', 'Administração'], ['relatorios', 'Relatórios']]),
    { title: 'Playground', href: '/playground' },
  ] },
  { title: 'Guias', items: d('guias', [
    ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['react', 'React'], ['nextjs', 'Next.js'], ['vue', 'Vue'], ['nuxt', 'Nuxt'],
    ['angular', 'Angular'], ['flutter', 'Flutter'], ['react-native', 'React Native'], ['python', 'Python'], ['php', 'PHP'], ['laravel', 'Laravel'],
    ['html', 'HTML, CSS e JavaScript'], ['backend-proprio', 'Backend próprio'], ['sistemas-externos', 'Sistemas externos'],
  ]) },
  { title: 'Segurança', items: d('seguranca', [
    ['boas-praticas', 'Boas práticas'], ['autenticacao-segura', 'Autenticação segura'], ['autorizacao', 'Autorização e permissões'],
    ['protecao-de-dados', 'Proteção de dados'], ['cors', 'CORS'], ['rate-limiting', 'Rate limiting'], ['upload-seguro', 'Upload seguro'],
    ['protecao-contra-ataques', 'Proteção contra ataques'], ['sessoes', 'Gerenciamento de sessões'], ['auditoria', 'Auditoria'],
    ['privacidade', 'Privacidade'], ['lgpd', 'LGPD'],
  ]) },
  { title: 'Eventos', items: d('eventos', [
    ['introducao', 'Introdução aos eventos'], ['listagem', 'Listagem'], ['consulta', 'Consulta individual'], ['categorias', 'Categorias'],
    ['imagens', 'Imagens'], ['localizacao', 'Localização'], ['datas', 'Datas e horários'], ['integracao-em-sites', 'Integração em sites'],
    ['exemplos', 'Exemplos de implementação'],
  ]) },
  { title: 'Inteligência Artificial', items: d('ia', [
    ['como-uma-ia-deve-integrar', 'Como uma IA deve integrar'], ['instrucoes', 'Instruções de integração'], ['contexto', 'Contexto da API'],
    ['arquivos', 'Arquivos de instrução'], ['openapi', 'OpenAPI'], ['llms-txt', 'llms.txt'], ['prompts', 'Exemplos de prompts'],
    ['regras-de-seguranca', 'Regras de segurança para agentes'],
  ]) },
  { title: 'Recursos', items: d('recursos', [
    ['changelog', 'Changelog'], ['versionamento', 'Política de versões'], ['faq', 'Perguntas frequentes'], ['solucao-de-problemas', 'Solução de problemas'],
    ['github', 'GitHub'], ['contato', 'Contato'],
  ]) },
];

export const flatNav = navigation.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));

export function neighbours(href: string) {
  const i = flatNav.findIndex((n) => n.href === href);
  return { prev: i > 0 ? flatNav[i - 1] : undefined, next: i >= 0 && i < flatNav.length - 1 ? flatNav[i + 1] : undefined };
}

export function sectionOf(href: string) {
  return navigation.find((s) => s.items.some((i) => i.href === href || href.startsWith(i.href + '/')))?.title;
}

export const tagOperationsNav = (tag: string) => opsByTag(tag).map((o) => ({ title: o.summary, href: opHref(o), method: o.method }));
