/**
 * Batched fetcher with split-and-retry.
 *
 * Calls `fetcher(chunk)` for each chunk of `keys` (sized at most `maxBatch`).
 * If a chunk throws, recursively halves it until size 1 — single-key failures
 * are logged and contribute no entries to the returned Map. This salvages the
 * common TrainLCD failure mode where the upstream times out on overly large
 * payloads but succeeds on smaller slices.
 */
export async function splitRetry<K, V>(
  keys: K[],
  fetcher: (chunk: K[]) => Promise<Map<K, V>>,
  opts: { maxBatch?: number; label?: string } = {},
): Promise<Map<K, V>> {
  const maxBatch = opts.maxBatch ?? 100;
  if (keys.length === 0) return new Map();

  const uniqueKeys = [...new Set(keys)];
  const chunks: K[][] = [];
  for (let i = 0; i < uniqueKeys.length; i += maxBatch) {
    chunks.push(uniqueKeys.slice(i, i + maxBatch));
  }

  const results = await Promise.all(
    chunks.map((c) => runChunk(c, fetcher, opts.label)),
  );
  const merged = new Map<K, V>();
  for (const r of results) {
    for (const [k, v] of r) merged.set(k, v);
  }
  return merged;
}

async function runChunk<K, V>(
  keys: K[],
  fetcher: (chunk: K[]) => Promise<Map<K, V>>,
  label?: string,
): Promise<Map<K, V>> {
  if (keys.length === 0) return new Map();
  try {
    return await fetcher(keys);
  } catch (err) {
    if (keys.length === 1) {
      console.warn(`[splitRetry${label ? `/${label}` : ''}] gave up on key:`, keys[0], err);
      return new Map();
    }
    const mid = Math.ceil(keys.length / 2);
    const left = keys.slice(0, mid);
    const right = keys.slice(mid);
    const [a, b] = await Promise.all([
      runChunk(left, fetcher, label),
      runChunk(right, fetcher, label),
    ]);
    const out = new Map<K, V>();
    for (const [k, v] of a) out.set(k, v);
    for (const [k, v] of b) out.set(k, v);
    return out;
  }
}
