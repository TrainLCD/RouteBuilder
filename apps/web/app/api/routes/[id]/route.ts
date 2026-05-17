import { NextResponse } from 'next/server';
import { resolveRoute } from '@/lib/server/route-shortener';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }
  try {
    const record = await resolveRoute(id);
    if (record == null) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    // Body shape matches `RouteRecord`: { sids: number[], skips?: number[] }.
    return NextResponse.json(record, {
      headers: {
        // Short URLs are content-addressed and immutable — cache aggressively.
        'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error(`[/api/routes/${id}] failed:`, err);
    return NextResponse.json({ error: 'lookup failed' }, { status: 502 });
  }
}
