import { getLineStationIds } from '../api/cache';
import type { LineId } from '../api/types';
import type { Route } from './route';

const TODAY = new Date().toISOString().slice(0, 10);

const YAMANOTE_LINE: LineId = 11302;
const CHUO_RAPID_LINE: LineId = 11312;
const GINZA_LINE: LineId = 28001;

/**
 * Build sample routes from live API data on first launch. Each entry
 * references a known line; we fetch its full stop list (line-specific
 * `Station.id` rows) and slice/loop as appropriate.
 */
export async function buildSampleRoutes(): Promise<Route[]> {
  const out: Route[] = [];

  try {
    const yamanote = await getLineStationIds(YAMANOTE_LINE);
    if (yamanote.length > 1) {
      out.push({
        id: 'r-yamanote-loop',
        name: '山手線一周',
        stations: [...yamanote, yamanote[0]],
        updated: TODAY,
      });
    }
  } catch {
    // best-effort
  }

  try {
    const chuo = await getLineStationIds(CHUO_RAPID_LINE);
    if (chuo.length >= 2) {
      out.push({
        id: 'r-commute',
        name: '通勤ルート',
        stations: chuo,
        updated: TODAY,
      });
    }
  } catch {
    // best-effort
  }

  try {
    const ginza = await getLineStationIds(GINZA_LINE);
    if (ginza.length >= 2) {
      out.push({
        id: 'r-weekend',
        name: '週末さんぽ',
        stations: ginza,
        updated: TODAY,
      });
    }
  } catch {
    // best-effort
  }

  return out;
}
