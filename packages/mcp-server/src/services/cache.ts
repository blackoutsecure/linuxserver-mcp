type CacheEntry<T> = { expires: number; value: T };

export type ExternalCache = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
};

export class MemoryCache {
  private readonly values = new Map<string, CacheEntry<unknown>>();
  private external?: ExternalCache;

  setExternal(store?: ExternalCache) {
    this.external = store;
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>
  ): Promise<T> {
    const cached = this.values.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expires > Date.now()) return cached.value;
    if (this.external) {
      try {
        const externalValue = await this.external.get(key);
        if (externalValue !== null) {
          const value = JSON.parse(externalValue) as T;
          this.values.set(key, {
            value,
            expires: Date.now() + ttlSeconds * 1000
          });
          return value;
        }
      } catch {
        // External cache failures must not block source lookups.
      }
    }
    const value = await load();
    this.values.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
    if (this.external) {
      try {
        await this.external.put(key, JSON.stringify(value), {
          expirationTtl: Math.max(60, ttlSeconds)
        });
      } catch {
        // The in-memory value remains usable when KV is unavailable.
      }
    }
    return value;
  }
}

export const cache = new MemoryCache();
export const configureExternalCache = (store?: ExternalCache) =>
  cache.setExternal(store);
