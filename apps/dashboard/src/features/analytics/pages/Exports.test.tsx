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

// `hidden: true` also covers re-opening the source Select a second time in one test: the
// first choice leaves the outer page aria-hidden per the note above.
const sourceTrigger = () => screen.getByRole('button', { name: /data/i, hidden: true });

async function openSources() {
  fireEvent.click(sourceTrigger());
  return within(await screen.findByRole('listbox', { hidden: true }));
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

  // The date-range picker has no native label association (it opens a custom popover
  // rather than being a labelled input), so it is found by its trigger's accessible name
  // and its manual-entry inputs are found next to their (unassociated) text labels.
  // jsdom never finishes the source listbox's exit animation either, so once a source has
  // been chosen the rest of the page (this control included) stays aria-hidden.
  const dateRangeTrigger = () =>
    screen.queryByRole('button', { name: /select date range/i, hidden: true });
  const dateInput = (labelText: string): HTMLInputElement => {
    const label = screen.getByText(labelText);
    const input = label.parentElement?.querySelector('input[type="date"]');
    if (!input) throw new Error(`No date input next to "${labelText}"`);
    return input as HTMLInputElement;
  };

  it('shows no date range control for Products or Customers', async () => {
    renderExports(csvTransport());

    expect(dateRangeTrigger()).not.toBeInTheDocument();

    await chooseSource('Customers');
    expect(dateRangeTrigger()).not.toBeInTheDocument();
  });

  it('sends no date params for Sales when no range is chosen', async () => {
    const transport = csvTransport();
    renderExports(transport);

    await chooseSource('Sales');
    expect(dateRangeTrigger()).toBeInTheDocument();
    fireEvent.click(downloadButtonAfterChoosing());

    await waitFor(() => expect(downloads).toEqual(['moon-sales-2026-09-11.csv']));
    expect(exportCalls(transport.calls())).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: 'exports/sales',
        responseType: 'blob',
        params: {},
      }),
    ]);
  });

  it('passes the chosen range as from/to on the Sales export', async () => {
    const transport = csvTransport();
    renderExports(transport);

    await chooseSource('Sales');
    fireEvent.click(dateRangeTrigger() as HTMLElement);
    fireEvent.change(dateInput('Start Date'), { target: { value: '2026-09-01' } });
    fireEvent.change(dateInput('End Date'), { target: { value: '2026-09-10' } });

    fireEvent.click(downloadButtonAfterChoosing());

    await waitFor(() => expect(downloads).toEqual(['moon-sales-2026-09-11.csv']));
    expect(exportCalls(transport.calls())).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: 'exports/sales',
        responseType: 'blob',
        params: { from: '2026-09-01', to: '2026-09-10' },
      }),
    ]);
  });

  it('drops a chosen range when switching back to Products', async () => {
    const transport = csvTransport();
    renderExports(transport);

    await chooseSource('Sales');
    fireEvent.click(dateRangeTrigger() as HTMLElement);
    fireEvent.change(dateInput('Start Date'), { target: { value: '2026-09-01' } });

    await chooseSource('Products');
    fireEvent.click(downloadButtonAfterChoosing());

    await waitFor(() => expect(downloads).toEqual(['moon-products-2026-09-11.csv']));
    const [call] = exportCalls(transport.calls());
    expect(call).toMatchObject({
      method: 'GET',
      path: 'exports/products',
      responseType: 'blob',
    });
    expect(call).not.toHaveProperty('params');
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
