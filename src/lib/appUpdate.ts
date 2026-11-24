import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { canReloadNow } from '../../shared/appUpdate';

// Keeps open pages on the latest version. The service worker stores the app files for fast,
// offline starts, so a page could keep showing an old version until a second reload. When a new
// version has taken over, the page reloads at a moment when nothing can be lost.
const loadedAt = Date.now();
const CHECK_EVERY_MS = 30 * 60_000;
let reloadPending = false;

function reloadIfPending(): void {
  if (!reloadPending) return;
  reloadPending = false;
  window.location.reload();
}

export function startAppUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onNeedReload() {
      reloadPending = true;
      if (canReloadNow(loadedAt, Date.now(), document.visibilityState === 'hidden')) reloadIfPending();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') reloadIfPending();
        else check();
      });
    },
  });
}

// Moving to another page is a safe moment: nothing is being typed on the page being left.
export function useApplyUpdateOnNavigate(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    reloadIfPending();
  }, [pathname]);
}
