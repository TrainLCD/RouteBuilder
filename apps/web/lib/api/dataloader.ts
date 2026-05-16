/**
 * Minimal DataLoader: coalesces synchronous `load()` calls within a single
 * microtask into one batched fetch. Inspired by graphql/dataloader but with
 * no per-key caching layer (we cache at a higher level in cache.ts).
 *
 * Failures resolve as `null` rather than rejecting, so a single bad key in a
 * batch doesn't poison every co-batched promise. The `batchFn` should not
 * throw for partial misses — return a Map that simply omits missing keys.
 *
 * If the batch function fails (timeout, network error), the chunk is split
 * in half and re-tried recursively. This salvages partial data when the
 * server times out on overly-large batches.
 */

export type DataLoaderOptions = {
  /** Hard ceiling on keys per batchFn call. */
  maxBatch?: number;
  /** When a chunk fails, attempt to split-and-retry down to this size. */
  splitOnError?: boolean;
};

export class DataLoader<K, V> {
  private queue: Array<{ key: K; resolve: (v: V | null) => void }> = [];
  private pending = false;
  private readonly maxBatch: number;
  private readonly splitOnError: boolean;

  constructor(
    private readonly batchFn: (keys: K[]) => Promise<Map<K, V>>,
    opts: DataLoaderOptions = {},
  ) {
    this.maxBatch = opts.maxBatch ?? 100;
    this.splitOnError = opts.splitOnError ?? false;
  }

  load(key: K): Promise<V | null> {
    return new Promise((resolve) => {
      this.queue.push({ key, resolve });
      this.schedule();
    });
  }

  loadMany(keys: K[]): Promise<(V | null)[]> {
    return Promise.all(keys.map((k) => this.load(k)));
  }

  private schedule(): void {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => void this.flush());
  }

  private async flush(): Promise<void> {
    const batch = this.queue;
    this.queue = [];
    this.pending = false;
    if (batch.length === 0) return;

    const uniqueKeys = [...new Set(batch.map((b) => b.key))];
    const chunks: K[][] = [];
    for (let i = 0; i < uniqueKeys.length; i += this.maxBatch) {
      chunks.push(uniqueKeys.slice(i, i + this.maxBatch));
    }

    const merged = new Map<K, V>();
    const results = await Promise.all(chunks.map((c) => this.runChunk(c)));
    for (const r of results) {
      for (const [k, v] of r) merged.set(k, v);
    }

    for (const { key, resolve } of batch) {
      resolve(merged.get(key) ?? null);
    }
  }

  /**
   * Run a single chunk through `batchFn`. On error, optionally split the
   * chunk and recurse. Each leaf failure is logged once and contributes no
   * keys to the merged result (callers see `null`).
   */
  private async runChunk(keys: K[]): Promise<Map<K, V>> {
    if (keys.length === 0) return new Map();
    try {
      return await this.batchFn(keys);
    } catch (err) {
      if (!this.splitOnError || keys.length === 1) {
        console.warn(`[DataLoader] batch of ${keys.length} failed:`, err);
        return new Map();
      }
      const mid = Math.ceil(keys.length / 2);
      const left = keys.slice(0, mid);
      const right = keys.slice(mid);
      console.warn(`[DataLoader] batch of ${keys.length} failed; splitting → ${left.length}+${right.length}`);
      const [a, b] = await Promise.all([this.runChunk(left), this.runChunk(right)]);
      const out = new Map<K, V>();
      for (const [k, v] of a) out.set(k, v);
      for (const [k, v] of b) out.set(k, v);
      return out;
    }
  }
}
