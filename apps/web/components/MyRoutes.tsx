import { Fragment } from 'react';
import { getCachedLine } from '../lib/api/cache';
import type { Route } from '../lib/data';
import { useDataStore } from '../lib/hooks/useDataStore';
import { useAllRoutesData } from '../lib/hooks/useRouteData';
import { stationLabel, type Lang } from '../lib/i18n';
import { isRouteDataReady, summarizeRoute } from '../lib/route-utils';
import { Icon } from './ui/Icon';

type Props = {
  routes: Route[];
  lang: Lang;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export function MyRoutes({ routes, lang, onOpen, onNew, onDelete }: Props) {
  useAllRoutesData(routes.map((r) => r.stations));
  useDataStore();

  return (
    <div className="routes-grid">
      <div className="route-card new" onClick={onNew} role="button" tabIndex={0}>
        <div
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--ink)', color: 'var(--surface)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Icon name="plus" size={18} />
        </div>
        <div style={{ fontWeight: 600 }}>{lang === 'en' ? 'New route' : '新しいルート'}</div>
        <div className="muted" style={{ fontSize: 12, textAlign: 'center', maxWidth: 200 }}>
          {lang === 'en'
            ? 'Build a route by chaining stations along connected lines.'
            : '駅をつないでルートを組み立てます'}
        </div>
      </div>
      {routes.map((r) =>
        isRouteDataReady(r.stations) ? (
          <RouteCard key={r.id} route={r} lang={lang} onOpen={onOpen} onDelete={onDelete} />
        ) : (
          <RouteCardSkeleton key={r.id} route={r} lang={lang} onOpen={onOpen} onDelete={onDelete} />
        ),
      )}
    </div>
  );
}

type CardProps = {
  route: Route;
  lang: Lang;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

function RouteCard({ route, lang, onOpen, onDelete }: CardProps) {
  const sum = summarizeRoute(route.stations);
  const accentLine = sum.lines[0] != null ? getCachedLine(sum.lines[0]) : undefined;
  const accentColor = accentLine?.color ?? route.color ?? 'var(--accent)';
  return (
    <div
      className="route-card"
      onClick={() => onOpen(route.id)}
      style={{ ['--rc-accent' as string]: accentColor } as React.CSSProperties}
    >
      <div className="rc-head">
        <div>
          <div className="rc-name">{route.name}</div>
          <div className="rc-flow truncate">
            {route.stations.slice(0, 4).map((sid, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="arrow">→</span>}
                <span>{stationLabel(sid, lang)}</span>
              </Fragment>
            ))}
            {route.stations.length > 4 && (
              <span className="arrow">…→ {stationLabel(route.stations[route.stations.length - 1], lang)}</span>
            )}
          </div>
        </div>
        <button
          className="iconbtn"
          onClick={(e) => { e.stopPropagation(); onDelete(route.id); }}
          title={lang === 'en' ? 'Delete' : '削除'}
        >
          <Icon name="trash" />
        </button>
      </div>
      <div className="rc-bar">
        {sum.segs?.map((s, i) => {
          const line = s.line != null ? getCachedLine(s.line) : null;
          return (
            <div
              key={i}
              style={{ background: line?.color ?? 'var(--danger)' }}
            />
          );
        })}
      </div>
      <div className="rc-foot">
        <span className="mono">
          {sum.stations} {lang === 'en' ? 'stops' : '駅'} · {sum.transfers} {lang === 'en' ? 'transfers' : '乗換'}
        </span>
        <span className="mono">{route.updated}</span>
      </div>
    </div>
  );
}

/**
 * Same outer dimensions as a real RouteCard, but the parts that depend on
 * still-loading cache data (station name flow, segment color bar, stops /
 * transfers counts) render as gentle pulse blocks. Name + date are stable
 * route metadata so they stay readable. Top accent stripe falls back to
 * the route's saved color, or the theme accent — so it doesn't pop in
 * later either.
 */
function RouteCardSkeleton({ route, lang, onOpen, onDelete }: CardProps) {
  const accentColor = route.color ?? 'var(--accent)';
  return (
    <div
      className="route-card"
      onClick={() => onOpen(route.id)}
      style={{ ['--rc-accent' as string]: accentColor } as React.CSSProperties}
      aria-busy="true"
    >
      <div className="rc-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rc-name">{route.name}</div>
          <div className="skeleton" style={{ width: '80%', maxWidth: 200, height: 12, marginTop: 6 }} />
        </div>
        <button
          className="iconbtn"
          onClick={(e) => { e.stopPropagation(); onDelete(route.id); }}
          title={lang === 'en' ? 'Delete' : '削除'}
        >
          <Icon name="trash" />
        </button>
      </div>
      <div className="skeleton" style={{ height: 6, borderRadius: 3, marginTop: 'auto' }} />
      <div className="rc-foot">
        <div className="skeleton" style={{ width: 110, height: 12 }} />
        <span className="mono">{route.updated}</span>
      </div>
    </div>
  );
}
