import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import CollectionsPage from './Collections';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

const product = (id: number, name: string) => ({
  id,
  name,
  sku: `SKU-${id}`,
  price: 100,
  stock: 5,
  position: id,
});

const featuredCollection = () => ({
  id: 1,
  name: 'Autumn window',
  season: 'Fall',
  year: 2026,
  status: 'active',
  description: 'The window',
  is_featured: true,
  product_count: 1,
  products: [product(20, 'Ivory coat')],
});

/**
 * The wire shape of a product edit, not the rendering.
 *
 * Adding or removing one product used to PUT most-but-not-all of the record: every
 * field the detail view happened to hold, which never included `is_featured`. The
 * server treated the omission as "set to default" and the collection quietly stopped
 * being featured (#78). The endpoint is now PATCH-style, so the fix on this side is
 * that the dialog sends only what it actually changed.
 */
describe('Collections product editing wire contract', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  const openDetail = async (transport: MemoryTransport) => {
    render(<CollectionsPage />, { wrapper: wrapperFor(transport) });
    fireEvent.click(await screen.findByText('Autumn window'));
    return screen.findByRole('button', { name: 'Add Product' });
  };

  it('sends only the product set when a product is removed, never the whole record', async () => {
    const transport = createMemoryTransport({
      collections: [featuredCollection()],
      products: [product(21, 'Slate dress')],
    });
    await openDetail(transport);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'PUT', path: 'collections/1', body: { product_ids: [] } })
      )
    );
  });

  it('sends only the product set when a product is added', async () => {
    const transport = createMemoryTransport({
      collections: [featuredCollection()],
      products: [product(21, 'Slate dress')],
    });
    await openDetail(transport);

    fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
    fireEvent.click(await screen.findByText('Slate dress'));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          path: 'collections/1',
          body: { product_ids: [20, 21] },
        })
      )
    );
  });

  it('never mentions is_featured on a product edit, so the server cannot reset it', async () => {
    const transport = createMemoryTransport({
      collections: [featuredCollection()],
      products: [product(21, 'Slate dress')],
    });
    await openDetail(transport);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(transport.peek('collections')[0].product_ids).toEqual([]));
    const writes = transport.calls().filter((call) => call.method === 'PUT');
    expect(writes).not.toHaveLength(0);
    for (const write of writes) {
      expect(Object.keys(write.body as Record<string, unknown>)).toEqual(['product_ids']);
    }
    // The memory transport merges a PUT onto the stored row exactly as the endpoint now
    // does, so the flag surviving here is the same assertion the server test makes.
    expect(transport.peek('collections')[0].is_featured).toBe(true);
  });
});
