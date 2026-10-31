'use client';
import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

export function CopyButton({ text, label = 'Copiar código', className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Copiado' : label}
      title={copied ? 'Copiado' : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg ${className}`}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      <span aria-live="polite" className="sr-only">{copied ? 'Copiado' : ''}</span>
    </button>
  );
}
