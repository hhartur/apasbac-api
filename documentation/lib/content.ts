import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const CONTENT_DIR = join(process.cwd(), 'content');

export interface DocMeta { title: string; description?: string; status?: 'implemented' | 'partial' | 'planned' | 'not-implemented' }
export interface Doc { slug: string[]; href: string; meta: DocMeta; body: string }
export interface Heading { depth: 2 | 3; text: string; id: string }

/** Minimal frontmatter parser: flat `key: value` pairs only, which is all the content uses. */
export function parseFrontmatter(raw: string): { meta: DocMeta; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: { title: '' }, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { meta: meta as unknown as DocMeta, body: raw.slice(m[0].length) };
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.mdx') ? [join(dir, e.name)] : []);
}

let cache: Doc[] | undefined;
export function allDocs(): Doc[] {
  cache ??= walk(CONTENT_DIR).map((file) => {
    const slug = relative(CONTENT_DIR, file).replace(/\.mdx$/, '').split(sep);
    const { meta, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    return { slug, href: `/docs/${slug.join('/')}`, meta, body };
  });
  return cache;
}

export const getDoc = (slug: string[]) => allDocs().find((d) => d.slug.join('/') === slug.join('/'));

export const slugifyHeading = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const stripFences = (body: string) => body.replace(/```[\s\S]*?```/g, '');

export function headings(body: string): Heading[] {
  return [...stripFences(body).matchAll(/^(##|###)\s+(.+)$/gm)].map((m) => {
    const text = m[2].replace(/`/g, '').trim();
    return { depth: m[1].length as 2 | 3, text, id: slugifyHeading(text) };
  });
}

/** Markdown without JSX component tags: what search and llms-full.txt index. */
export function toPlainMarkdown(body: string): string {
  return body
    .replace(/<(Callout|Card|Cards|Steps|Step|CodeGroup|Status|Endpoint)\b([^>]*?)\/>/g, (_, tag, attrs) => attrText(tag, attrs))
    .replace(/<(Callout|Card|Cards|Steps|Step|CodeGroup)\b([^>]*)>/g, (_, tag, attrs) => attrText(tag, attrs))
    .replace(/<\/(Callout|Card|Cards|Steps|Step|CodeGroup)>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function attrText(tag: string, attrs: string) {
  const get = (k: string) => attrs.match(new RegExp(`${k}="([^"]*)"`))?.[1];
  if (tag === 'Endpoint') return `\`${get('method')} ${get('path')}\``;
  if (tag === 'Status') return `[${get('value')}]`;
  const title = get('title');
  if (tag === 'Callout') return `\n> **${title ?? (get('type') ?? 'Nota').toUpperCase()}:** `;
  if (tag === 'Card' && get('href')) return `\n- [${title}](${get('href')})`;
  if (tag === 'Step') return `\n**${title}**\n`;
  return '';
}
