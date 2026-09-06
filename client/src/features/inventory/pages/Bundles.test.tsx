import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import BundlesPage from './Bundles';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

const bundle = (id: number, name: string) => ({
  id,
  name,
  description: null,
  price: 200,
  status: 'active',
  items: [],
  original_price: 260,
  savings: 60,
  savings_percent: 23,
  created_at: '2026-09-01T00:00:00.000Z',
});

function renderBundles() {
  const transport = createMemoryTransport({
    bundles: [bundle(1, 'Winter capsule'), bundle(2, 'Resort set')],
  });
  render(<BundlesPage />, { wrapper: wrapperFor(transport) });
  return transport;
}

/**
 * #104: the edit and delete buttons used to sit inside a pressable card, which HeroUI
 * renders as a `<button>`. A screen reader could not reach them as separate controls
 * and the card's name absorbed their labels.
 */
describe('Bundles card actions', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it('renders no button inside another button, and React logs no nesting warning', async () => {
    renderBundles();
    await screen.findByText('Winter capsule');

    expect(document.querySelector('button button')).toBeNull();

    const nesting = [...warn.mock.calls, ...error.mock.calls]
      .flat()
      .filter((arg): arg is string => typeof arg === 'string')
      .filter((message) => message.includes('validateDOMNesting'));
    expect(nesting).toEqual([]);
  });

  it('names each row action for its own bundle rather than repeating a bare verb', async () => {
    renderBundles();
    await screen.findByText('Winter capsule');

    expect(screen.getByRole('button', { name: 'Winter capsule: Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Winter capsule: Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resort set: Edit' })).toBeInTheDocument();
  });

  it('opens the edit dialog without also opening the bundle the card points at', async () => {
    renderBundles();
    await screen.findByText('Winter capsule');

    fireEvent.click(screen.getByRole('button', { name: 'Winter capsule: Edit' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('Winter capsule')).toBeInTheDocument();
    // The card's own press swaps the grid for a detail view with a Back control.
    // Its absence is what proves the press did not fire alongside the edit action.
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('opens the bundle detail when the card itself is activated', async () => {
    renderBundles();
    const card = (await screen.findByText('Winter capsule')).closest('button');
    expect(card).not.toBeNull();

    fireEvent.click(card as HTMLElement);

    expect(await screen.findByRole('button', { name: /back/i })).toBeInTheDocument();
  });
});
