import { type KeyboardEvent, useRef } from 'react';
import s from './Controls.module.css';

type Option<T extends string> = { value: T; label: string };

// Tabs with arrow key support. The caller renders the panel with role tabpanel.
export function Tabs<T extends string>({ label, options, value, onChange, small, idPrefix }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void; small?: boolean; idPrefix: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    const opt = options[next];
    if (opt) {
      onChange(opt.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className={s.tablist} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${o.value}`}
          aria-controls={`${idPrefix}-panel`}
          aria-selected={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          className={[s.tab, small ? s.tabSmall : ''].join(' ')}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterChips<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className={s.chips}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={s.chip} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({ label, options, value, onChange, disabled }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label={label} className={s.segmented} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={s.segment} disabled={disabled} onClick={() => value !== o.value && onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
