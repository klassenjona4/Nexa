import { useSyncExternalStore } from 'react';

// Breakpoints from the handoff: mobile under 600, tablet 600 to 1023, desktop 1024 and up.
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function current(): Breakpoint {
  const w = window.innerWidth;
  return w < 600 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, current, () => 'desktop');
}
