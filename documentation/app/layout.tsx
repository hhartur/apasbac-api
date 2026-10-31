import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/header';
import { THEME_SCRIPT } from '@/components/theme-toggle';
import { site } from '@/lib/site';
import './globals.css';

const heading = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.title} — APASBAC API`, template: `%s · ${site.title}` },
  description: site.description,
  applicationName: site.title,
  openGraph: { type: 'website', locale: 'pt_BR', siteName: site.title, title: site.title, description: site.description },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
  alternates: { types: { 'text/plain': '/llms.txt', 'application/json': '/openapi.json' } },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fffdf9' }, { media: '(prefers-color-scheme: dark)', color: '#120e0d' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${heading.variable} ${body.variable} ${code.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-fg">
        <Header />
        {children}
      </body>
    </html>
  );
}
