// Refreshes src/common/disposable-domains.generated.ts from the community-maintained blocklist
// https://github.com/disposable-email-domains/disposable-email-domains (CC0). Run: npm run disposable:update
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const OUT = fileURLToPath(new URL('../src/common/disposable-domains.generated.ts', import.meta.url));

const res = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`Falha ao baixar a lista: HTTP ${res.status}`);
const domains = [...new Set((await res.text()).split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')))].sort();
if (domains.length < 1000) throw new Error(`Lista suspeita: só ${domains.length} domínios`);

writeFileSync(OUT, `// Gerado por scripts/update-disposable-domains.mjs em ${new Date().toISOString().slice(0, 10)}. Não edite à mão.
// Fonte: ${SOURCE} (CC0)
export const DISPOSABLE_DOMAINS_COUNT = ${domains.length};
export const DISPOSABLE_DOMAINS = \`
${domains.join('\n')}
\`;
`);
console.log(`${domains.length} domínios descartáveis gravados em ${OUT}`);
