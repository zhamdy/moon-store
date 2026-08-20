import type { ReactNode } from 'react';
import { TransportContext } from './context';
import type { Transport } from './types';

export function TransportProvider({
  transport,
  children,
}: {
  transport: Transport;
  children: ReactNode;
}) {
  return <TransportContext.Provider value={transport}>{children}</TransportContext.Provider>;
}
