import { useEffect, useRef, useState } from 'react';
import { searchStationsByName } from '../lib/api/queries';
import {
  getCachedLineOrder,
  getCachedStation,
  getLineListStationIds,
  getStations,
  ingestStations,
} from '../lib/api/cache';
import type { LineId, StationId } from '../lib/api/types';
import { isAdjacent, shortestPath } from '../lib/data/routing';
import { stationLabel, type Lang } from '../lib/i18n';
import { Icon } from './ui/Icon';
import { LinePill } from './ui/LinePill';

export type PickOptions = { stitchedPath?: StationId[] };

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (sid: StationId, opts?: PickOptions) => void;
  prevId?: StationId;
  nextId?: StationId;
  lang: Lang;
  title?: string;
};

type ConnectedHit = { id: StationId };
type StitchedHit = { id: StationId; path: StationId[] };

const SEARCH_DEBOUNCE_MS = 220;

// Adjacency check is shared with routing.ts (`isAdjacent`) so the rules
// stay consistent across "can I add this?" and "is the route still valid?".

export function SearchSheet({ open, onClose, onPick, prevId, nextId, lang, title }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<ConnectedHit[]>([]);
  const [stitched, setStitched] = useState<StitchedHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setConnected([]);
      setStitched([]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (!trimmed) {
      setConnected([]);
      setStitched([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchStationsByName(trimmed, 30);
        if (cancelled) return;
        ingestStations(rows);

        // Each upstream row is a distinct `Station.id` (one row per operator
        // line at a physical location). Show every row so the user picks the
        // line they actually intend — that disambiguates transfers up front.
        const candidateIds: StationId[] = [];
        const seen = new Set<StationId>();
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          candidateIds.push(r.id);
        }

        const constrained = Boolean(prevId || nextId);
        if (!constrained) {
          if (cancelled) return;
          setConnected(candidateIds.map((id) => ({ id })));
          setStitched([]);
          setLoading(false);
          return;
        }

        // Pre-load constraint stations + candidate stations + every line
        // they touch in batched HTTP calls, then run adjacency checks
        // synchronously against the warm cache.
        const constraintIds: StationId[] = [];
        if (prevId) constraintIds.push(prevId);
        if (nextId) constraintIds.push(nextId);
        await getStations([...constraintIds, ...candidateIds]);
        if (cancelled) return;

        const lineIds = new Set<LineId>();
        for (const id of [...constraintIds, ...candidateIds]) {
          const s = getCachedStation(id);
          if (s?.line?.id != null) lineIds.add(s.line.id);
          for (const l of s?.lines || []) lineIds.add(l.id);
        }
        const missingLines = [...lineIds].filter((id) => !getCachedLineOrder(id));
        if (missingLines.length > 0) {
          await getLineListStationIds(missingLines);
          if (cancelled) return;
        }

        const conn: ConnectedHit[] = [];
        const candidates: StationId[] = [];
        for (const id of candidateIds) {
          const okPrev = !prevId || isAdjacent(prevId, id);
          const okNext = !nextId || isAdjacent(nextId, id);
          if (okPrev && okNext) conn.push({ id });
          else candidates.push(id);
        }
        setConnected(conn);

        // Stitch candidates: only with an active query and a constraint.
        // Cap to top 5 by shortest path length.
        const stitchHits: StitchedHit[] = [];
        for (const id of candidates.slice(0, 12)) {
          let path: StationId[] | null = null;
          if (prevId && nextId) {
            const a = await shortestPath(prevId, id);
            const b = await shortestPath(id, nextId);
            if (a && b) path = [...a, ...b.slice(1)];
          } else if (prevId) {
            path = await shortestPath(prevId, id);
          } else if (nextId) {
            path = await shortestPath(id, nextId);
          }
          if (path && path.length > 2) stitchHits.push({ id, path });
        }
        if (cancelled) return;
        stitchHits.sort((a, b) => a.path.length - b.path.length);
        setStitched(stitchHits.slice(0, 5));
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, prevId, nextId]);

  if (!open) return null;

  const constrained = Boolean(prevId || nextId);
  const hasQuery = q.trim().length > 0;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Icon name="search" />
          <div className="sheet-title">{title || (lang === 'en' ? 'Add station' : '駅を追加')}</div>
          <button className="iconbtn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="search-input-wrap">
          <input
            ref={inputRef}
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === 'en' ? 'Station name or romaji (e.g. Shinjuku)' : '駅名・ローマ字（例: 新宿、Shinjuku）'}
          />
          {constrained && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.04 }}>
              {prevId && (
                <span>
                  {lang === 'en' ? 'FROM' : '前の駅'}{' '}
                  <strong style={{ color: 'var(--ink)' }}>{stationLabel(prevId, lang)}</strong>
                </span>
              )}
              {prevId && nextId && <span> · </span>}
              {nextId && (
                <span>
                  {lang === 'en' ? 'TO' : '次の駅'}{' '}
                  <strong style={{ color: 'var(--ink)' }}>{stationLabel(nextId, lang)}</strong>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="sheet-body">
          {!hasQuery && (
            <div className="empty">
              {lang === 'en' ? 'Type a station name or romaji to search.' : '駅名またはローマ字を入力して検索'}
            </div>
          )}
          {hasQuery && loading && (
            <div className="empty">{lang === 'en' ? 'Searching…' : '検索中…'}</div>
          )}
          {hasQuery && !loading && connected.length === 0 && stitched.length === 0 && (
            <div className="empty">{lang === 'en' ? 'No matching stations' : '一致する駅がありません'}</div>
          )}
          {hasQuery && !loading && connected.length > 0 && (
            <>
              {constrained && (
                <div className="muted" style={{ fontSize: 11, padding: '10px 18px 4px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.08, textTransform: 'uppercase' }}>
                  {lang === 'en' ? 'Can be added here' : 'ここに追加できる駅'}
                </div>
              )}
              {connected.map(({ id }) => (
                <StationResult key={id} id={id} lang={lang} canPick onPick={() => onPick(id)} />
              ))}
            </>
          )}
          {hasQuery && !loading && stitched.length > 0 && (
            <div style={{ borderTop: connected.length > 0 ? '1px solid var(--border)' : 'none', marginTop: 6, paddingTop: 6 }}>
              <div className="muted" style={{ fontSize: 11, padding: '10px 18px 4px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.08, textTransform: 'uppercase' }}>
                {lang === 'en'
                  ? 'Not directly reachable — add intermediate stops?'
                  : '直接はつながりません — 間の駅も一緒に追加しますか？'}
              </div>
              {stitched.map(({ id, path }) => (
                <StationResult
                  key={id}
                  id={id}
                  lang={lang}
                  canPick={false}
                  stitchedPath={path}
                  onPickStitched={(p) => onPick(id, { stitchedPath: p })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type StationResultProps = {
  id: StationId;
  lang: Lang;
  canPick: boolean;
  onPick?: () => void;
  stitchedPath?: StationId[];
  onPickStitched?: (path: StationId[]) => void;
};

function StationResult({ id, lang, canPick, onPick, stitchedPath, onPickStitched }: StationResultProps) {
  const s = getCachedStation(id);
  if (!s) return null;
  // Surface this row's own line first (the operator context), then any other
  // lines the physical station serves. The first pill tells the user "you're
  // adding the Ginza-line version of 上野" at a glance.
  const ownLine = s.line ?? null;
  const otherLines = (s.lines ?? []).filter((l) => l.id !== ownLine?.id);
  const pills = ownLine ? [ownLine, ...otherLines] : otherLines;
  const handleClick = canPick
    ? onPick
    : stitchedPath
      ? () => onPickStitched?.(stitchedPath)
      : undefined;
  const code = s.stationNumbers?.[0]?.stationNumber || s.threeLetterCode || '';
  return (
    <div className="search-result" onClick={handleClick}>
      <div>
        <div className="sr-name">
          <span>{lang === 'en' && s.nameRoman ? s.nameRoman : s.name}</span>
          {lang !== 'en' && s.nameRoman && <span className="en">{s.nameRoman}</span>}
        </div>
        <div className="sr-meta">
          {code && <span className="sr-code">{code}</span>}
          {pills.slice(0, 4).map((l) => <LinePill key={l.id} lineId={l.id} lang={lang} />)}
          {pills.length > 4 && <span className="muted mono" style={{ fontSize: 11 }}>+{pills.length - 4}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 0 }}>
        {canPick ? (
          <span className="sr-conn">● {lang === 'en' ? 'Can add' : '追加できます'}</span>
        ) : stitchedPath && stitchedPath.length > 2 ? (
          <span
            className="sr-conn sr-stitched"
            title={stitchedPath.map((p) => stationLabel(p, lang)).join(' → ')}
          >
            <Icon name="sparkle" size={12} />{' '}
            {lang === 'en'
              ? `+${stitchedPath.length - 2} stop${stitchedPath.length - 2 === 1 ? '' : 's'} between`
              : `間に${stitchedPath.length - 2}駅を一緒に追加`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
