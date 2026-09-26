import p from '../app/page.module.css';
import { EmptyState } from '../components/States';

export function Placeholder({ title }: { title: string }) {
  return (
    <div className={p.content}>
      <EmptyState label="Not built yet" title={title} body="This screen is part of a later milestone." />
    </div>
  );
}
