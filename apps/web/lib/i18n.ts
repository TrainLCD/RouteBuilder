import { getCachedStation } from './api/cache';
import type { StationId } from './api/types';

export type Lang = 'ja' | 'en';

const PLACEHOLDER = '…';

export function stationLabel(sid: StationId, lang: Lang = 'ja'): string {
  const s = getCachedStation(sid);
  if (!s) return PLACEHOLDER;
  if (lang === 'en' && s.nameRoman) return s.nameRoman;
  return s.name;
}

export function stationCode(sid: StationId): string {
  const s = getCachedStation(sid);
  if (!s) return '';
  const num = s.stationNumbers?.[0]?.stationNumber;
  if (num) return num;
  return s.threeLetterCode || '';
}
