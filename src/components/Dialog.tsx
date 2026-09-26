import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { TextField } from './Field';
import { Label } from './Label';
import s from './Dialog.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal from 600 px, bottom sheet below. Flat Sage backdrop. Focus is trapped and restored,
// Escape closes, and the page behind is inert.
export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  maxWidth = 560,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  maxWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    if (root) root.inert = true;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem?.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (root) root.inert = false;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={s.overlay}>
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={[s.dialog, className ?? ''].join(' ')}
        style={{ maxWidth }}
      >
        <div aria-hidden="true" className={s.grabber} />
        {children}
      </div>
    </div>,
    document.body,
  );
}

type ConfirmProps = {
  open: boolean;
  label: string;
  title: string;
  body: ReactNode;
  requireText?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

// Mounted only while open, so the typed confirmation starts empty every time.
export function ConfirmDialog(props: ConfirmProps) {
  return props.open ? <ConfirmDialogBody {...props} /> : null;
}

function ConfirmDialogBody({
  open,
  label,
  title,
  body,
  requireText,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const id = useId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !requireText || value.trim() === requireText;

  return (
    <Dialog open={open} onClose={onCancel} role="alertdialog" labelledBy={`${id}-t`} describedBy={`${id}-b`} maxWidth={480} className={s.confirm}>
      <Label>{label}</Label>
      <h2 id={`${id}-t`} className={s.title}>
        {title}
      </h2>
      <p id={`${id}-b`} className={s.body}>
        {body}
      </p>
      {requireText ? (
        <TextField label={`Type ${requireText} to confirm`} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" data-autofocus />
      ) : null}
      <div className={s.actions}>
        <Button
          size="lg"
          variant={destructive ? 'danger' : 'primary'}
          disabled={!ok || busy}
          onClick={async () => {
            if (!ok) return;
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button size="lg" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
