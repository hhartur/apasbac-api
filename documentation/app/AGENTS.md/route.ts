import { agentsMarkdown } from '@/lib/llms';

export const dynamic = 'force-static';

// Download from the docs with <a href="/AGENTS.md" download>.
export function GET() {
  return new Response(agentsMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
