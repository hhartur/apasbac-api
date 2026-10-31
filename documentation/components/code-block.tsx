import { highlight } from '@/lib/highlight';
import { CopyButton } from './copy-button';

export async function CodeBlock({ code, lang = 'text', title }: { code: string; lang?: string; title?: string }) {
  const html = await highlight(code, lang);
  return (
    <div className="not-prose group relative overflow-hidden rounded-xl border border-line bg-code">
      {title && (
        <div className="flex h-9 items-center border-b border-line px-4 font-mono text-xs text-fg-3">{title}</div>
      )}
      <CopyButton text={code.replace(/\n$/, '')} className={`absolute right-2 ${title ? 'top-1' : 'top-2'} opacity-70 group-hover:opacity-100 focus-visible:opacity-100`} />
      <div className="scrollbar-thin" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Pre-highlighted panel for client-side tabs (the tab component cannot run Shiki itself). */
export async function codePanel(code: string, lang: string) {
  return { html: await highlight(code, lang), code };
}
