import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, codeOf } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { Button } from './Button';
import s from './HelpChat.module.css';

type Turn = { role: 'user' | 'assistant'; content: string };

const MAX = 1000;

// Answers questions about using Nexa from the Help page text. The conversation lives only in this
// component: it is not saved, and closing the page clears it. No account or project data is sent.
export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const inputId = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns, busy]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    if (q.length > MAX) return setError(`Questions can have at most ${MAX} characters.`);
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setText('');
    setError(null);
    setBusy(true);
    try {
      const { answer } = await api<{ answer: string }>('/api/help/chat', { body: { messages: next.slice(-11) } });
      setTurns((t) => [...t, { role: 'assistant', content: answer }]);
    } catch (err) {
      // The question is taken back so the conversation stays in turn order.
      setTurns((t) => t.slice(0, -1));
      setText(q);
      setError(errorMessage(codeOf(err)));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!open) {
    return (
      <Button ref={launcher} className={s.launcher} variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Ask the help chat
      </Button>
    );
  }

  return (
    <section
      className={s.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <div className={s.head}>
        <h2 id={titleId} className={s.title}>
          Help chat
        </h2>
        <Button size="sm" variant="text" onClick={close}>
          Close
        </Button>
      </div>
      <div ref={log} className={s.log} role="log" aria-live="polite" aria-relevant="additions">
        <p className={s.note}>
          Answers are written by an AI model from the <Link to="/help">Help page</Link> and can be wrong. The chat cannot see your account or projects. Do not enter personal data. Messages are not saved.
        </p>
        {turns.map((t, i) => (
          <p key={i} className={t.role === 'user' ? s.user : s.assistant}>
            <span className={s.who}>{t.role === 'user' ? 'You' : 'Help chat'}</span>
            {t.content}
          </p>
        ))}
        {busy ? <p className={s.note}>Writing an answer</p> : null}
      </div>
      <form className={s.form} onSubmit={send}>
        <label htmlFor={inputId} className="visually-hidden">
          Your question
        </label>
        <textarea
          id={inputId}
          ref={input}
          className={s.input}
          value={text}
          maxLength={MAX}
          placeholder="Ask a question about using Nexa"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
        {error ? (
          <p role="alert" className={s.error}>
            Error: {error}
          </p>
        ) : null}
        <div className={s.row}>
          <span className={s.note}>
            {text.length} of {MAX} characters
          </span>
          <Button type="submit" size="sm" disabled={busy || !text.trim()}>
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}
