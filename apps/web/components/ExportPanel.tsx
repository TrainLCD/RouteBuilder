import { useEffect, useState } from 'react';
import type { Route } from '../lib/data';
import {
  directDeepLinkForRoute,
  shortDeepLinkForRoute,
  type DeepLinkChannel,
} from '../lib/deeplink';
import { useDataStore } from '../lib/hooks/useDataStore';
import { useRouteData } from '../lib/hooks/useRouteData';
import type { Lang } from '../lib/i18n';
import { isRouteDataReady, summarizeRoute } from '../lib/route-utils';
import { Icon } from './ui/Icon';
import { LinePill } from './ui/LinePill';
import { QR } from './ui/QR';

type Props = {
  route: Route;
  lang: Lang;
  onClose: () => void;
};

type LinkState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  | { kind: 'error'; fallbackUrl: string | null };

export function ExportPanel({ route, lang, onClose }: Props) {
  useRouteData(route.stations);
  useDataStore();

  const [copied, setCopied] = useState(false);
  const [canary, setCanary] = useState(false);
  const [useShortUrl, setUseShortUrl] = useState(false);
  const channel: DeepLinkChannel = canary ? 'canary' : 'prod';
  const [linkState, setLinkState] = useState<LinkState>({ kind: 'idle' });

  // Default to the direct sids= URL. The short-id= form is gated behind an
  // opt-in checkbox because the receiving end of `?id=` is a separate spec
  // (TrainLCD/MobileApp#6008) that costs real mobile-app work to support;
  // until that lands, opting in produces a link the released app can't open.
  useEffect(() => {
    if (route.stations.length < 2) {
      setLinkState({ kind: 'idle' });
      return;
    }
    if (!useShortUrl) {
      const direct = directDeepLinkForRoute(route, channel);
      setLinkState(direct ? { kind: 'ready', url: direct } : { kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    setLinkState({ kind: 'loading' });
    void (async () => {
      try {
        const url = await shortDeepLinkForRoute(route, channel, controller.signal);
        if (controller.signal.aborted) return;
        if (url) {
          setLinkState({ kind: 'ready', url });
        } else {
          setLinkState({
            kind: 'error',
            fallbackUrl: directDeepLinkForRoute(route, channel),
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setLinkState({
            kind: 'error',
            fallbackUrl: directDeepLinkForRoute(route, channel),
          });
        }
      }
    })();
    return () => controller.abort();
  }, [route, channel, useShortUrl]);

  const tooFewStations = route.stations.length < 2;
  const dataReady = tooFewStations || isRouteDataReady(route.stations);
  const linkResolved =
    linkState.kind === 'ready' ||
    linkState.kind === 'idle' ||
    (linkState.kind === 'error');
  const ready = dataReady && linkResolved;

  const displayUrl =
    linkState.kind === 'ready'
      ? linkState.url
      : linkState.kind === 'error'
        ? linkState.fallbackUrl
        : null;

  const copy = async () => {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore — clipboard might be blocked
    }
  };

  if (!ready) {
    return <ExportSkeleton lang={lang} onClose={onClose} />;
  }

  const sum = summarizeRoute(route.stations);

  return (
    <div className="export-panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{route.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {sum.stations} {lang === 'en' ? 'stops' : '駅'} · {sum.transfers} {lang === 'en' ? 'transfers' : '乗換'} ·{' '}
            {sum.lines.length} {lang === 'en' ? 'lines' : '路線'}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>
          <Icon name="x" />{lang === 'en' ? 'Close' : '閉じる'}
        </button>
      </div>

      <div className="qr-wrap">
        <div className="qr">
          {displayUrl ? <QR data={displayUrl} /> : null}
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {lang === 'en' ? 'Share this route' : 'このルートを共有'}
          </div>
          {linkState.kind === 'idle' && (
            <div className="muted" style={{ fontSize: 12 }}>
              {lang === 'en'
                ? 'Add at least two connected stations to generate a TrainLCD link.'
                : 'TrainLCDリンクを生成するには接続された駅を2つ以上追加してください'}
            </div>
          )}
          {(linkState.kind === 'ready' || (linkState.kind === 'error' && linkState.fallbackUrl)) && displayUrl && (
            <>
              {linkState.kind === 'error' && (
                <div className="muted" style={{ fontSize: 12, marginBottom: 6, color: 'var(--warn-fg)' }}>
                  {lang === 'en'
                    ? 'Short link unavailable — using full URL.'
                    : '短縮リンクを取得できなかったため、フルURLを表示しています'}
                </div>
              )}
              <div className="row" style={{ gap: 6 }}>
                <input
                  className="input mono"
                  style={{ fontSize: 11.5, padding: '6px 10px' }}
                  value={displayUrl}
                  readOnly
                />
                <button className="btn" onClick={() => void copy()}>
                  <Icon name={copied ? 'check' : 'copy'} />
                  {copied ? (lang === 'en' ? 'Copied' : 'コピー済') : (lang === 'en' ? 'Copy' : 'コピー')}
                </button>
              </div>
              <label
                className="row"
                style={{ gap: 6, marginTop: 8, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={canary}
                  onChange={(e) => setCanary(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{lang === 'en' ? 'Canary release' : 'カナリアリリース用'}</span>
              </label>
              <label
                className="row"
                style={{ gap: 6, marginTop: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={useShortUrl}
                  onChange={(e) => setUseShortUrl(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{lang === 'en' ? 'Use short URL' : '短縮URLを使用する'}</span>
              </label>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <a className="btn btn-primary" href={displayUrl}>
                  <Icon name="export" />{lang === 'en' ? 'Open in TrainLCD' : 'TrainLCDで開く'}
                </a>
                <button className="btn" onClick={() => void copy()}>
                  <Icon name="link" />{lang === 'en' ? 'Share link' : 'リンク共有'}
                </button>
              </div>
            </>
          )}
          {linkState.kind === 'error' && !linkState.fallbackUrl && (
            <div className="muted" style={{ fontSize: 12, color: 'var(--warn-fg)' }}>
              {lang === 'en'
                ? 'Could not generate a link. Try again later.'
                : 'リンクを生成できませんでした。時間をおいて再度お試しください'}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
        <div
          className="muted mono"
          style={{ fontSize: 10, letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 8 }}
        >
          {lang === 'en' ? 'Lines used' : '使用路線'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {sum.lines.length === 0 && <span className="muted">—</span>}
          {sum.lines.map((lid) => <LinePill key={lid} lineId={lid} lang={lang} />)}
        </div>
      </div>
    </div>
  );
}

function ExportSkeleton({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <div className="export-panel" aria-busy="true">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton" style={{ width: '60%', maxWidth: 220, height: 22, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '80%', maxWidth: 280, height: 12 }} />
        </div>
        {/* Keep Close interactive so the user is never trapped on a loading panel. */}
        <button className="btn btn-ghost" onClick={onClose}>
          <Icon name="x" />{lang === 'en' ? 'Close' : '閉じる'}
        </button>
      </div>

      <div className="qr-wrap">
        <div className="qr">
          <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 4 }} />
        </div>
        <div style={{ minWidth: 0, width: '100%' }}>
          <div className="skeleton" style={{ width: 140, height: 16, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 34, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: 150, height: 14, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 170, height: 14, marginBottom: 14 }} />
          <div className="row" style={{ gap: 8 }}>
            <div className="skeleton" style={{ width: 160, height: 36, borderRadius: 8 }} />
            <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
        <div className="skeleton" style={{ width: 90, height: 11, marginBottom: 10 }} />
        <div className="row" style={{ gap: 6 }}>
          <div className="skeleton" style={{ width: 90, height: 22, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 110, height: 22, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}
