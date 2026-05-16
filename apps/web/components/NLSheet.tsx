import { Fragment, useEffect, useRef, useState } from 'react';
import type { StationGroupId } from '../lib/api/types';
import { useDataStore } from '../lib/hooks/useDataStore';
import { stationLabel, type Lang } from '../lib/i18n';
import { generateRouteFromText, type AIResult } from '../lib/ai';
import { summarizeRoute } from '../lib/route-utils';
import { Icon } from './ui/Icon';

export type NLResult = AIResult;

type Props = {
  open: boolean;
  mode: 'create' | 'add';
  anchor: StationGroupId | null;
  onClose: () => void;
  onApply: (result: NLResult) => void;
  lang: Lang;
};

export function NLSheet({ open, mode, anchor, onClose, onApply, lang }: Props) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<NLResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Re-render once stations referenced by the suggested route arrive in cache.
  useDataStore();

  useEffect(() => {
    if (open) {
      setQ('');
      setBusy(false);
      setErr(null);
      setResult(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const out = await generateRouteFromText(q, mode === 'add' ? anchor : null);
      setResult(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const anchorName = anchor != null ? stationLabel(anchor, lang) : null;
  const examples = (mode === 'add' && anchor)
    ? lang === 'en'
      ? ['Extend to Asakusa', 'Continue to Ikebukuro via Yamanote', 'Add 3 more stops']
      : ['浅草まで延伸', '山手線経由で池袋まで', 'あと3駅追加']
    : lang === 'en'
      ? ['Shinjuku to Asakusa via Ginza', 'Yamanote loop', 'Kichijoji to Tokyo, fewest transfers']
      : ['新宿から浅草まで銀座経由', '渋谷から池袋まで山手線', '吉祥寺から東京まで最短で'];
  const placeholder = (mode === 'add' && anchor)
    ? lang === 'en' ? `Extend from ${anchorName} — e.g. "Continue to Asakusa"` : `${anchorName} から延伸（例：浅草まで）`
    : lang === 'en' ? 'e.g. Shinjuku to Asakusa via Ginza' : '例：新宿から浅草まで銀座経由で';

  const sum = result ? summarizeRoute(result.stations) : null;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="sheet-head">
          <Icon name="sparkle" />
          <div className="sheet-title">
            {mode === 'create'
              ? (lang === 'en' ? 'Create route with AI' : 'AIで新規作成')
              : (lang === 'en' ? 'Add with AI' : 'AIで追加')}
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <textarea
            ref={inputRef}
            className="input"
            rows={3}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask(); }}
            placeholder={placeholder}
            style={{ fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {examples.map((ex) => (
              <button key={ex} className="btn btn-sm btn-ghost" onClick={() => setQ(ex)}>{ex}</button>
            ))}
          </div>
        </div>
        <div className="sheet-body" style={{ padding: '0 18px' }}>
          {busy && <div className="empty">{lang === 'en' ? 'Thinking…' : '考えています…'}</div>}
          {err && (
            <div className="warn">
              <Icon name="warn" />
              <div>{err}</div>
            </div>
          )}
          {result && sum && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {mode === 'add'
                  ? (lang === 'en' ? 'Stops to append' : '追加される区間')
                  : (result.name || (lang === 'en' ? 'Suggested route' : '提案ルート'))}
              </div>
              <div className="rc-flow" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {result.stations.map((sid, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="arrow">→</span>}
                    <span>{stationLabel(sid, lang)}</span>
                  </Fragment>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>
                {sum.stations} {lang === 'en' ? 'STOPS' : '駅'} · {sum.transfers} {lang === 'en' ? 'TRANSFERS' : '乗換'}
                {result.stitchedCount > 0 && (
                  <span> · +{result.stitchedCount} {lang === 'en' ? 'AUTO-FILLED' : '自動補完'}</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            {lang === 'en' ? 'Cancel' : 'キャンセル'}
          </button>
          {result ? (
            <button className="btn btn-primary" onClick={() => onApply(result)}>
              <Icon name="check" />
              {mode === 'add'
                ? (lang === 'en' ? 'Append to route' : 'ルートに追加')
                : (lang === 'en' ? 'Create this route' : 'このルートを作成')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => void ask()} disabled={busy || !q.trim()}>
              <Icon name="sparkle" />{lang === 'en' ? 'Generate' : '生成'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
