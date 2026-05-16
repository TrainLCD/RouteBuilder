import { NextResponse } from 'next/server';
import { stationGroupCache } from '@/lib/server/registry';
import { upstreamStationGroupStations } from '@/lib/server/trainlcd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) {
  const { groupId: raw } = await ctx.params;
  const groupId = Number(raw);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: 'invalid groupId' }, { status: 400 });
  }
  try {
    const stations = await stationGroupCache.get(groupId, () =>
      upstreamStationGroupStations(groupId),
    );
    return NextResponse.json(
      { stations },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error(`[/api/trainlcd/station-group/${groupId}] failed:`, err);
    return NextResponse.json({ error: 'upstream failed' }, { status: 502 });
  }
}
