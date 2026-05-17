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

  out.push({
    id: 'r-fussa-fusa',
    name: '福生布佐',
    stations: [
      1131508, 1131507, 1131506, 1131505, 1131504, 1131503, 1131502, 1131501,
      1131227, 1131226, 1131225, 1130504, 1130505, 1130506, 1130507, 1130508,
      1130509, 1130510, 1130511, 1130512, 1130513, 1130514, 1130525, 1130515,
      1130526, 1130516, 1130517, 1130518, 1130519, 1134407, 1134408, 1134409,
      1134410, 1134411, 1134412, 1132720, 1132721, 1132722, 1132723, 1132724,
    ],
    updated: TODAY,
  });

  return out;
}
