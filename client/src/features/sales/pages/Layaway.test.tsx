import { describe, expect, it, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import LayawayPage from './Layaway';

function wrapperFor(transport: MemoryTransport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('Layaway', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('debounces product search and uses the paginated catalog contract', async () => {
    const transport = createMemoryTransport({ layaway: [], customers: [], products: [] });
    render(<LayawayPage />, { wrapper: wrapperFor(transport) });
    expect(transport.calls().some((call) => call.path === 'products')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Create Layaway' }));
    const search = await screen.findByRole('textbox', { name: 'Search products' });
    fireEvent.change(search, { target: { value: 'moon' } });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'products',
          params: expect.objectContaining({ page: 1, pageSize: 25, search: 'moon' }),
        })
      )
    );
  });
});
