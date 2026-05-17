import { createHash } from 'node:crypto';
import { kv } from '@vercel/kv';

/**
 * Content-addressed route shortener backed by Vercel KV.
 *
 * The short ID is the leading bytes of SHA-256 over the comma-joined
 * sids list AND the skips index list, base64url-encoded. Hashing both
 * makes the lookup idempotent (same sids+skips → same id) while keeping
 * two routes with identical sids but different 通過 patterns distinct.
 *
 * 8 bytes (~11 base64url chars) gives roughly 1.8e19 possibilities, so
 * collisions are negligible at the volumes we expect.
 */

const KEY_PREFIX = 'route:';
const ID_BYTES = 8;

const MAX_SIDS = 1024;

export type RouteRecord = {
  sids: number[];
  /** 0-origin indices into `sids` to treat as 通過 (TrainLCD/MobileApp#6005 案A). */
  skips?: number[];
};

function codeFor(sids: number[], skips: number[]): string {
  const digest = createHash('sha256')
    .update(`${sids.join(',')}|${skips.join(',')}`)
    .digest();
  return digest.subarray(0, ID_BYTES).toString('base64url');
}

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

/**
 * Validate and normalise the skips array for a given sids length:
 * - integers in [1, sidsLength - 2] (start/end are always stops)
 * - de-duped
 * - sorted ascending
 *
 * Anything outside is dropped silently rather than thrown — the user's
 * route data is the source of truth for which stops are 通過, and the
 * deep link is just a projection.
 */
export function normaliseSkips(input: unknown, sidsLength: number): number[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<number>();
  for (const v of input) {
    if (typeof v !== 'number' || !Number.isInteger(v)) continue;
    if (v <= 0 || v >= sidsLength - 1) continue;
    set.add(v);
  }
  return [...set].sort((a, b) => a - b);
}

/** Store the route under its content hash and return the short id. */
export async function shortenRoute(sids: number[], skips: number[] = []): Promise<string> {
  const id = codeFor(sids, skips);
  const record: RouteRecord = skips.length > 0 ? { sids, skips } : { sids };
  await kv.set(`${KEY_PREFIX}${id}`, record);
  return id;
}

/** Resolve a short id back to its route record, or `null` if not found. */
export async function resolveRoute(id: string): Promise<RouteRecord | null> {
  return (await kv.get<RouteRecord>(`${KEY_PREFIX}${id}`)) ?? null;
}
