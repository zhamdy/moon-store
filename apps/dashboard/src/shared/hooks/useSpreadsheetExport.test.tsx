import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../store/settingsStore';
import { loadExportUtils, type ExportUtils } from '../lib/loadExportUtils';
import { useSpreadsheetExport } from './useSpreadsheetExport';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/loadExportUtils', () => ({ loadExportUtils: vi.fn() }));

const utils = () =>
  ({ exportToExcel: vi.fn(), exportMultiSheetExcel: vi.fn() }) as unknown as ExportUtils;

describe('useSpreadsheetExport', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    vi.mocked(loadExportUtils).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('is loading while the chunk downloads, then runs the write', async () => {
    let resolve!: (m: ExportUtils) => void;
    const mod = utils();
    vi.mocked(loadExportUtils).mockReturnValue(new Promise((r) => (resolve = r)));
    const write = vi.fn();
    const { result } = renderHook(() => useSpreadsheetExport());

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.run(write);
    });
    expect(result.current.isExporting).toBe(true);
    expect(write).not.toHaveBeenCalled();

    await act(async () => {
      resolve(mod);
      expect(await pending).toBe(true);
    });
    expect(write).toHaveBeenCalledWith(mod);
    expect(result.current.isExporting).toBe(false);
  });

  it('ignores a second press while the first export is in flight', async () => {
    let resolve!: (m: ExportUtils) => void;
    vi.mocked(loadExportUtils).mockReturnValue(new Promise((r) => (resolve = r)));
    const write = vi.fn();
    const { result } = renderHook(() => useSpreadsheetExport());

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.run(write);
      second = result.current.run(write);
    });
    await act(async () => {
      resolve(utils());
      await first;
    });
    expect(await second).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    expect(loadExportUtils).toHaveBeenCalledTimes(1);
  });

  it('turns a failed chunk load into an error toast, not a rejection', async () => {
    vi.mocked(loadExportUtils).mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported module')
    );
    const write = vi.fn();
    const { result } = renderHook(() => useSpreadsheetExport());

    await act(async () => {
      await expect(result.current.run(write)).resolves.toBe(false);
    });
    expect(write).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Export failed. Check your connection and try again.');
    expect(result.current.isExporting).toBe(false);
  });

  it('uses the caller error message when one is given', async () => {
    vi.mocked(loadExportUtils).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSpreadsheetExport());

    await act(async () => {
      await result.current.run(vi.fn(), { errorMessage: 'Failed to generate PDF' });
    });
    expect(toast.error).toHaveBeenCalledWith('Failed to generate PDF');
  });
});
