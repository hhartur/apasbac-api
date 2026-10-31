import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRightIcon, InfoIcon, ShieldIcon, WarningIcon } from './icons';
import { operations, opHref } from '@/lib/openapi';

const METHOD_STYLE: Record<string, string> = {
  GET: 'text-success bg-success-soft',
  POST: 'text-info bg-info-soft',
  PUT: 'text-warning bg-warning-soft',
  PATCH: 'text-warning bg-warning-soft',
  DELETE: 'text-danger bg-danger-soft',
};

export function MethodBadge({ method, size = 'sm' }: { method: string; size?: 'xs' | 'sm' }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold tracking-wide ${METHOD_STYLE[method] ?? 'bg-surface-3 text-fg-2'} ${size === 'xs' ? 'h-[18px] min-w-[2.6rem] px-1 text-[0.62rem]' : 'h-6 min-w-[3.3rem] px-1.5 text-[0.7rem]'}`}>
      {method === 'DELETE' ? 'DEL' : method}
    </span>
  );
}

const TONES = {
  neutral: 'bg-surface-3 text-fg-2',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

const STATUS = {
  implemented: ['Implementado', 'success'],
  partial: ['Parcialmente implementado', 'warning'],
  planned: ['Planejado', 'info'],
  'not-implemented': ['Não implementado', 'neutral'],
} as const;

export function Status({ value }: { value: keyof typeof STATUS }) {
  const [label, tone] = STATUS[value] ?? STATUS['not-implemented'];
  return <Badge tone={tone}>{label}</Badge>;
}

const CALLOUT = {
  info: { icon: InfoIcon, cls: 'border-info/25 bg-info-soft/60 [&_.callout-icon]:text-info', label: 'Nota' },
  tip: { icon: InfoIcon, cls: 'border-success/25 bg-success-soft/60 [&_.callout-icon]:text-success', label: 'Dica' },
  warning: { icon: WarningIcon, cls: 'border-warning/30 bg-warning-soft/60 [&_.callout-icon]:text-warning', label: 'Atenção' },
  danger: { icon: WarningIcon, cls: 'border-danger/25 bg-danger-soft/60 [&_.callout-icon]:text-danger', label: 'Importante' },
  security: { icon: ShieldIcon, cls: 'border-primary/25 bg-primary-soft/60 [&_.callout-icon]:text-primary', label: 'Segurança' },
};

export function Callout({ type = 'info', title, children }: { type?: keyof typeof CALLOUT; title?: string; children: ReactNode }) {
  const c = CALLOUT[type] ?? CALLOUT.info;
  const Icon = c.icon;
  return (
    <div role="note" className={`not-prose flex gap-3 rounded-xl border px-4 py-3 text-[0.92rem] leading-relaxed text-fg-2 ${c.cls}`}>
      <Icon className="callout-icon mt-[3px] shrink-0" width={17} height={17} />
      <div className="min-w-0 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-surface/70 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_strong]:text-fg [&>p+p]:mt-2">
        <p className="mb-0.5 font-semibold text-fg">{title ?? c.label}</p>
        {children}
      </div>
    </div>
  );
}

export function Cards({ children, cols = '2' }: { children: ReactNode; cols?: '2' | '3' }) {
  return <div className={`not-prose grid gap-3 sm:grid-cols-2 ${cols === '3' ? 'lg:grid-cols-3' : ''}`}>{children}</div>;
}

export function Card({ title, href, children, icon }: { title: string; href?: string; children?: ReactNode; icon?: ReactNode }) {
  const inner = (
    <>
      <div className="flex items-center gap-2 font-semibold text-fg">
        {icon && <span className="text-primary">{icon}</span>}
        <span>{title}</span>
        {href && <ArrowRightIcon className="ml-auto text-fg-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />}
      </div>
      {children && <div className="mt-1.5 text-sm leading-relaxed text-fg-2">{children}</div>}
    </>
  );
  const cls = 'group block rounded-xl border border-line bg-surface p-4 transition-colors duration-200';
  return href
    ? <Link href={href} className={`${cls} no-prose hover:border-line-strong hover:bg-surface-2`}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

export function Steps({ children }: { children: ReactNode }) {
  return <div className="not-prose relative ml-3 border-l border-line pl-7 [counter-reset:step]">{children}</div>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative pb-7 last:pb-1 [counter-increment:step] before:absolute before:-left-[2.55rem] before:top-0 before:flex before:h-6 before:w-6 before:items-center before:justify-center before:rounded-full before:border before:border-line-strong before:bg-surface before:font-mono before:text-xs before:font-semibold before:text-fg before:content-[counter(step)]">
      <p className="font-display font-semibold leading-6 text-fg">{title}</p>
      <div className="prose-docs mt-2 text-[0.94rem]">{children}</div>
    </div>
  );
}

/** Inline link to a documented endpoint; renders plain text if the endpoint does not exist in the OpenAPI document. */
export function Endpoint({ method, path }: { method: string; path: string }) {
  const op = operations.find((o) => o.method === method && o.path === `/api/v1${path}`);
  const body = <span className="inline-flex items-center gap-1.5 align-middle"><MethodBadge method={method} size="xs" /><code className="!border-0 !bg-transparent !p-0">{path}</code></span>;
  return op ? <Link href={opHref(op)} className="no-prose rounded-md px-0.5 hover:bg-surface-2">{body}</Link> : body;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="not-prose-table overflow-x-auto rounded-xl border border-line scrollbar-thin [&_table]:min-w-[34rem]"><table>{children}</table></div>;
}
