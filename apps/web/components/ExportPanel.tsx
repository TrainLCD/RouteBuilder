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
import { summarizeRoute } from '../lib/route-utils';
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

  const sum = summarizeRoute(route.stations);
  const [copied, setCopied] = useState(false);
  const [canary, setCanary] = useState(false);
  const channel: DeepLinkChannel = canary ? 'canary' : 'prod';
  const [linkState, setLinkState] = useState<LinkState>({ kind: 'idle' });

  // Compute the short URL whenever the route or channel changes. Short URLs
  // are content-addressed so re-exporting the same route returns the same id.
  useEffect(() => {
    if (route.stations.length < 2) {
      setLinkState({ kind: 'idle' });
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
  }, [route, channel]);

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
          {linkState.kind === 'loading' && (
            <div className="muted" style={{ fontSize: 12 }}>
              {lang === 'en' ? 'Generating short link…' : '短縮リンクを生成中…'}
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
