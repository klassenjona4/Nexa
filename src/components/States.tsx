import type { ReactNode } from 'react';
import { Button, ButtonLink } from './Button';
import { Label } from './Label';
import s from './States.module.css';

// Static skeleton with a text line. No animation.
export function LoadingState({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className={s.loading}>
      <Label>Loading</Label>
      <p className={s.loadingText}>{text}</p>
      <div aria-hidden="true" className={s.skeleton}>
        <div />
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

export function ErrorPanel({ title, body, onRetry, children }: { title: string; body: ReactNode; onRetry?: () => void; children?: ReactNode }) {
  return (
    <div role="alert" className={[s.panel, s.errorPanel].join(' ')}>
      <Label color="rust">Error</Label>
      <h2 className={s.title}>{title}</h2>
      <p className={s.body}>{body}</p>
      {onRetry || children ? (
        <div className={s.actions}>
          {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ label, title, body, action }: { label: string; title: string; body: ReactNode; action?: { label: string; to?: string; onClick?: () => void } }) {
  return (
    <div className={s.panel}>
      <Label>{label}</Label>
      <h2 className={s.title}>{title}</h2>
      <p className={s.body}>{body}</p>
      {action ? (
        <div className={s.actions}>
          {action.to ? <ButtonLink to={action.to}>{action.label}</ButtonLink> : <Button onClick={action.onClick}>{action.label}</Button>}
        </div>
      ) : null}
    </div>
  );
}
