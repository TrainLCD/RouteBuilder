import { NextResponse } from 'next/server';
import { lineCache } from '@/lib/server/registry';
import { upstreamLine } from '@/lib/server/trainlcd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ lineId: string }> },
) {
  const { lineId: raw } = await ctx.params;
  const lineId = Number(raw);
  if (!Number.isFinite(lineId) || lineId <= 0) {
    return NextResponse.json({ error: 'invalid lineId' }, { status: 400 });
  }
  try {
    const line = await lineCache.get(lineId, () => upstreamLine(lineId));
    return NextResponse.json(
      { line },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error(`[/api/trainlcd/line/${lineId}] failed:`, err);
    return NextResponse.json({ error: 'upstream failed' }, { status: 502 });
  }
}
