import { useMemo } from 'react';
import QRCode from 'qrcode';

type Props = { data: string };

/**
 * Renders a real QR code as SVG, encoding `data` with medium-level error
 * correction (covers ~15% damage — good enough for screen scans). Inherits
 * `currentColor` so the dark modules pick up the surrounding text color and
 * the SVG works in both light and dark themes.
 */
export function QR({ data }: Props) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
      return qr.modules;
    } catch {
      return null;
    }
  }, [data]);

  if (!matrix) return null;

  const size = matrix.size;
  // Build a list of dark module rects. Adjacent dark modules in the same row
  // are merged into a single rect, which roughly halves SVG node count.
  const rects: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < size; y++) {
    let runStart = -1;
    for (let x = 0; x < size; x++) {
      const dark = matrix.get(x, y) === 1;
      if (dark && runStart < 0) runStart = x;
      if (!dark && runStart >= 0) {
        rects.push({ x: runStart, y, w: x - runStart });
        runStart = -1;
      }
    }
    if (runStart >= 0) {
      rects.push({ x: runStart, y, w: size - runStart });
    }
  }

  // 2-module quiet zone padding per the QR spec.
  const padding = 2;
  const total = size + padding * 2;

  return (
    <svg viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges" aria-label="QR code">
      <rect x={0} y={0} width={total} height={total} fill="var(--surface, #fff)" />
      <g transform={`translate(${padding} ${padding})`} fill="currentColor">
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} />
        ))}
      </g>
    </svg>
  );
}
