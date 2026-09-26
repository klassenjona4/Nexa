import type { ReactNode } from 'react';
import { Label } from '../components/Label';
import p from './page.module.css';

export function PageHeader({ label, title, intro, actions, id }: { label?: ReactNode; title: ReactNode; intro?: ReactNode; actions?: ReactNode; id?: string }) {
  const head = (
    <div className={p.header}>
      {label ? <Label>{label}</Label> : null}
      <h1 id={id} className={p.h1}>
        {title}
      </h1>
      {intro ? <p className={p.intro}>{intro}</p> : null}
    </div>
  );
  if (!actions) return head;
  return (
    <div className={p.headerRow}>
      {head}
      <div className={p.actions}>{actions}</div>
    </div>
  );
}
