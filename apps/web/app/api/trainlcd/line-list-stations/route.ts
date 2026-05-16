import { NextRequest, NextResponse } from 'next/server';
import { lineListStationsCache } from '@/lib/server/registry';
import { splitRetry } from '@/lib/server/split-retry';
import { upstreamLineListStations, type ApiStation } from '@/lib/server/trainlcd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LINES = 60;
// TrainLCD's lineListStations is heavy — even 5 lines can blow the upstream
// 8s window. Start small and let splitRetry recover any timeouts.
const UPSTREAM_BATCH = 3;

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: NextRequest) {
  const lineIds = parseIds(req.nextUrl.searchParams.get('lineIds'));
  if (lineIds.length === 0) return NextResponse.json({ stations: [] });
  if (lineIds.length > MAX_LINES) {
    return NextResponse.json({ error: `too many lineIds (max ${MAX_LINES})` }, { status: 400 });
  }

  const sorted = [...new Set(lineIds)].sort((a, b) => a - b);
  const key = sorted.join(',');
  try {
    const stations = await lineListStationsCache.get(key, async () => {
      const map = await splitRetry<number, ApiStation[]>(
        sorted,
        async (chunk) => {
          const rows = await upstreamLineListStations(chunk);
          // Group by line.id so callers can keep them straight.
          const m = new Map<number, ApiStation[]>();
          for (const r of rows) {
            const lid = r.line?.id;
            if (lid == null) continue;
            const arr = m.get(lid) ?? [];
            arr.push(r);
            m.set(lid, arr);
          }
          return m;
        },
        { maxBatch: UPSTREAM_BATCH, label: 'lineList' },
      );
      // Flatten; client groups again by `line.id`.
      const out: ApiStation[] = [];
      for (const list of map.values()) out.push(...list);
      return out;
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
    console.error('[/api/trainlcd/line-list-stations] failed:', err);
    return NextResponse.json({ error: 'upstream failed' }, { status: 502 });
  }
}
