import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';
import s from './Field.module.css';

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  compact?: boolean;
  hideLabel?: boolean;
  className?: string;
};

function describedBy(hintId: string, errorId: string, hint?: ReactNode, error?: string | null) {
  return [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
}

function Wrapper({ id, label, hint, error, compact, hideLabel, className, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : compact ? s.compactLabel : s.label}>
        {label}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className={s.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={s.error}>
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, compact, hideLabel, className, numeric, id: idProp, ...rest }: FieldProps & { numeric?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} compact={compact} hideLabel={hideLabel} className={className}>
      <input
        id={id}
        className={[s.control, numeric ? s.numeric : ''].join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        {...rest}
      />
    </Wrapper>
  );
}

export function TextArea({ label, hint, error, compact, hideLabel, className, id: idProp, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} compact={compact} hideLabel={hideLabel} className={className}>
      <textarea
        id={id}
        className={[s.control, s.textarea].join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        {...rest}
      />
    </Wrapper>
  );
}

export function SelectField({ label, hint, error, compact, hideLabel, className, id: idProp, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} compact={compact} hideLabel={hideLabel} className={className}>
      <select
        id={id}
        className={[s.control, s.select].join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </Wrapper>
  );
}

export { s as fieldStyles };
