import { createContext, useContext, useMemo } from 'react';
import { createHttpTransport } from './http';
import type { Transport } from './types';

export const TransportContext = createContext<Transport | null>(null);

/**
 * The transport in force. Falls back to the real HTTP one so pages work
 * without any wiring; tests supply an in-memory transport through the provider.
 */
export function useTransport(): Transport {
  const provided = useContext(TransportContext);
  const fallback = useMemo(() => createHttpTransport(), []);
  return provided ?? fallback;
}
