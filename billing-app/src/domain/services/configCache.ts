interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp in ms
}

class ConfigCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    });
  }

  invalidate(customerId: string): void {
    // Clear all cache entries for a customer using prefix matching
    // Keys follow patterns: customer:${customerId}, datasources:${customerId}, mappings:${customerId}
    const prefixes = [`customer:${customerId}`, `datasources:${customerId}`, `mappings:${customerId}`];
    for (const key of this.cache.keys()) {
      if (prefixes.some(prefix => key === prefix || key.startsWith(prefix + ':') || key.startsWith(prefix + '/'))) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

// Singleton export
export const configCache = new ConfigCache();