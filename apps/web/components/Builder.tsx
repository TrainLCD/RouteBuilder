import { Fragment, useState } from 'react';
import { getCachedLine, getCachedStation } from '../lib/api/cache';
import type { StationGroupId } from '../lib/api/types';
import {
  connectingLineSync, ensureAdjacency, linesAt, shortestPath, validateRouteSync,
  type Route, type StationId,
} from '../lib/data';
import { useDataStore } from '../lib/hooks/useDataStore';
import { useRouteData } from '../lib/hooks/useRouteData';
import { stationLabel, type Lang } from '../lib/i18n';
import { summarizeRoute } from '../lib/route-utils';
import { Icon } from './ui/Icon';
import { LinePill } from './ui/LinePill';

export type Density = 'compact' | 'comfortable';

export type SearchPayload = {
  insertAt?: number;
  replaceAt?: number;
  betweenPrev?: StationGroupId;
  betweenNext?: StationGroupId;
};

type Props = {
  route: Route;
  onChange: (next: Route) => void;
  lang: Lang;
  density: Density;
  onOpenSearch: (payload: SearchPayload) => void;
  onToast: (msg: string) => void;
};

export function Builder({ route, onChange, lang, density, onOpenSearch, onToast }: Props) {
  useRouteData(route.stations);
  useDataStore();

  const stops = route.stations;
  const sum = summarizeRoute(stops);
  const passingSet = new Set(route.passing ?? []);
  const [drag, setDrag] = useState<{ from: number } | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragInvalid, setDragInvalid] = useState(false);

  const togglePassing = (sid: StationId) => {
    const next = new Set(passingSet);
    if (next.has(sid)) next.delete(sid);
    else next.add(sid);
    onChange({ ...route, passing: next.size > 0 ? [...next] : undefined });
  };

  const wouldStayConnected = (next: StationId[]) => {
    if (next.length < 2) return true;
    return validateRouteSync(next).ok;
  };

  const move = async (from: number, to: number) => {
    if (from === to) return;
    const next = [...stops];
    const [item] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, item);
    await ensureAdjacency(next);
    if (!wouldStayConnected(next)) {
      onToast(lang === 'en'
        ? "Can’t move there — the route would have a gap."
        : 'そこに動かすと駅と駅がつながりません');
      return;
    }
    onChange({ ...route, stations: next });
  };

  const remove = async (idx: number) => {
    let next = stops.filter((_, i) => i !== idx);
    if (idx > 0 && idx < stops.length - 1) {
      const a = stops[idx - 1];
      const b = stops[idx + 1];
      await ensureAdjacency([a, b]);
      if (!connectingLineSync(a, b)) {
        const path = await shortestPath(a, b);
        if (path) {
          const before = next.slice(0, idx);
          const after = next.slice(idx);
          next = [...before, ...path.slice(1, -1), ...after];
          onToast(lang === 'en'
            ? `Added ${path.length - 2} stop${path.length - 2 === 1 ? '' : 's'} so the route stays connected.`
            : `間の${path.length - 2}駅を追加してつなぎました`);
        } else {
          onToast(lang === 'en'
            ? "Can’t remove this — the route would split."
            : 'この駅は消せません（前後がつながらなくなります）');
          return;
        }
      }
    }
    onChange({ ...route, stations: next });
  };

  return (
    <div className="builder">
      <div className="summary">
        <div className="stat">
          <div className="label">{lang === 'en' ? 'Stops' : '駅数'}</div>
          <div className="value">{sum.stations}</div>
        </div>
        <div className="stat">
          <div className="label">{lang === 'en' ? 'Transfers' : '乗換'}</div>
          <div className="value">{sum.transfers}</div>
        </div>
        <div className="stat">
          <div className="label">{lang === 'en' ? 'Lines' : '路線数'}</div>
          <div className="value">{sum.lines.length}</div>
        </div>
      </div>

      {stops.length === 0 ? (
        <EmptyState lang={lang} onAdd={() => onOpenSearch({ insertAt: 0 })} />
      ) : (
        <div className="timeline">
          {stops.map((sid, i) => {
            const isStart = i === 0;
            const isEnd = i === stops.length - 1;
            const next = stops[i + 1];
            const seg = next ? sum.segs?.[i] : null;
            const stationLines = linesAt(sid);
            const cached = getCachedStation(sid);
            const code = cached?.stationNumbers?.[0]?.stationNumber || cached?.threeLetterCode || '';
            const segLine = seg && seg.line != null ? getCachedLine(seg.line) : null;
            // Pull the route's incident lines (segment going in / going out) to
            // the front of the pill list so a route on Ginza Line shows
            // Ginza first instead of unrelated lines like 新幹線 or 山手線.
            const incomingLineId = i > 0 ? sum.segs?.[i - 1]?.line : null;
            const outgoingLineId = seg?.line ?? null;
            const priorityIds = new Set<number>();
            if (incomingLineId != null) priorityIds.add(incomingLineId);
            if (outgoingLineId != null) priorityIds.add(outgoingLineId);
            const orderedLines = priorityIds.size > 0
              ? [
                  ...stationLines.filter((l) => priorityIds.has(l.id)),
                  ...stationLines.filter((l) => !priorityIds.has(l.id)),
                ]
              : stationLines;
            // 始発・終着は常に停車扱い。それ以外は ID ベースで通過判定。
            const isPassing = !isStart && !isEnd && passingSet.has(sid);
            return (
              <Fragment key={`${i}_${sid}`}>
                <div
                  className={`stop ${isStart ? 'start ' : ''}${isEnd ? 'end ' : ''}${
                    isPassing ? 'pass ' : ''
                  }${
                    dragOver === i ? (dragInvalid ? 'drop-invalid' : 'drop-target') : ''
                  }`}
                  draggable
                  onDragStart={() => setDrag({ from: i })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                    if (drag) {
                      const test = [...stops];
                      const [it] = test.splice(drag.from, 1);
                      test.splice(i > drag.from ? i - 1 : i, 0, it);
                      setDragInvalid(!wouldStayConnected(test));
                    }
                  }}
                  onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                  onDrop={() => {
                    if (drag) void move(drag.from, i);
                    setDrag(null); setDragOver(null); setDragInvalid(false);
                  }}
                  onDragEnd={() => { setDrag(null); setDragOver(null); setDragInvalid(false); }}
                >
                  <div className="marker">
                    {isStart ? <span>S</span> : isEnd ? <span>G</span> : isPassing ? null : <span className="inner" />}
                  </div>
                  <div className={`stop-card ${drag && drag.from === i ? 'dragging' : ''}`}>
                    <div style={{ minWidth: 0 }}>
                      <div className="station-name">
                        <span>{stationLabel(sid, lang)}</span>
                        {lang !== 'en' && density !== 'compact' && cached?.nameRoman && (
                          <span className="en">{cached.nameRoman}</span>
                        )}
                      </div>
                      {density !== 'compact' && (
                        <div className="station-meta">
                          {code && <span className="mono muted" style={{ fontSize: 11 }}>{code}</span>}
                          {orderedLines.slice(0, 4).map((l) => <LinePill key={l.id} lineId={l.id} lang={lang} />)}
                          {orderedLines.length > 4 && (
                            <span className="mono muted" style={{ fontSize: 11 }}>+{orderedLines.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="actions">
                      {!isStart && !isEnd && (
                        <button
                          className={`iconbtn pass-toggle ${isPassing ? 'is-pass' : ''}`}
                          title={
                            lang === 'en'
                              ? isPassing ? 'Mark as stop' : 'Mark as pass-through'
                              : isPassing ? '停車にする' : '通過にする'
                          }
                          aria-pressed={isPassing}
                          onClick={() => togglePassing(sid)}
                        >
                          <Icon name="pass" />
                        </button>
                      )}
                      <button
                        className="iconbtn"
                        title={lang === 'en' ? 'Replace' : '差し替え'}
                        onClick={() => onOpenSearch({
                          replaceAt: i,
                          betweenPrev: i > 0 ? stops[i - 1] : undefined,
                          betweenNext: i < stops.length - 1 ? stops[i + 1] : undefined,
                        })}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className="iconbtn"
                        title={lang === 'en' ? 'Remove' : '削除'}
                        onClick={() => void remove(i)}
                      >
                        <Icon name="trash" />
                      </button>
                      <span
                        className="iconbtn"
                        title={lang === 'en' ? 'Drag to reorder' : 'ドラッグで並び替え'}
                        style={{ cursor: 'grab' }}
                      >
                        <Icon name="drag" />
                      </span>
                    </div>
                  </div>
                </div>
                {segLine && (
                  <div
                    className="segment"
                    style={{ ['--seg-color' as string]: segLine.color } as React.CSSProperties}
                  >
                    <span className="seg-line-name">
                      {lang === 'en' && segLine.nameRoman ? segLine.nameRoman : segLine.nameShort}
                    </span>
                    <span className="seg-stops">→ 1 {lang === 'en' ? 'stop' : '駅'}</span>
                  </div>
                )}
                {i < stops.length - 1 && (
                  <div style={{ display: 'flex', margin: '4px 0' }}>
                    <button
                      className="insert-btn"
                      onClick={() => onOpenSearch({ insertAt: i + 1, betweenPrev: sid, betweenNext: next })}
                    >
                      <Icon name="plus" size={12} />
                      {lang === 'en' ? 'Insert station' : '駅を挿入'}
                    </button>
                  </div>
                )}
              </Fragment>
            );
          })}
          <div style={{ display: 'flex', margin: '12px 0 0' }}>
            <button
              className="insert-btn"
              onClick={() => onOpenSearch({
                insertAt: stops.length,
                betweenPrev: stops[stops.length - 1],
              })}
            >
              <Icon name="plus" size={12} />
              {lang === 'en' ? 'Add station to end' : '末尾に駅を追加'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ lang, onAdd }: { lang: Lang; onAdd: () => void }) {
  return (
    <div
      style={{
        border: '1px dashed var(--border-2)',
        borderRadius: 12,
        padding: '36px 20px',
        textAlign: 'center',
        color: 'var(--ink-2)',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
        {lang === 'en' ? 'No stations yet' : 'まだ駅がありません'}
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        {lang === 'en' ? 'Add a starting station to begin.' : '出発駅を追加して始めましょう'}
      </div>
      <button className="btn btn-primary" onClick={onAdd}>
        <Icon name="plus" />{lang === 'en' ? 'Add station' : '駅を追加'}
      </button>
    </div>
  );
}
