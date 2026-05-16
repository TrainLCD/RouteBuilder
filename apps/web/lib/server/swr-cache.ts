/**
 * In-memory stale-while-revalidate cache for the BFF process.
 *
 * - Lookups within `freshTtlMs` return the cached value immediately and don't
 *   trigger a revalidation.
 * - Lookups between `freshTtlMs` and `freshTtlMs + staleTtlMs` return the
 *   cached value immediately AND kick off a background refresh so the next
 *   request gets fresher data.
 * - Lookups past the stale window block on a fresh fetch (or, if a refresh is
 *   already in-flight, await it rather than firing a duplicate).
 *
 * The cache is process-local, so on a multi-instance deployment each instance
 * warms its own copy. For the TrainLCD dataset that's fine — payloads are
 * small and read-only at this scope.
 */

type Entry<V> = {
  value: V;
  /** Unix ms timestamp the value was written. */
  freshAt: number;
  /** A promise that resolves with a revalidated value, if a refresh is in flight. */
  inflight?: Promise<V>;
};

export type SwrCacheOptions = {
  /** Window in which a cached value is treated as fresh; no revalidation. */
  freshTtlMs: number;
  /** Window past `freshTtlMs` during which a stale value is still returned. */
  staleTtlMs: number;
};

export class SwrCache<K, V> {
  private map = new Map<K, Entry<V>>();

  constructor(private readonly opts: SwrCacheOptions) {}

  async get(key: K, loader: () => Promise<V>): Promise<V> {
    const now = Date.now();
    const entry = this.map.get(key);

    if (entry) {
      const age = now - entry.freshAt;
      if (age < this.opts.freshTtlMs) {
        return entry.value;
      }
      if (age < this.opts.freshTtlMs + this.opts.staleTtlMs) {
        // Serve stale, refresh in background (deduped per-key).
        if (!entry.inflight) {
          entry.inflight = (async () => {
            try {
              const fresh = await loader();
              this.set(key, fresh);
              return fresh;
            } catch (err) {
              // Keep serving stale; surface the error to anyone explicitly awaiting.
              throw err;
            } finally {
              entry.inflight = undefined;
            }
          })();
          // Swallow rejections so they don't crash the process.
          entry.inflight.catch(() => {});
        }
        return entry.value;
      }
      // Hard expired — fall through to a blocking fetch, but dedupe.
      if (entry.inflight) return entry.inflight;
    }

    // Cold or hard-expired path.
    const inflight = loader().then((v) => {
      this.set(key, v);
      return v;
    });
    // Stash the inflight under a placeholder so concurrent callers reuse it.
    this.map.set(key, {
      value: entry?.value as V,
      freshAt: entry?.freshAt ?? 0,
      inflight,
    });
    try {
      return await inflight;
    } catch (err) {
      // If we had a previously cached value (hard-expired), serve it.
      if (entry?.value !== undefined) return entry.value;
      throw err;
    }
  }

  set(key: K, value: V): void {
    this.map.set(key, { value, freshAt: Date.now() });
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  size(): number {
    return this.map.size;
  }
}
