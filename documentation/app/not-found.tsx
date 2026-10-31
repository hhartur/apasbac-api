import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-6 py-20">
      <p className="font-mono text-sm text-primary">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg">Página não encontrada</h1>
      <p className="mt-3 text-fg-2">Se você procurava um endpoint, confira a referência: ela lista exatamente o que a API implementa.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/api-reference" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover">Referência da API</Link>
        <Link href="/" className="rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-2">Início</Link>
      </div>
    </main>
  );
}
