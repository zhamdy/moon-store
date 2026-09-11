import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport } from '../../../shared/lib/transport/memory';
import type {
  Transport,
  TransportRequest,
  TransportResult,
} from '../../../shared/lib/transport/types';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import ExportsPage from './Exports';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const csv = () => new Blob(['id,name\n1,Silk Dress\n'], { type: 'text/csv' });

function csvTransport() {
  return createMemoryTransport(
    {},
    {
      reads: {
        'exports/products': csv(),
        'exports/sales': csv(),
        'exports/customers': csv(),
      },
    }
  );
}

function renderExports(transport: Transport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
  return render(<ExportsPage />, { wrapper });
}

const downloadButton = () => screen.getByRole('button', { name: /download/i });

// jsdom never finishes the popover's exit animation, so after a choice the listbox stays
// mounted and everything outside it stays aria-hidden.
const downloadButtonAfterChoosing = () =>
  screen.getByRole('button', { name: /download/i, hidden: true });

const sourceTrigger = () => screen.getByRole('button', { name: /module/i });

async function openSources() {
  fireEvent.click(sourceTrigger());
  return within(await screen.findByRole('listbox'));
}

async function chooseSource(name: string) {
  const trigger = sourceTrigger();
  const listbox = await openSources();
  fireEvent.click(listbox.getByRole('option', { name }));
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  expect(trigger).toHaveTextContent(name);
}

const exportCalls = (calls: TransportRequest[]) =>
  calls.filter((call) => call.path === 'exports' || call.path.startsWith('exports/'));

let downloads: string[];
let connectedAtClick: boolean[];
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));
  useSettingsStore.setState({ locale: 'en' });

  downloads = [];
  connectedAtClick = [];
  createObjectURL = vi.fn(() => 'blob:moon-export');
  revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push(this.download);
    connectedAtClick.push(this.isConnected);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Exports page', () => {
  it('downloads the products CSV as a blob under a dated filename', async () => {
    const transport = csvTransport();
    renderExports(transport);

    fireEvent.click(downloadButton());

    await waitFor(() => expect(downloads).toEqual(['moon-products-2026-09-11.csv']));
    expect(exportCalls(transport.calls())).toEqual([
      expect.objectContaining({ method: 'GET', path: 'exports/products', responseType: 'blob' }),
    ]);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(connectedAtClick).toEqual([true]);
    expect(document.querySelector('a[download="moon-products-2026-09-11.csv"]')).toBeNull();
    // The revoke is deferred with setTimeout, so it lands after click resolves.
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:moon-export'));
  });

  it('dates the filename by the local calendar, not UTC, just after midnight', async () => {
    vi.setSystemTime(new Date(2026, 8, 12, 0, 30));
    renderExports(csvTransport());

    fireEvent.click(downloadButton());

    await waitFor(() => expect(downloads).toEqual(['moon-products-2026-09-12.csv']));
  });

  it.each([
    ['Sales', 'sales'],
    ['Customers', 'customers'],
  ])('downloads the %s CSV from its own endpoint', async (label, source) => {
    const transport = csvTransport();
    renderExports(transport);

    await chooseSource(label);
    fireEvent.click(downloadButtonAfterChoosing());

    await waitFor(() => expect(downloads).toEqual([`moon-${source}-2026-09-11.csv`]));
    expect(exportCalls(transport.calls())).toEqual([
      expect.objectContaining({ method: 'GET', path: `exports/${source}`, responseType: 'blob' }),
    ]);
  });

  it('shows the translated error toast and creates no download when the request fails', async () => {
    const transport = csvTransport();
    // A blob error body is never parsed, so a real failure reaches the page with no server wording.
    transport.failNext('', 500, undefined, undefined, 'exports/products');
    renderExports(transport);

    fireEvent.click(downloadButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Export failed. Try again.'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
    await waitFor(() => expect(downloadButton()).not.toBeDisabled());
    expect(downloadButton()).not.toHaveAttribute('data-loading');
  });

  it('issues no request to the export endpoints on mount', async () => {
    const transport = csvTransport();
    renderExports(transport);

    await screen.findByRole('heading', { name: 'Export Center' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(exportCalls(transport.calls())).toEqual([]);
  });

  it('offers exactly the three sources the server exports', async () => {
    renderExports(csvTransport());

    const listbox = await openSources();

    expect(listbox.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Products',
      'Sales',
      'Customers',
    ]);
  });

  it('confirms a successful download with a count-free toast', async () => {
    renderExports(csvTransport());

    fireEvent.click(downloadButton());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Export downloaded'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('ignores a second press while a download is pending', async () => {
    const calls: TransportRequest[] = [];
    let release: () => void = () => {};
    const transport: Transport = {
      request<T>(req: TransportRequest): Promise<TransportResult<T>> {
        calls.push(req);
        return new Promise((resolve) => {
          release = () => resolve({ data: csv() as T });
        });
      },
    };
    renderExports(transport);

    fireEvent.click(downloadButton());
    fireEvent.click(downloadButton());
    await waitFor(() => expect(downloadButton()).toBeDisabled());
    fireEvent.click(downloadButton());

    expect(calls).toHaveLength(1);

    release();

    await waitFor(() => expect(downloads).toEqual(['moon-products-2026-09-11.csv']));
    await waitFor(() => expect(downloadButton()).not.toBeDisabled());
    expect(calls).toHaveLength(1);
  });
});
