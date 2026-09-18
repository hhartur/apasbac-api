import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseManifest, UPDATE_MANIFEST_URL, UPDATE_CACHE_KEY, UpdateManifest } from './update-manifest';

@Injectable()
export class AppVersionService {
  private readonly logger = new Logger(AppVersionService.name);
  private current?: UpdateManifest;
  private nextCheck = 0;
  private loaded = false;
  private pending?: Promise<UpdateManifest | undefined>;
  private readonly cacheKey = UPDATE_CACHE_KEY;
  constructor(private readonly prisma: PrismaService) {}

  async latest(): Promise<UpdateManifest | undefined> {
    if (this.pending) return this.pending;
    if (Date.now() < this.nextCheck) return this.current;
    this.pending = this.refresh().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async refresh(): Promise<UpdateManifest | undefined> {
    // Failed requests are cached too, preventing a GitHub outage from causing a request storm.
    this.nextCheck = Date.now() + 300000;
    if (!this.loaded) {
      this.loaded = true;
      try {
        const saved = await this.bounded(this.prisma.appConfig.findUnique({ where: { key: this.cacheKey } }));
        if (saved) this.current = parseManifest(JSON.parse(saved.value));
      } catch { /* Cache failures never take down the API. */ }
    }
    try {
      const url = new URL(UPDATE_MANIFEST_URL);
      url.searchParams.set('t', String(Math.floor(Date.now() / 300000)));
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error', headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok || !response.body) throw new Error('Manifest unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) throw new Error('Manifest too large');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      const manifest = parseManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      if (this.current && (manifest.versionCode < this.current.versionCode ||
          manifest.minimumSupportedVersionCode < this.current.minimumSupportedVersionCode)) return this.current;
      this.current = manifest;
      try {
        await this.bounded(this.prisma.appConfig.upsert({ where: { key: this.cacheKey },
          create: { key: this.cacheKey, value: JSON.stringify(manifest), description: 'Cache interno do manifesto GitHub; não editar manualmente.' },
          update: { value: JSON.stringify(manifest) } }));
      } catch { /* In-memory last-good response is still usable. */ }
    } catch { this.logger.warn('Manifesto Android indisponível; usando último cache válido.'); }
    return this.current;
  }
  private async bounded<T>(operation: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([Promise.resolve(operation), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Cache timeout')), 2000);
      })]);
    } finally { clearTimeout(timer); }
  }
}
