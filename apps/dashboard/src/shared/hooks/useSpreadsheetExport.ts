import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n/index';
import { loadExportUtils, type ExportUtils } from '../lib/loadExportUtils';

interface RunOptions {
  /** Toast shown when the chunk fails to load or the write throws. */
  errorMessage?: string;
}

/**
 * Runs a spreadsheet export against the lazily loaded `exportUtils` chunk.
 *
 * `isExporting` covers the chunk download as well as the write: on shop wifi the download
 * is the slow part, and a button with no feedback gets pressed again. A failed load
 * (offline, or a stale deploy whose chunk hash is gone) becomes an error toast rather than
 * an unhandled rejection. `run` resolves `true` only when `write` completed.
 */
export function useSpreadsheetExport() {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  // State lags a render behind a double press; the ref does not.
  const inFlight = useRef(false);

  const run = useCallback(
    async (write: (utils: ExportUtils) => void, options: RunOptions = {}) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setIsExporting(true);
      try {
        const utils = await loadExportUtils();
        write(utils);
        return true;
      } catch {
        toast.error(options.errorMessage ?? t('export.failed'));
        return false;
      } finally {
        inFlight.current = false;
        setIsExporting(false);
      }
    },
    [t]
  );

  return { isExporting, run };
}
