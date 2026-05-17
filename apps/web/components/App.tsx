'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCachedLine } from '../lib/api/cache';
import type { StationId } from '../lib/api/types';
import type { Route } from '../lib/data';
import { buildSampleRoutes } from '../lib/data/sample-routes';
import { stationLabel } from '../lib/i18n';
import { summarizeRoute } from '../lib/route-utils';
import { useLocalStorage } from '../lib/hooks/useLocalStorage';
import { useTweaks } from '../lib/hooks/useTweaks';
import { useDataStore } from '../lib/hooks/useDataStore';
import { useAllRoutesData } from '../lib/hooks/useRouteData';
import { Icon } from './ui/Icon';
import { MyRoutes } from './MyRoutes';
import { Builder, type SearchPayload } from './Builder';
import { ExportPanel } from './ExportPanel';
import { SearchSheet, type PickOptions } from './SearchSheet';
import { RouteColorPicker } from './RouteColorPicker';
import { TweakButton, TweakRadio, TweakSection, TweaksPanel } from './TweaksPanel';

// NOTE: AI route generation (NLSheet + lib/ai.ts) is wired but the entry
// points are hidden until the feature ships. To re-enable, restore the
// imports / entry buttons below — see git history for the prior shape.

type View = 'routes' | 'builder' | 'export';

type Toast = { id: string; msg: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Coerce values from localStorage to the current `Route[]` shape. Anything
 * malformed or with non-numeric station entries is dropped. Pairs with the
 * versioned localStorage key (`route-builder/routes-v2`) — older shapes from
 * earlier prototypes live under the old key and never reach here.
 */
function sanitizeRoutes(value: unknown): Route[] {
  if (!Array.isArray(value)) return [];
  const out: Route[] = [];
  for (const r of value) {
    if (!r || typeof r !== 'object') continue;
    const stations = (r as Route).stations;
    if (!Array.isArray(stations)) continue;
    if (!stations.every((s) => typeof s === 'number' && Number.isFinite(s))) continue;
    // `passing` is optional. Keep only ids that are also in `stations`;
    // anything malformed or empty: drop the field (treat as all-stop).
    const rawPassing = (r as Route).passing;
    let passing: number[] | undefined;
    if (Array.isArray(rawPassing)) {
      const stationSet = new Set(stations);
      const cleaned = rawPassing.filter(
        (s): s is number => typeof s === 'number' && Number.isFinite(s) && stationSet.has(s),
      );
      if (cleaned.length > 0) passing = cleaned;
    }
    out.push({ ...(r as Route), stations, passing });
  }
  return out;
}

export function App() {
  const { tweaks, setTweak } = useTweaks();
  const lang = tweaks.lang;

  const [routes, setRoutes] = useLocalStorage<Route[]>(
    'route-builder/routes-v2',
    [],
    sanitizeRoutes,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRoute = useMemo(() => routes.find((r) => r.id === activeId), [routes, activeId]);

  const [view, setView] = useState<View>('routes');
  const [search, setSearch] = useState<SearchPayload | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useAllRoutesData(routes.map((r) => r.stations));
  useDataStore();

  // First-run sample seed: if localStorage was empty, build samples from the API.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (routes.length > 0) {
      seededRef.current = true;
      return;
    }
    seededRef.current = true;
    void (async () => {
      const samples = await buildSampleRoutes();
      if (samples.length > 0) setRoutes(samples);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushToast = useCallback((msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
  }, [tweaks.theme]);

  const updateRoute = useCallback(
    (next: Route) => {
      setRoutes((rs) => rs.map((r) => (r.id === next.id ? { ...next, updated: todayIso() } : r)));
    },
    [setRoutes],
  );

  const openRoute = (id: string) => {
    setActiveId(id);
    setView('builder');
  };

  const newRoute = () => {
    const id = 'r-' + Math.random().toString(36).slice(2, 8);
    const fresh: Route = {
      id,
      name: lang === 'en' ? 'New Route' : '新しいルート',
      stations: [],
      updated: todayIso(),
    };
    setRoutes((rs) => [fresh, ...rs]);
    setActiveId(id);
    setView('builder');
    setTimeout(() => setSearch({ insertAt: 0 }), 200);
  };

  const deleteRoute = (id: string) => {
    if (!window.confirm(lang === 'en' ? 'Delete this route?' : 'このルートを削除しますか？')) return;
    setRoutes((rs) => rs.filter((r) => r.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setView('routes');
    }
  };

  const closeSearch = () => {
    if (activeRoute && activeRoute.stations.length === 0) {
      setRoutes((rs) => rs.filter((r) => r.id !== activeRoute.id));
      setActiveId(null);
      setView('routes');
    }
    setSearch(null);
  };

  const onPickStation = (sid: StationId, opts: PickOptions = {}) => {
    if (!activeRoute || !search) return;
    const stops = [...activeRoute.stations];
    if (opts.stitchedPath && Array.isArray(opts.stitchedPath)) {
      const chain = opts.stitchedPath;
      if (typeof search.replaceAt === 'number') {
        const at = search.replaceAt;
        const prev = at > 0 ? stops[at - 1] : null;
        const next = at < stops.length - 1 ? stops[at + 1] : null;
        const inner = chain.slice(prev ? 1 : 0, next ? chain.length - 1 : chain.length);
        stops.splice(at, 1, ...inner);
      } else {
        const at = search.insertAt!;
        const prev = at > 0 ? stops[at - 1] : null;
        const next = at < stops.length ? stops[at] : null;
        const inner = chain.slice(prev ? 1 : 0, next ? chain.length - 1 : chain.length);
        stops.splice(at, 0, ...inner);
      }
      const added = (typeof search.replaceAt === 'number')
        ? chain.length - 2
        : chain.length - (search.betweenPrev ? 1 : 0) - (search.betweenNext ? 1 : 0);
      if (added > 1) {
        pushToast(
          lang === 'en'
            ? `Added ${added - 1} extra stop${added - 1 === 1 ? '' : 's'} so the route stays connected.`
            : `途中の${added - 1}駅も一緒に追加しました`,
        );
      }
    } else if (typeof search.replaceAt === 'number') {
      stops[search.replaceAt] = sid;
    } else if (typeof search.insertAt === 'number') {
      stops.splice(search.insertAt, 0, sid);
    }
    updateRoute({ ...activeRoute, stations: stops });
    setSearch(null);
  };

  const reverseRoute = () => {
    if (!activeRoute) return;
    updateRoute({ ...activeRoute, stations: [...activeRoute.stations].reverse() });
  };

  const Rail = (
    <aside className="rail">
      <div className="rail-head">
        <div className="brand">
          <div className="brand-logo">
            <img src="/brand-icon.png" alt="" />
          </div>
          <div>
            <div>
              Route Builder
              <span className="beta-badge" aria-label="Beta release">BETA</span>
            </div>
            <div className="brand-sub">FOR TRAINLCD</div>
          </div>
        </div>
      </div>
      <div className="rail-section">
        <div
          className={`rail-item ${view === 'routes' ? 'active' : ''}`}
          onClick={() => { setActiveId(null); setView('routes'); }}
        >
          <span className="ricon"><Icon name="routes" /></span>
          <span>{lang === 'en' ? 'My routes' : 'マイルート'}</span>
        </div>
      </div>
      <div className="rail-section" style={{ flex: 1, overflow: 'auto' }}>
        <h3>{lang === 'en' ? 'Routes' : 'ルート'} · {routes.length}</h3>
        {routes.map((r) => {
          const sum = summarizeRoute(r.stations);
          const accentLine = sum.lines[0] != null ? getCachedLine(sum.lines[0]) : undefined;
          const swatchColor = r.color ?? accentLine?.color ?? 'var(--border-2)';
          return (
            <div
              key={r.id}
              className={`rail-route ${activeId === r.id ? 'active' : ''}`}
              onClick={() => openRoute(r.id)}
            >
              <div className="swatch" style={{ background: swatchColor }} />
              <div className="meta grow">
                <div className="name truncate">{r.name}</div>
                <div className="sub truncate">
                  {r.stations.length > 0
                    ? `${stationLabel(r.stations[0], lang)} → ${stationLabel(r.stations[r.stations.length - 1], lang)}`
                    : lang === 'en' ? 'empty' : '空'}
                </div>
              </div>
              <button
                className="iconbtn rail-route-delete"
                title={lang === 'en' ? 'Delete route' : 'ルートを削除'}
                aria-label={lang === 'en' ? 'Delete route' : 'ルートを削除'}
                onClick={(e) => { e.stopPropagation(); deleteRoute(r.id); }}
              >
                <Icon name="trash" />
              </button>
            </div>
          );
        })}
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 8, justifyContent: 'flex-start' }}
          onClick={newRoute}
        >
          <Icon name="plus" />{lang === 'en' ? 'New route' : '新規ルート'}
        </button>
      </div>
    </aside>
  );

  // NOTE: these are JSX *values*, not nested components.
  //   `const X = () => ...` + `<X />` makes React see a new component
  //   identity on every parent render, which unmounts the subtree (and
  //   blurs any focused input inside) on every keystroke. Storing them as
  //   JSX values keeps the element identity stable across re-renders.
  let topbar: React.ReactNode;
  if (view === 'routes' || !activeRoute) {
    topbar = (
      <div className="topbar">
        <div className="brand-logo mobile-only" style={{ width: 26, height: 32 }}>
          <img src="/brand-icon.png" alt="" />
        </div>
        <span className="beta-badge mobile-only">BETA</span>
        <div className="grow">
          <div className="title">{lang === 'en' ? 'My routes' : 'マイルート'}</div>
          <div className="sub">
            {lang === 'en'
              ? `${routes.length} saved route${routes.length === 1 ? '' : 's'}`
              : `保存済みルート ${routes.length} 件`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={newRoute}>
          <Icon name="plus" />{lang === 'en' ? 'New' : '新規'}
        </button>
      </div>
    );
  } else if (view === 'export') {
    topbar = (
      <div className="topbar">
        <button className="iconbtn" onClick={() => setView('builder')}>
          <Icon name="chevron" size={18} />
        </button>
        <div className="grow">
          <div className="title">{lang === 'en' ? 'Export & share' : 'エクスポート'}</div>
          <div className="sub crumb">{activeRoute.name}</div>
        </div>
      </div>
    );
  } else {
    const sum = summarizeRoute(activeRoute.stations);
    const accentLine = sum.lines[0] != null ? getCachedLine(sum.lines[0]) : undefined;
    topbar = (
      <div className="topbar">
        <button
          className="iconbtn"
          onClick={() => { setActiveId(null); setView('routes'); }}
          title={lang === 'en' ? 'Back' : '戻る'}
        >
          <Icon name="chevron" size={18} />
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <input
            className="title-input"
            value={activeRoute.name}
            onChange={(e) => updateRoute({ ...activeRoute, name: e.target.value })}
          />
          <div className="sub crumb">
            {sum.stations} {lang === 'en' ? 'STOPS' : '駅'} · {sum.transfers} {lang === 'en' ? 'TRANSFERS' : '乗換'} ·{' '}
            {sum.lines.length} {lang === 'en' ? 'LINES' : '路線'}
          </div>
        </div>
        <RouteColorPicker
          value={activeRoute.color}
          fallback={accentLine?.color ?? 'var(--accent)'}
          onChange={(next) => updateRoute({ ...activeRoute, color: next })}
          lang={lang}
        />
        <button className="iconbtn" title={lang === 'en' ? 'Reverse' : '反転'} onClick={reverseRoute}>
          <Icon name="swap" />
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setView('export')}>
          <Icon name="export" />{lang === 'en' ? 'Export' : 'エクスポート'}
        </button>
      </div>
    );
  }

  let body: React.ReactNode;
  if (view === 'routes' || !activeRoute) {
    body = <MyRoutes routes={routes} lang={lang} onOpen={openRoute} onNew={newRoute} onDelete={deleteRoute} />;
  } else if (view === 'export') {
    body = <ExportPanel route={activeRoute} lang={lang} onClose={() => setView('builder')} />;
  } else {
    body = (
      <Builder
        route={activeRoute}
        onChange={updateRoute}
        lang={lang}
        density={tweaks.density}
        onOpenSearch={(payload) => setSearch(payload)}
        onToast={pushToast}
      />
    );
  }

  const BotNav = (
    <nav className="botnav">
      <button className={view === 'routes' ? 'active' : ''} onClick={() => setView('routes')}>
        <span className="nav-icon"><Icon name="routes" /></span>
        <span>{lang === 'en' ? 'Routes' : 'ルート'}</span>
      </button>
      <button
        className={view === 'builder' && activeRoute ? 'active' : ''}
        onClick={() => { if (activeRoute) setView('builder'); else newRoute(); }}
      >
        <span className="nav-icon"><Icon name="builder" /></span>
        <span>{lang === 'en' ? 'Builder' : 'ビルダー'}</span>
      </button>
      <button
        className={view === 'export' && activeRoute ? 'active' : ''}
        onClick={() => { if (activeRoute) setView('export'); }}
      >
        <span className="nav-icon"><Icon name="export" /></span>
        <span>{lang === 'en' ? 'Export' : '共有'}</span>
      </button>
    </nav>
  );

  return (
    <>
      <div className="tester-notice" role="status">
        {lang === 'en'
          ? 'Right now only TrainLCD canary release testers can use all features.'
          : '現在TrainLCD カナリアリリースのテスターのみすべての機能をご利用いただけます。'}
      </div>
      <div id="app">
        {Rail}
        <main className="main">
          {topbar}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {body}
          </div>
          {BotNav}
        </main>
      </div>

      <SearchSheet
        open={!!search}
        onClose={closeSearch}
        onPick={onPickStation}
        prevId={search?.betweenPrev}
        nextId={search?.betweenNext}
        lang={lang}
        title={
          search?.replaceAt != null
            ? lang === 'en' ? 'Replace station' : '駅を差し替え'
            : lang === 'en' ? 'Add station' : '駅を追加'
        }
      />
      <TweaksPanel title="Tweaks">
        <TweakSection title={lang === 'en' ? 'Appearance' : '見た目'}>
          <TweakRadio
            label={lang === 'en' ? 'Theme' : 'テーマ'}
            value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'light', label: lang === 'en' ? 'Light' : 'ライト' },
              { value: 'dark', label: lang === 'en' ? 'Dark' : 'ダーク' },
            ]}
          />
          <TweakRadio
            label={lang === 'en' ? 'Language' : '言語'}
            value={tweaks.lang}
            onChange={(v) => setTweak('lang', v)}
            options={[
              { value: 'ja', label: '日本語' },
              { value: 'en', label: 'English' },
            ]}
          />
          <TweakRadio
            label={lang === 'en' ? 'Density' : '情報密度'}
            value={tweaks.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'compact', label: lang === 'en' ? 'Compact' : '簡潔' },
              { value: 'comfortable', label: lang === 'en' ? 'Comfortable' : '標準' },
            ]}
          />
        </TweakSection>
        <TweakSection title={lang === 'en' ? 'Demo' : 'デモ'}>
          <TweakButton
            label={lang === 'en' ? 'Reset sample routes' : 'サンプルを再生成'}
            onClick={() => {
              void (async () => {
                const samples = await buildSampleRoutes();
                setRoutes(samples);
                setActiveId(null);
                setView('routes');
              })();
            }}
          />
        </TweakSection>
      </TweaksPanel>

      {toasts.length > 0 && (
        <div className="toast-wrap">
          {toasts.map((t) => (
            <div key={t.id} className="toast">{t.msg}</div>
          ))}
        </div>
      )}
    </>
  );
}
