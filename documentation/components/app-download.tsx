import { AppQrCode, PawMark } from '@/components/app-qr-code';
import { AppVersionInfo } from '@/components/app-version-info';
import { APP_DOWNLOAD_URL } from '@/lib/app-qr';

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

/** Seção "Baixe o aplicativo" da página inicial. */
export function AppDownload() {
  return (
    <section id="baixar-app" className="scroll-mt-20 border-b border-line bg-surface-2/50" aria-labelledby="baixar-app-titulo">
      <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_auto] lg:gap-16 lg:py-20">
        <div className="min-w-0">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            Aplicativo Android para tutores
          </p>
          <h2 id="baixar-app-titulo" className="font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] text-fg sm:text-[2.4rem]">
            Baixe o app da APASBAC
          </h2>
          <p className="mt-4 max-w-[36rem] text-[1.02rem] leading-relaxed text-fg-2">
            Acompanhe o animal que você adotou, receba lembretes e envie as fotos e o vídeo do monitoramento direto pelo celular.
            O link e o QR Code sempre entregam a versão mais recente, e o próprio app avisa quando há atualização.
          </p>
          <div className="mt-6">
            <AppVersionInfo />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={APP_DOWNLOAD_URL}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-contrast transition-colors hover:bg-primary-hover"
            >
              <DownloadIcon /> Baixar para Android
            </a>
            <span className="text-xs text-fg-3">Arquivo APK · Android 7.0 ou mais recente</span>
          </div>
          <ol className="mt-8 grid gap-3 text-sm text-fg-2 sm:grid-cols-3">
            {[
              ['Baixe', 'Toque em “Baixar” ou aponte a câmera para o QR Code.'],
              ['Autorize', 'Permita instalar apps desta fonte quando o Android pedir.'],
              ['Instale', 'Abra o arquivo baixado e toque em “Instalar”.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-line bg-surface p-4">
                <span className="font-mono text-xs text-fg-3">{i + 1}</span>
                <p className="font-semibold text-fg">{t}</p>
                <p className="mt-1 leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </div>

        <figure className="relative mx-auto w-full max-w-[21rem] lg:mx-0">
          {/* Patinhas decorativas, fora da área de leitura do QR. */}
          <PawMark className="pointer-events-none absolute -left-7 top-20 h-7 w-7 -rotate-[24deg] text-primary/25" />
          <PawMark className="pointer-events-none absolute -left-3 top-36 h-5 w-5 -rotate-[12deg] text-primary/20" />
          <PawMark className="pointer-events-none absolute -right-6 bottom-28 h-7 w-7 rotate-[22deg] text-primary/25" />
          <PawMark className="pointer-events-none absolute -right-2 bottom-14 h-5 w-5 rotate-[10deg] text-primary/20" />
          <a href={APP_DOWNLOAD_URL} aria-label="Baixar o aplicativo APASBAC" className="block transition-transform duration-300 hover:-translate-y-1">
            <AppQrCode className="block h-auto w-full" />
          </a>
          <figcaption className="mt-3 text-center text-sm text-fg-2">
            <span className="font-semibold text-fg">Aponte a câmera e leve a gente com você</span>
            <a href={APP_DOWNLOAD_URL} className="mt-1 block break-all font-mono text-xs text-fg-3 underline decoration-line-strong underline-offset-4 hover:text-fg">
              {APP_DOWNLOAD_URL.replace(/^https:\/\//, '')}
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
