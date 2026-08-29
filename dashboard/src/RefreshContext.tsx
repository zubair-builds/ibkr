/**
 * One interval for the whole dashboard.
 *
 * Panels previously each ran their own setInterval (or none at all), so they
 * refreshed at different times and the header's Refresh button only reached
 * the account/orders panel. Here a single timer drives everything, and
 * refreshNow() fans out to every subscriber.
 *
 * The context and the useRefresh hook live in ./refresh so this file can
 * export only the component.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshContext, DEFAULT_INTERVAL_MS } from './refresh';

export function RefreshProvider({
  children,
  defaultIntervalMs = DEFAULT_INTERVAL_MS,
}: {
  children: ReactNode;
  defaultIntervalMs?: number;
}) {
  const [autoTick, setAutoTick] = useState(0);
  const [manualTick, setManualTick] = useState(0);
  const [intervalMs, setIntervalMs] = useState<number | null>(defaultIntervalMs);

  useEffect(() => {
    if (intervalMs === null) return;
    const id = setInterval(() => setAutoTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const refreshNow = useCallback(() => setManualTick((t) => t + 1), []);

  const value = useMemo(
    () => ({ autoTick, manualTick, intervalMs, setIntervalMs, refreshNow }),
    [autoTick, manualTick, intervalMs, setIntervalMs, refreshNow],
  );

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}
