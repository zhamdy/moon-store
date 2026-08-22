import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, TransportProvider } from './transport/index';
import { createMemoryTransport, type MemoryTransport } from './transport/memory';
import { resource } from './resource';

interface Expense {
  id: number;
  category: string;
  amount: number;
}

const RENT: Expense = { id: 1, category: 'rent', amount: 1200 };
const SALARIES: Expense = { id: 2, category: 'salaries', amount: 5000 };

function wrapperFor(transport: MemoryTransport, providedClient?: QueryClient) {
  const queryClient =
    providedClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('resource', () => {
  it('gives the caller rows, never the response envelope', async () => {
    const transport = createMemoryTransport({ expenses: [RENT, SALARIES] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useList(), {
      wrapper: wrapperFor(transport),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([RENT, SALARIES]);
  });

  it('saves a record with no id as a new one', async () => {
    const transport = createMemoryTransport({ expenses: [RENT] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useSave(), {
      wrapper: wrapperFor(transport),
    });

    result.current.save({ category: 'utilities', amount: 300 });

    await waitFor(() => expect(transport.peek('expenses')).toHaveLength(2));
    expect(transport.peek('expenses')[1]).toMatchObject({ category: 'utilities', amount: 300 });
  });

  it('saves a record carrying an id as a change to that record', async () => {
    const transport = createMemoryTransport({ expenses: [RENT, SALARIES] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useSave(), {
      wrapper: wrapperFor(transport),
    });

    result.current.save({ id: 1, category: 'rent', amount: 1500 });

    await waitFor(() => expect(transport.peek('expenses')[0]).toMatchObject({ amount: 1500 }));
    expect(transport.peek('expenses')).toHaveLength(2);
  });

  it('removes a record', async () => {
    const transport = createMemoryTransport({ expenses: [RENT, SALARIES] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useRemove(), {
      wrapper: wrapperFor(transport),
    });

    result.current.remove(1);

    await waitFor(() => expect(transport.peek('expenses')).toEqual([SALARIES]));
  });

  it('refreshes the list after a save without the caller asking', async () => {
    const transport = createMemoryTransport({ expenses: [RENT] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => ({ list: expenses.useList(), saver: expenses.useSave() }), {
      wrapper: wrapperFor(transport),
    });

    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    result.current.saver.save({ category: 'utilities', amount: 300 });

    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });

  it('refreshes the list after a removal without the caller asking', async () => {
    const transport = createMemoryTransport({ expenses: [RENT, SALARIES] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(
      () => ({ list: expenses.useList(), remover: expenses.useRemove() }),
      { wrapper: wrapperFor(transport) }
    );

    await waitFor(() => expect(result.current.list.data).toHaveLength(2));

    result.current.remover.remove(1);

    await waitFor(() => expect(result.current.list.data).toEqual([SALARIES]));
  });

  it('fetches a single record', async () => {
    const transport = createMemoryTransport({ expenses: [RENT, SALARIES] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useOne(2), {
      wrapper: wrapperFor(transport),
    });

    await waitFor(() => expect(result.current.data).toEqual(SALARIES));
  });

  it('runs a sub-action against one record', async () => {
    const transport = createMemoryTransport({
      vendors: [{ id: 7, name: 'Acme', status: 'pending' }],
    });
    const vendors = resource<{ id: number; status: string }>('vendors');

    const { result } = renderHook(() => vendors.useAction('status'), {
      wrapper: wrapperFor(transport),
    });

    result.current.run({ id: 7, body: { status: 'active' } });

    await waitFor(() => expect(transport.peek('vendors')[0]).toMatchObject({ status: 'active' }));
  });

  it('runs a sub-action with the method that action requires', async () => {
    const transport = createMemoryTransport({
      vendors: [{ id: 7, name: 'Acme', status: 'pending' }],
    });
    const vendors = resource<{ id: number; status: string }>('vendors');

    const { result } = renderHook(() => vendors.useAction('status', { method: 'PUT' }), {
      wrapper: wrapperFor(transport),
    });

    result.current.run({ id: 7, body: { status: 'active' } });

    await waitFor(() => expect(transport.peek('vendors')[0]).toMatchObject({ status: 'active' }));
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({ method: 'PUT', path: 'vendors/7/status' })
    );
  });

  it('creates a payout against one vendor', async () => {
    const transport = createMemoryTransport({
      vendors: [{ id: 7, name: 'Acme', status: 'active', balance: 5000 }],
    });
    const vendors = resource<{ id: number; balance: number }>('vendors');

    const { result } = renderHook(() => vendors.useAction('payouts'), {
      wrapper: wrapperFor(transport),
    });

    result.current.run({
      id: 7,
      body: { amount: 1200, method: 'bank_transfer', reference: 'TRX-1' },
    });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: 'vendors/7/payouts',
          body: { amount: 1200, method: 'bank_transfer', reference: 'TRX-1' },
        })
      )
    );
  });

  it('reads a named sub-path of the collection', async () => {
    const transport = createMemoryTransport(
      { expenses: [RENT] },
      { reads: { 'expenses/pnl': { revenue: 10000, net_profit: 8800 } } }
    );
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useRead<{ net_profit: number }>('pnl'), {
      wrapper: wrapperFor(transport),
    });

    await waitFor(() => expect(result.current.data).toEqual({ revenue: 10000, net_profit: 8800 }));
  });

  it('passes list params through to the transport', async () => {
    const transport = createMemoryTransport({ expenses: [RENT] });
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useList({ limit: 100, category: 'rent' }), {
      wrapper: wrapperFor(transport),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: 'expenses',
        params: { limit: 100, category: 'rent' },
      })
    );
  });

  it('uses one deterministic key for equivalent params and removes undefined values', async () => {
    const transport = createMemoryTransport({ expenses: [RENT] });
    const expenses = resource<Expense>('expenses');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const wrapper = wrapperFor(transport, queryClient);

    const first = renderHook(
      () => expenses.useList({ search: 'rent', status: undefined, page: 1 }),
      {
        wrapper,
      }
    );
    await waitFor(() => expect(first.result.current.data).toEqual([RENT]));
    first.unmount();

    const second = renderHook(() => expenses.useList({ page: 1, search: 'rent' }), { wrapper });
    await waitFor(() => expect(second.result.current.data).toEqual([RENT]));

    expect(transport.calls()).toHaveLength(1);
  });

  it('keeps prior rows visible while a different list query refetches', async () => {
    let resolveSecond!: (value: { data: Expense[] }) => void;
    const transport = createMemoryTransport({ expenses: [RENT] });
    const originalRequest = transport.request.bind(transport);
    let requests = 0;
    transport.request = ((request) => {
      requests += 1;
      if (requests === 2)
        return new Promise((resolve) => {
          resolveSecond = resolve;
        }) as never;
      return originalRequest(request);
    }) as MemoryTransport['request'];
    const expenses = resource<Expense>('expenses');
    const { result, rerender } = renderHook(({ page }) => expenses.useList({ page }), {
      initialProps: { page: 1 },
      wrapper: wrapperFor(transport),
    });
    await waitFor(() => expect(result.current.data).toEqual([RENT]));

    rerender({ page: 2 });
    expect(result.current.data).toEqual([RENT]);
    expect(result.current.isFetching).toBe(true);
    resolveSecond({ data: [SALARIES] });
    await waitFor(() => expect(result.current.data).toEqual([SALARIES]));
  });

  it('invalidates every list variant after a mutation', async () => {
    const transport = createMemoryTransport({ expenses: [RENT] });
    const expenses = resource<Expense>('expenses');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['expenses', 'list', { page: 1 }], { data: [RENT] });
    queryClient.setQueryData(['expenses', 'list', { page: 2 }], { data: [SALARIES] });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => expenses.useSave(), {
      wrapper: wrapperFor(transport, queryClient),
    });

    result.current.save({ category: 'utilities', amount: 300 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] });
  });

  it('carries list meta alongside the rows', async () => {
    const transport = createMemoryTransport(
      { expenses: [RENT, SALARIES] },
      { meta: { expenses: { total_amount: 6200 } } }
    );
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useList(), {
      wrapper: wrapperFor(transport),
    });

    await waitFor(() => expect(result.current.meta).toEqual({ total_amount: 6200 }));
  });

  it('surfaces a failure in one normalized shape', async () => {
    const transport = createMemoryTransport({ expenses: [RENT] });
    transport.failNext('Amount must be positive', 400);
    const expenses = resource<Expense>('expenses');

    const { result } = renderHook(() => expenses.useSave(), {
      wrapper: wrapperFor(transport),
    });

    result.current.save({ category: 'rent', amount: -5 });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.error).toMatchObject({
      message: 'Amount must be positive',
      status: 400,
    });
  });
});
