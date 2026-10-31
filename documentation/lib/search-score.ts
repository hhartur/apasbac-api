// Pure ranking used by the search dialog (kept dependency-free and unit-tested).
export interface Searchable { title: string; section: string; kind: string; method?: string; text: string; href: string }

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function rank<T extends Searchable>(items: T[], query: string, limit = 20): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const title = normalize(item.title);
    const meta = normalize(`${item.method ?? ''} ${item.section}`);
    const text = normalize(item.text);
    let score = 0;
    for (const t of terms) {
      if (title === t) score += 12;
      else if (title.startsWith(t)) score += 8;
      else if (title.includes(t)) score += 5;
      else if (meta.includes(t)) score += 3;
      else if (text.includes(t)) score += 1;
      else { score = 0; break; } // every term must match somewhere
    }
    if (score) scored.push({ item, score: score + (item.kind === 'page' || item.kind === 'endpoint' ? 0.5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}
