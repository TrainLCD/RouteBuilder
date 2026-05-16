import { getCachedLine } from '../../lib/api/cache';
import type { LineId } from '../../lib/api/types';
import type { Lang } from '../../lib/i18n';

type DotProps = { lineId: LineId; size?: number };

export function LineDot({ lineId, size = 10 }: DotProps) {
  const line = getCachedLine(lineId);
  if (!line) return null;
  return (
    <span
      className="dot"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: line.color,
        display: 'inline-block',
      }}
    />
  );
}

type PillProps = { lineId: LineId; lang?: Lang };

export function LinePill({ lineId, lang = 'ja' }: PillProps) {
  const line = getCachedLine(lineId);
  if (!line) return null;
  const label = lang === 'en' && line.nameRoman ? line.nameRoman : line.nameShort;
  return (
    <span className="pill" title={`${line.nameShort}${line.nameRoman ? ` / ${line.nameRoman}` : ''}`}>
      <span className="dot" style={{ background: line.color }} />
      <span style={{ fontFamily: 'inherit', fontSize: 11 }}>{label}</span>
    </span>
  );
}
