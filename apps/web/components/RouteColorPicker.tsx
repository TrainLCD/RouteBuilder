'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../lib/i18n';

const PRESETS = [
  '#d73a3a',
  '#f57c00',
  '#fbc02d',
  '#5cb85c',
  '#00bcd4',
  '#5b8def',
  '#9c27b0',
  '#e91e63',
];

type Props = {
  /** Explicit user-chosen color, or `undefined` for "auto" (use `fallback`). */
  value: string | undefined;
  /** Color the swatch displays when `value` is undefined — typically the
   *  first segment's line color so the picker shows what the auto-derived
   *  state actually looks like. */
  fallback: string;
  onChange: (next: string | undefined) => void;
  lang: Lang;
};

/**
 * Color swatch button + popover for overriding a route's accent color.
 * Three sources, in priority order: explicit user choice → preset
 * palette → derived line color. The "auto" reset clears the override
 * and falls back to whatever the line system picks.
 */
export function RouteColorPicker({ value, fallback, onChange, lang }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const display = value ?? fallback;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="iconbtn route-color-trigger"
        title={lang === 'en' ? 'Route color' : 'ルートの色'}
        aria-label={lang === 'en' ? 'Route color' : 'ルートの色'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="route-color-swatch" style={{ background: display }} />
      </button>
      {open && (
        <div className="color-popover" role="dialog">
          <div className="color-popover-swatches">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${value === c ? 'is-current' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                aria-label={c}
              />
            ))}
            <button
              type="button"
              className="color-swatch color-swatch-custom"
              title={lang === 'en' ? 'Custom color' : 'カスタム'}
              onClick={() => nativeRef.current?.click()}
            >
              <input
                ref={nativeRef}
                type="color"
                value={value ?? fallback}
                onChange={(e) => onChange(e.target.value)}
                tabIndex={-1}
                aria-hidden
              />
            </button>
          </div>
          {value != null && (
            <button
              type="button"
              className="btn btn-ghost btn-sm color-popover-reset"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              {lang === 'en' ? 'Reset to auto' : '自動色に戻す'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
