// Client-side fetch wrapper. Talks to our own BFF (/api/trainlcd/*), never
// to the upstream GraphQL directly — the BFF holds the cache and handles
// upstream timeouts / batch splitting.

const BASE = '/api/trainlcd';

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(ms: number) {
    super(`request timed out after ${ms}ms`);
    this.name = 'ApiTimeoutError';
  }
}

export type GetOptions = { timeoutMs?: number; signal?: AbortSignal };

export function bffUrl(path: string): string {
  return path.startsWith('/') ? `${BASE}${path}` : `${BASE}/${path}`;
}

export async function getJson<T>(path: string, opts: GetOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ctl.abort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const res = await fetch(bffUrl(path), { signal: ctl.signal });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiTimeoutError(timeoutMs);
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError('network error');
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
  }
}
