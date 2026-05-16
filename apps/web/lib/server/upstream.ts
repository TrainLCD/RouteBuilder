// Server-side TrainLCD GraphQL client. Lives only in the BFF Route Handlers —
// the browser never talks to the upstream directly.

const DEFAULT_TIMEOUT_MS = 9_000;

function endpoint(): string {
  const url = process.env.TRAINLCD_GRAPHQL_ENDPOINT;
  if (!url) {
    throw new UpstreamError(
      'TRAINLCD_GRAPHQL_ENDPOINT is not set. Define it in apps/web/.env.local',
    );
  }
  return url;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly errors?: unknown,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export class UpstreamTimeoutError extends UpstreamError {
  constructor(ms: number) {
    super(`upstream timed out after ${ms}ms`);
    this.name = 'UpstreamTimeoutError';
  }
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: ctl.signal,
      // We use our own cache layer; let the upstream serve fresh data each time.
      cache: 'no-store',
    });
    if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) throw new UpstreamError('upstream graphql errors', json.errors);
    if (!json.data) throw new UpstreamError('no data');
    return json.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new UpstreamTimeoutError(timeoutMs);
    }
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError('network', err);
  } finally {
    clearTimeout(timer);
  }
}
