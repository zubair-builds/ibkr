/**
 * Context + hook for the shared refresh signal.
 *
 * Kept separate from RefreshContext.tsx so that file exports only a component
 * -- react-refresh/only-export-components requires the split for fast refresh
 * to work correctly.
 */

import { createContext, useContext } from 'react';

/** How often the shared tick advances. */
export const REFRESH_INTERVAL_MS = 5000;
export const DEFAULT_INTERVAL_MS = import.meta.env.VITE_POLL_INTERVAL_MS 
  ? parseInt(import.meta.env.VITE_POLL_INTERVAL_MS, 10) 
  : REFRESH_INTERVAL_MS;

export interface RefreshState {
  autoTick: number;
  manualTick: number;
  intervalMs: number | null;
  setIntervalMs: (ms: number | null) => void;
  refreshNow: () => void;
}

export const RefreshContext = createContext<RefreshState | null>(null);

/**
 * Subscribe to the shared refresh signal.
 *
 * Pass `everyNTicks` to poll less often than the base interval -- the Watchlist
 * uses this because /watchlist costs ~2s per symbol on the IB event loop, so
 * polling it every 5s would keep a market-data request cycle running forever.
 *
 * Returns a `token` to use as a useEffect dependency. It combines the gated
 * automatic tick with the manual one, so a slowed-down panel still refreshes
 * immediately when the user clicks Refresh. Both counters only ever increase,
 * so their sum changes whenever either does.
 */
export function useRefresh(everyNTicks = 1): { 
  token: number; 
  refreshNow: () => void;
  intervalMs: number | null;
  setIntervalMs: (ms: number | null) => void;
} {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used inside a RefreshProvider');

  const token = Math.floor(ctx.autoTick / Math.max(1, everyNTicks)) + ctx.manualTick;
  return { 
    token, 
    refreshNow: ctx.refreshNow,
    intervalMs: ctx.intervalMs,
    setIntervalMs: ctx.setIntervalMs
  };
}
