import { allDocs, headings, toPlainMarkdown } from './content';
import { fieldRows, operations, opHref, shortPath, TAGS, document } from './openapi';
import { navigation, sectionOf } from './navigation';

export interface SearchItem { title: string; href: string; section: string; kind: 'page' | 'section' | 'endpoint' | 'schema'; method?: string; text: string }

const titleOf = (href: string) => navigation.flatMap((s) => s.items).find((i) => i.href === href)?.title;

/** Built at compile time and served as /search-index.json; searched entirely in the browser. */
export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];
  for (const doc of allDocs()) {
    const section = sectionOf(doc.href) ?? 'Documentação';
    const plain = toPlainMarkdown(doc.body).replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|]/g, ' ').replace(/\s+/g, ' ');
    items.push({ title: doc.meta.title || titleOf(doc.href) || doc.slug.at(-1)!, href: doc.href, section, kind: 'page', text: `${doc.meta.description ?? ''} ${plain}`.slice(0, 600) });
    for (const h of headings(doc.body)) items.push({ title: h.text, href: `${doc.href}#${h.id}`, section: `${section} › ${doc.meta.title}`, kind: 'section', text: '' });
  }
  for (const op of operations) {
    const params = [...op.parameters.map((p) => p.name), ...fieldRows(op.bodySchema).map((r) => r.name)];
    const errors = Object.entries(op.responses).filter(([c]) => !c.startsWith('2')).map(([c, r]) => `${c} ${r.description ?? ''}`);
    items.push({ title: op.summary, href: opHref(op), section: `API › ${TAGS[op.tag]?.label ?? op.tag}`, kind: 'endpoint', method: op.method,
      text: `${op.method} ${shortPath(op.path)} ${op.path} ${op.roles.join(' ')} ${params.join(' ')} ${errors.join(' ')} ${op.description ?? ''}`.slice(0, 600) });
  }
  for (const [name, schema] of Object.entries(document.components.schemas)) {
    const user = operations.find((o) => JSON.stringify(o.responses).includes(`/${name}"`) || JSON.stringify(o.bodySchema ?? {}).includes(`/${name}"`));
    if (!user) continue;
    items.push({ title: name, href: opHref(user), section: 'Schemas', kind: 'schema', text: Object.keys(schema.properties ?? {}).join(' ') });
  }
  return items;
}
