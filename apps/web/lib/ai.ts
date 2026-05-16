import { ingestStations } from './api/cache';
import { searchStationsByName } from './api/queries';
import type { StationGroupId } from './api/types';
import { connectingLine, shortestPath } from './data';

export type AIResult = {
  name: string;
  stations: StationGroupId[];
  stitchedCount: number;
};

const STATION_TOKEN_RE = /([一-龥ぁ-んァ-ヴー]{2,8}|[A-Za-z]{3,15})/g;

async function resolveOne(token: string): Promise<StationGroupId | null> {
  try {
    const rows = await searchStationsByName(token, 1);
    if (rows.length === 0) return null;
    ingestStations(rows);
    return rows[0].groupId;
  } catch {
    return null;
  }
}

/**
 * Stub for the AI route generator. Pulls station-name-like tokens out of the
 * user request, resolves each through the GraphQL search, and stitches them
 * into a continuous route via BFS shortest paths.
 *
 * Replace with a real Claude API call when wiring to a backend.
 */
export async function generateRouteFromText(
  userRequest: string,
  anchor?: StationGroupId | null,
): Promise<AIResult> {
  await new Promise((r) => setTimeout(r, 350));

  const tokens = [...new Set(userRequest.match(STATION_TOKEN_RE) || [])];
  const resolved = (await Promise.all(tokens.map(resolveOne))).filter(
    (g): g is StationGroupId => g != null,
  );

  let chain: StationGroupId[] = [];
  if (anchor != null) {
    chain.push(anchor);
    for (const g of resolved) {
      if (chain[chain.length - 1] !== g) chain.push(g);
    }
  } else {
    chain = resolved;
  }

  if (chain.length === 0) {
    throw new Error('駅名が見つかりませんでした。例：「新宿から渋谷まで」');
  }

  const stitched: StationGroupId[] = [chain[0]];
  let stitchedCount = 0;
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1];
    const b = chain[i];
    const direct = await connectingLine(a, b);
    if (direct) {
      stitched.push(b);
    } else {
      const path = await shortestPath(a, b);
      if (path) {
        for (let j = 1; j < path.length; j++) stitched.push(path[j]);
        stitchedCount += path.length - 2;
      } else {
        stitched.push(b);
      }
    }
  }

  // De-dupe consecutive same-IDs (the user may have written the same station twice).
  const dedup = stitched.filter((s, i, a) => i === 0 || a[i - 1] !== s);

  const name = userRequest.trim().slice(0, 24) || 'AIルート';
  return { name, stations: dedup, stitchedCount };
}
