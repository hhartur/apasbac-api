export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/APASBAC/apasbac-app/source/update/version.json';
export const UPDATE_CACHE_KEY = 'android_update_stable_manifest_cache';

export interface UpdateManifest {
  schemaVersion: 1;
  channel: 'stable';
  versionCode: number;
  versionName: string;
  minimumSupportedVersionCode: number;
  mandatory: boolean;
  apkUrl: string;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  releaseNotes: string[];
}

export function parseManifest(input: unknown): UpdateManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid manifest');
  const v = input as Record<string, unknown>;
  const integer = (key: string, max: number): number => {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(`Invalid ${key}`);
    return n;
  };
  const string = (key: string, max: number): string => {
    const s = v[key];
    if (typeof s !== 'string' || !s.trim() || s.length > max) throw new Error(`Invalid ${key}`);
    return s;
  };
  const code = integer('versionCode', 2100000000);
  const url = new URL(string('apkUrl', 2048));
  const hash = string('sha256', 64).toLowerCase();
  const date = string('publishedAt', 40);
  if (integer('schemaVersion', 1) !== 1 || v.channel !== 'stable' || typeof v.mandatory !== 'boolean' ||
      url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash ||
      !/^\/APASBAC\/apasbac-app\/releases\/download\/[^/]+\/[^/]+\.apk$/.test(url.pathname) ||
      !/^[a-f0-9]{64}$/.test(hash) || !date.endsWith('Z') || !Number.isFinite(Date.parse(date)) ||
      !Array.isArray(v.releaseNotes) || v.releaseNotes.length > 50 || v.releaseNotes.some((n) => typeof n !== 'string' || n.length > 1000)) {
    throw new Error('Invalid manifest');
  }
  return { schemaVersion: 1, channel: 'stable', versionCode: code,
    versionName: string('versionName', 100), minimumSupportedVersionCode: integer('minimumSupportedVersionCode', code),
    mandatory: v.mandatory, apkUrl: url.href, sha256: hash, sizeBytes: integer('sizeBytes', 1073741824),
    publishedAt: date, releaseNotes: v.releaseNotes as string[] };
}
