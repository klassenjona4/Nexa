import type { CSSProperties, ReactNode } from 'react';

// The design system's uppercase label, screen size.
const COLORS = { ink: 'var(--ink)', graphite: 'var(--graphite)', rust: 'var(--rust)', sage: 'var(--sage)', paper: 'var(--paper)' };

export function Label({ children, color = 'graphite', as: As = 'span', style }: { children: ReactNode; color?: keyof typeof COLORS; as?: 'span' | 'p' | 'div'; style?: CSSProperties }) {
  return (
    <As
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: 'var(--label-tracking)',
        textTransform: 'uppercase',
        lineHeight: 1.2,
        color: COLORS[color],
        margin: 0,
        ...style,
      }}
    >
      {children}
    </As>
  );
}
