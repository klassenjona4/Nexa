import type { CSSProperties, ElementType, ReactNode } from 'react';
import s from './Display.module.css';

export type BadgeKind = 'todo' | 'in_progress' | 'done' | 'confirmed' | 'flagged';
const BADGE: Record<BadgeKind, { label: string; cls: string }> = {
  todo: { label: 'To do', cls: '' },
  in_progress: { label: 'In progress', cls: s.badgeProgress ?? '' },
  done: { label: 'Done', cls: s.badgeInk ?? '' },
  confirmed: { label: 'Confirmed', cls: '' },
  flagged: { label: 'Flagged', cls: s.badgeInk ?? '' },
};

export const STATUS_LABEL: Record<'todo' | 'in_progress' | 'done', string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

// Status is always written out. Fill differences are secondary.
export function Badge({ kind, small }: { kind: BadgeKind; small?: boolean }) {
  const b = BADGE[kind];
  return <span className={[s.badge, b.cls, small ? s.small : ''].join(' ')}>{b.label}</span>;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

const AVATAR_FONT = { 28: '0.6875rem', 32: '0.75rem', 40: '0.8125rem' } as const;

// Square initials. Always shown next to the name, so hidden from assistive technology.
export function Avatar({ name, size = 32 }: { name: string | null | undefined; size?: 28 | 32 | 40 }) {
  return (
    <span aria-hidden="true" className={s.avatar} style={{ width: size, height: size, fontSize: AVATAR_FONT[size] }}>
      {initials(name)}
    </span>
  );
}

export function Card({ children, compact, as: As = 'div', style, className, ...rest }: { children: ReactNode; compact?: boolean; as?: ElementType; style?: CSSProperties; className?: string } & Record<string, unknown>) {
  return (
    <As className={[s.card, compact ? s.cardCompact : '', className ?? ''].join(' ')} style={style} {...rest}>
      {children}
    </As>
  );
}

export function ProgressBar({ percent, tone = 'ink' }: { percent: number; tone?: 'ink' | 'slate' }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <span aria-hidden="true" className={s.progress}>
      <span className={[s.progressFill, tone === 'slate' ? s.progressSlate : ''].join(' ')} style={{ width: `${p}%` }} />
    </span>
  );
}

export function InlineNotice({ children, role }: { children: ReactNode; role?: 'status' | 'note' }) {
  return (
    <div className={s.notice} role={role}>
      {children}
    </div>
  );
}
