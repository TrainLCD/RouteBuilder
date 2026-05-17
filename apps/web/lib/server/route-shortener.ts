import { createHash } from 'node:crypto';
import { kv } from '@vercel/kv';

/**
 * Content-addressed route shortener backed by Vercel KV.
 *
 * The short ID is the leading bytes of SHA-256 over the routing payload
 * (sids + skips + optional train-type name/color), base64url-encoded.
 * Hashing every component keeps the lookup idempotent (same payload →
 * same id) while keeping two routes that share sids but differ in
 * 通過 or 列車種別 distinct.
 *
 * 8 bytes (~11 base64url chars) gives roughly 1.8e19 possibilities, so
 * collisions are negligible at the volumes we expect.
 */

const KEY_PREFIX = 'route:';
const ID_BYTES = 8;

const MAX_SIDS = 1024;
const MAX_TRAIN_TYPE_NAME = 64;

export type RouteTrainType = {
  /** 列車種別の表示名。非空 . */
  name: string;
  /** #RRGGBB の 6 桁 hex (小文字)。 */
  color: string;
  /** Romaji form for the LCD's secondary line. Optional. */
  nameRoman?: string;
};

export type RouteRecord = {
  sids: number[];
  /** 0-origin indices into `sids` to treat as 通過. */
  skips?: number[];
  /** Custom 列車種別 override (TrainLCD/MobileApp#6018). */
  trainType?: RouteTrainType;
};

function codeFor(sids: number[], skips: number[], tt?: RouteTrainType): string {
  const ttKey = tt ? `${tt.name}|${tt.color}|${tt.nameRoman ?? ''}` : '';
  const digest = createHash('sha256')
    .update(`${sids.join(',')}|${skips.join(',')}|${ttKey}`)
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
 * Anything outside is dropped silently — the user's route data is the
 * source of truth for which stops are 通過, and the deep link is just a
 * projection.
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

/**
 * Validate the trainType field per TrainLCD/MobileApp#6018:
 * - `name` is a non-empty trimmed string
 * - `color` matches `/^#[0-9a-fA-F]{6}$/`
 *
 * Returns `undefined` when the field is absent (no override). Throws
 * for malformed input so the caller can surface a 400.
 */
export function validateTrainType(input: unknown): RouteTrainType | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object') {
    throw new Error('trainType must be an object');
  }
  const obj = input as Record<string, unknown>;
  const rawName = obj.name;
  if (typeof rawName !== 'string') {
    throw new Error('trainType.name must be a string');
  }
  const name = rawName.trim();
  if (name.length === 0) {
    throw new Error('trainType.name must be non-empty');
  }
  if (name.length > MAX_TRAIN_TYPE_NAME) {
    throw new Error(`trainType.name exceeds ${MAX_TRAIN_TYPE_NAME} chars`);
  }
  const rawColor = obj.color;
  if (typeof rawColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(rawColor)) {
    throw new Error('trainType.color must be #RRGGBB');
  }
  let nameRoman: string | undefined;
  if (obj.nameRoman !== undefined) {
    if (typeof obj.nameRoman !== 'string') {
      throw new Error('trainType.nameRoman must be a string');
    }
    const trimmed = obj.nameRoman.trim();
    if (trimmed.length > MAX_TRAIN_TYPE_NAME) {
      throw new Error(`trainType.nameRoman exceeds ${MAX_TRAIN_TYPE_NAME} chars`);
    }
    if (trimmed.length > 0) nameRoman = trimmed;
  }
  return { name, color: rawColor.toLowerCase(), ...(nameRoman ? { nameRoman } : {}) };
}

/** Store the route under its content hash and return the short id. */
export async function shortenRoute(
  sids: number[],
  skips: number[] = [],
  trainType?: RouteTrainType,
): Promise<string> {
  const id = codeFor(sids, skips, trainType);
  const record: RouteRecord = {
    sids,
    ...(skips.length > 0 ? { skips } : {}),
    ...(trainType ? { trainType } : {}),
  };
  await kv.set(`${KEY_PREFIX}${id}`, record);
  return id;
}

/** Resolve a short id back to its route record, or `null` if not found. */
export async function resolveRoute(id: string): Promise<RouteRecord | null> {
  return (await kv.get<RouteRecord>(`${KEY_PREFIX}${id}`)) ?? null;
}
