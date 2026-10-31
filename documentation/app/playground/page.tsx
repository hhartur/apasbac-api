import type { Metadata } from 'next';
import { DocsPage } from '@/components/docs-page';
import { Playground } from '@/components/playground';
import { Shell } from '@/components/shell';
import { Callout } from '@/components/ui';
import { playgroundOps } from '@/lib/playground-ops';
import { apiEnvironments } from '@/lib/site';

export const metadata: Metadata = { title: 'Playground', description: 'Teste qualquer endpoint da APASBAC API direto do navegador, com segurança.' };

export default function Page() {
  const envs = apiEnvironments();
  return (
    <Shell>
      <DocsPage href="/playground" title="Playground" crumbs={[{ label: 'Referência da API', href: '/api-reference' }, { label: 'Playground' }]}
        description="Selecione um endpoint, preencha os parâmetros e envie a requisição para o ambiente escolhido."
        toc={[{ id: 'regras', text: 'Regras de segurança', depth: 2 }]}>
        {/* Opens on a public, read-only request so nothing is changed by accident. */}
        <Playground ops={playgroundOps()} environments={envs} selectable initialId="AnimalsController_findAll" />
        <h2 id="regras" className="mt-12 mb-4 font-display text-[1.15rem] font-semibold text-fg">Regras de segurança</h2>
        <div className="space-y-3">
          <Callout type="security" title="Como o playground protege você">
            <p>As requisições saem do seu navegador direto para a API: não existe proxy, então a documentação nunca intermedia nem armazena dados.</p>
            <p>Destinos permitidos: {envs.map((e) => <code key={e.id} className="mr-1">{e.url}</code>)}. Qualquer outro host é bloqueado pelo código e pela Content-Security-Policy.</p>
            <p>O token fica apenas na memória da aba (nunca em localStorage) e somente os headers Authorization, Content-Type e X-Request-Id são enviados.</p>
            <p>Operações que alteram dados exigem confirmação explícita; em produção, uma segunda confirmação.</p>
          </Callout>
          <Callout type="warning" title="Permissões são da API, não do playground">
            Endpoints administrativos continuam exigindo um token com a role correta: a API responde 401 ou 403 sem ele.
          </Callout>
        </div>
      </DocsPage>
    </Shell>
  );
}
