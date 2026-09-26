import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import s from './Toast.module.css';

type ToastApi = { show: (message: string) => void };
const ToastContext = createContext<ToastApi>({ show: () => {} });

// One toast at a time, role status, dismissed after 5 seconds.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div role="status" aria-live="polite">
        {message ? (
          <div className={s.toast}>
            <span className={s.message}>{message}</span>
            <button type="button" className={s.dismiss} onClick={() => setMessage(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
