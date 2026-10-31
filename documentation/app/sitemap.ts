import type { MetadataRoute } from 'next';
import { allDocs } from '@/lib/content';
import { operations, opHref, TAGS, tags } from '@/lib/openapi';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/api-reference', '/playground', ...allDocs().map((d) => d.href),
    ...tags.map((t) => `/api-reference/${TAGS[t].slug}`), ...operations.map(opHref)];
  return paths.map((p) => ({ url: `${site.url}${p}`, changeFrequency: 'weekly', priority: p === '/' ? 1 : 0.7 }));
}
