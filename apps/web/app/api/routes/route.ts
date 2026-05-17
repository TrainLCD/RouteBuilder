import { NextRequest, NextResponse } from 'next/server';
import {
  normaliseSkips,
  shortenRoute,
  validateSids,
} from '@/lib/server/route-shortener';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !('sids' in body)) {
    return NextResponse.json({ error: 'sids is required' }, { status: 400 });
  }

  let sids: number[];
  try {
    sids = validateSids((body as { sids: unknown }).sids);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid sids' },
      { status: 400 },
    );
  }

  const skips = normaliseSkips((body as { skips?: unknown }).skips, sids.length);

  try {
    const id = await shortenRoute(sids, skips);
    return NextResponse.json({ id });
  } catch (err) {
    console.error('[/api/routes] failed to store route:', err);
    return NextResponse.json({ error: 'failed to store route' }, { status: 502 });
  }
}
