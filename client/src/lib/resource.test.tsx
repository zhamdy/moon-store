import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, TransportProvider } from './transport';
import { createMemoryTransport, type MemoryTransport } from './transport/memory';
import { resource } from './resource';

interface Expense {
  id: number;
  category: string;
  amount: number;
}

const RENT: Expense = { id: 1, category: 'rent', amount: 1200 };
const SALARIES: Expense = { id: 2, category: 'salaries', amount: 5000 };

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
