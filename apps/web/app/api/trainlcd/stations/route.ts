import { NextRequest, NextResponse } from 'next/server';
import { stationsByIdsCache } from '@/lib/server/registry';
import { splitRetry } from '@/lib/server/split-retry';
import { upstreamStationsByIds, type ApiStation } from '@/lib/server/trainlcd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IDS = 200;
const UPSTREAM_BATCH = 60;

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: NextRequest) {
  const ids = parseIds(req.nextUrl.searchParams.get('ids'));
  if (ids.length === 0) return NextResponse.json({ stations: [] });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `too many ids (max ${MAX_IDS})` }, { status: 400 });
  }

  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const key = sorted.join(',');
  try {
    const stations = await stationsByIdsCache.get(key, async () => {
      const map = await splitRetry<number, ApiStation>(
        sorted,
        async (chunk) => {
          const rows = await upstreamStationsByIds(chunk);
          const m = new Map<number, ApiStation>();
          for (const r of rows) m.set(r.groupId, r);
          return m;
        },
        { maxBatch: UPSTREAM_BATCH, label: 'stations' },
      );
      return [...map.values()];
    });
    return NextResponse.json(
      { stations },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error('[/api/trainlcd/stations] failed:', err);
    return NextResponse.json({ error: 'upstream failed' }, { status: 502 });
  }
}
