import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import AuditLog from './AuditLog';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('AuditLog user filter', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('uses the canonical paginated Users contract', async () => {
    const transport = createMemoryTransport(
      { 'audit-log': [], users: [] },
      { reads: { 'audit-log/actions': [], 'audit-log/entity-types': [] } }
    );
    render(<AuditLog />, { wrapper: wrapperFor(transport) });
    await screen.findByRole('heading', { name: 'Audit Log' });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'users',
          params: expect.objectContaining({ page: 1, pageSize: 25, sortBy: 'name' }),
        })
      )
    );
  });
});
