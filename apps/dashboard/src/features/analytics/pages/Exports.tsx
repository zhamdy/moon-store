import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Select, SelectItem, Card, CardBody } from '@heroui/react';
import { format } from 'date-fns';
import { PageHeader, DateRangePicker, type DateRange } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { useTransport } from '../../../shared/lib/transport/index';
import { useGuardedMutation } from '../../../shared/lib/useGuardedMutation';

const SOURCES = ['products', 'sales', 'customers'] as const;
type ExportSource = (typeof SOURCES)[number];

const isExportSource = (value: string): value is ExportSource =>
  (SOURCES as readonly string[]).includes(value);

const EMPTY_RANGE: DateRange = { start: null, end: null };

interface DownloadRequest {
  source: ExportSource;
  range: DateRange;
}

export default function ExportsPage() {
  const { t } = useTranslation();
  const transport = useTransport();
  const [source, setSource] = useState<ExportSource>('products');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  const download = useGuardedMutation<DownloadRequest, Blob>({
    mutationFn: ({ source: selected, range }) =>
      transport
        .request<Blob>({
          method: 'GET',
          path: `exports/${selected}`,
          responseType: 'blob',
          // Only the sales export takes a date range — the server rejects unknown query
          // params on the others, so nothing is sent unless the source is sales.
          ...(selected === 'sales'
            ? {
                params: {
                  ...(range.start ? { from: format(range.start, 'yyyy-MM-dd') } : {}),
                  ...(range.end ? { to: format(range.end, 'yyyy-MM-dd') } : {}),
                },
              }
            : {}),
        })
        .then((r) => r.data),
    onSuccess: (blob, { source: selected }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      a.download = `moon-${selected}-${day}.csv`;
      // Detached anchors can navigate to the blob URL instead of downloading (WebKit), so
      // attach before clicking and revoke after the browser has had a turn to start the save.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    successMessage: t('exports.downloadedFile'),
    fallbackMessage: t('exports.downloadFailed'),
  });

  const sourceLabels: Record<ExportSource, string> = {
    products: t('exports.products'),
    sales: t('exports.sales'),
    customers: t('exports.customers'),
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('exports.title')} />

      <Card className="max-w-lg border border-border bg-card shadow-sm">
        <CardBody className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t('exports.downloadHeading')}
          </h2>
          <Select
            label={t('exports.source')}
            size="sm"
            variant="bordered"
            selectedKeys={[source]}
            disallowEmptySelection
            onChange={(e) => {
              if (isExportSource(e.target.value)) {
                setSource(e.target.value);
                // The range only applies to sales; drop it so a stale filter can't carry
                // over silently if the source is switched back later.
                if (e.target.value !== 'sales') setDateRange(EMPTY_RANGE);
              }
            }}
          >
            {SOURCES.map((s) => (
              <SelectItem key={s} textValue={sourceLabels[s]}>
                {sourceLabels[s]}
              </SelectItem>
            ))}
          </Select>
          {source === 'sales' && (
            <DateRangePicker
              label={t('exports.dateRange')}
              helperText={t('exports.dateRangeHelp')}
              value={dateRange}
              onChange={setDateRange}
            />
          )}
          <Button
            color="primary"
            onPress={() => download.submit({ source, range: dateRange })}
            isLoading={download.isPending}
            className="w-full"
            startContent={!download.isPending && <Download className="h-4 w-4" />}
          >
            {t('exports.download')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
