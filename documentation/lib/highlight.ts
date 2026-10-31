import { createHighlighter, type Highlighter } from 'shiki';

const LANGS = ['bash', 'javascript', 'typescript', 'tsx', 'jsx', 'json', 'python', 'php', 'dart', 'vue', 'html', 'http', 'yaml', 'markdown', 'text', 'sql'];
let highlighter: Promise<Highlighter> | undefined;

/** Server-side highlighting with light/dark themes switched by CSS variables (no client JS). */
export async function highlight(code: string, lang = 'text'): Promise<string> {
  highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark-dimmed'], langs: LANGS });
  const h = await highlighter;
  const safeLang = LANGS.includes(lang) ? lang : lang === 'sh' || lang === 'shell' ? 'bash' : lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : 'text';
  return h.codeToHtml(code.replace(/\n$/, ''), { lang: safeLang, themes: { light: 'github-light', dark: 'github-dark-dimmed' }, defaultColor: false });
}
