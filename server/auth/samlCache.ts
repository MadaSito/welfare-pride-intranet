import type { CacheItem, CacheProvider } from "@node-saml/node-saml";
import * as db from "../db";

const REQUEST_TTL_MS = 10 * 60 * 1000;

export class DatabaseSamlCacheProvider implements CacheProvider {
  async saveAsync(key: string, value: string): Promise<CacheItem> {
    const createdAt = Date.now();
    await db.saveSamlRequestCorrelation({
      requestId: key,
      requestValue: value,
      expiresAt: new Date(createdAt + REQUEST_TTL_MS),
    });
    return { value, createdAt };
  }

  async getAsync(key: string): Promise<string | null> {
    const item = await db.getSamlRequestCorrelation(key);
    return item?.requestValue ?? null;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) return null;
    const item = await db.getSamlRequestCorrelation(key);
    await db.deleteSamlRequestCorrelation(key);
    return item?.requestValue ?? null;
  }
}
