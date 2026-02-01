/**
 * React context for the DiffScheduler
 *
 * Provides access to the scheduler instance throughout the component tree.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { DiffScheduler } from './types';

const SchedulerContext = createContext<DiffScheduler | null>(null);

export interface SchedulerProviderProps {
  scheduler: DiffScheduler;
  children: ReactNode;
}

/**
 * Provider component that makes the DiffScheduler available to child components.
 *
 * @example
 * ```tsx
 * const scheduler = createDiffScheduler(worker);
 * <SchedulerProvider scheduler={scheduler}>
 *   <App />
 * </SchedulerProvider>
 * ```
 */
export function SchedulerProvider({
  scheduler,
  children,
}: SchedulerProviderProps) {
  return (
    <SchedulerContext.Provider value={scheduler}>
      {children}
    </SchedulerContext.Provider>
  );
}

/**
 * Hook to access the DiffScheduler from context.
 *
 * @throws Error if used outside of SchedulerProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useScheduler(): DiffScheduler {
  const scheduler = useContext(SchedulerContext);
  if (!scheduler) {
    throw new Error('useScheduler must be used within SchedulerProvider');
  }
  return scheduler;
}

/**
 * Hook to optionally access the DiffScheduler from context.
 *
 * Returns null if used outside of SchedulerProvider.
 * Use this for components that need graceful degradation when no scheduler is available.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalScheduler(): DiffScheduler | null {
  return useContext(SchedulerContext);
}
