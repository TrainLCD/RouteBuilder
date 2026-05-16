import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './ui/Icon';

type Props = { title?: string; children: ReactNode };

export function TweaksPanel({ title = 'Tweaks', children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed',
          right: 14,
          bottom: 14,
          zIndex: 150,
          width: 40,
          height: 40,
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          boxShadow: 'var(--shadow-2)',
        }}
        aria-label={title}
        title={`${title} (Ctrl/Cmd + .)`}
      >
        <Icon name="sparkle" />
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 14,
            bottom: 64,
            zIndex: 150,
            width: 280,
            maxHeight: '70vh',
            overflow: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: 13 }}>{title}</strong>
            <button className="iconbtn" onClick={() => setOpen(false)}>
              <Icon name="x" />
            </button>
          </div>
          <div style={{ padding: '6px 0 12px' }}>{children}</div>
        </div>
      )}
    </>
  );
}

export function TweakSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '8px 14px' }}>
      <div
        className="muted mono"
        style={{
          fontSize: 10,
          letterSpacing: 0.08,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

type RadioProps<T extends string> = {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
};

export function TweakRadio<T extends string>({ label, value, onChange, options }: RadioProps<T>) {
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--ink-2)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <button
            key={o.value}
            className={`btn btn-sm ${value === o.value ? 'btn-primary' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TweakButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="btn btn-sm" onClick={onClick} style={{ width: '100%', justifyContent: 'flex-start' }}>
      {label}
    </button>
  );
}
