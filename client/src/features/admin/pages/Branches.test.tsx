import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import BranchesPage from './Branches';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('Branches manager selector', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('loads paginated users only while the branch editor is open', async () => {
    const transport = createMemoryTransport({ branches: [], users: [] });
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });
    await screen.findByRole('heading', { name: 'Branch Management' });
    expect(transport.calls().some((call) => call.path === 'users')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Add Branch' }));
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

  it('requests transfer filtering and pagination from the backend', async () => {
    const transport = createMemoryTransport(
      { branches: [] },
      { reads: { 'branches/transfers': [] } }
    );
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByRole('button', { name: 'Stock Transfers' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'branches/transfers',
          params: expect.objectContaining({
            page: 1,
            pageSize: 25,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        })
      )
    );

    fireEvent.click(screen.getByLabelText('Transfer status'));
    const completedOptions = await screen.findAllByText('Completed');
    fireEvent.click(completedOptions[completedOptions.length - 1]);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          path: 'branches/transfers',
          params: expect.objectContaining({ status: 'completed', page: 1 }),
        })
      )
    );
  });
});
