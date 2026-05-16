import { createHash } from 'node:crypto';
import { kv } from '@vercel/kv';

/**
 * Content-addressed route shortener backed by Vercel KV.
 *
 * The short ID is the leading bytes of SHA-256 over the comma-joined sids
 * list, base64url-encoded. That makes the lookup idempotent: re-exporting
 * the same route always produces the same short URL (good for QR re-prints
 * and idempotent shares), and edited routes get a different URL.
 *
 * 8 bytes (~11 base64url chars) gives roughly 1.8e19 possibilities, so
 * collisions are negligible at the volumes we expect.
 */

const KEY_PREFIX = 'route:';
const ID_BYTES = 8;

const MAX_SIDS = 1024;

export type RouteRecord = { sids: number[] };

function codeFor(sids: number[]): string {
  const digest = createHash('sha256').update(sids.join(',')).digest();
  return digest.subarray(0, ID_BYTES).toString('base64url');
}

/**
 * Validate a list of station ids before persisting.
 * Throws on malformed input; caller maps that to a 400 response.
 */
export function validateSids(input: unknown): number[] {
  if (!Array.isArray(input)) throw new Error('sids must be an array');
  if (input.length < 2) throw new Error('sids must contain at least 2 entries');
  if (input.length > MAX_SIDS) throw new Error(`sids exceeds ${MAX_SIDS} entries`);
  const out: number[] = [];
  for (const v of input) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
      throw new Error('sids must be positive integers');
    }
    out.push(v);
  }
  return out;
}

/** Store the route under its content hash and return the short id. */
export async function shortenRoute(sids: number[]): Promise<string> {
  const id = codeFor(sids);
  await kv.set(`${KEY_PREFIX}${id}`, { sids } satisfies RouteRecord);
  return id;
}

/** Resolve a short id back to its sids list, or `null` if not found. */
export async function resolveRoute(id: string): Promise<number[] | null> {
  const data = await kv.get<RouteRecord>(`${KEY_PREFIX}${id}`);
  return data?.sids ?? null;
}
