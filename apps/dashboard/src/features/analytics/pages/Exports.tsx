import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Select, SelectItem, Card, CardBody } from '@heroui/react';
import { PageHeader } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { useTransport } from '../../../shared/lib/transport/index';
import { useGuardedMutation } from '../../../shared/lib/useGuardedMutation';

const SOURCES = ['products', 'sales', 'customers'] as const;
type ExportSource = (typeof SOURCES)[number];

const isExportSource = (value: string): value is ExportSource =>
  (SOURCES as readonly string[]).includes(value);

export default function ExportsPage() {
  const { t } = useTranslation();
  const transport = useTransport();
  const [source, setSource] = useState<ExportSource>('products');

  const download = useGuardedMutation<ExportSource, Blob>({
    mutationFn: (selected) =>
      transport
        .request<Blob>({ method: 'GET', path: `exports/${selected}`, responseType: 'blob' })
        .then((r) => r.data),
    onSuccess: (blob, selected) => {
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
              if (isExportSource(e.target.value)) setSource(e.target.value);
            }}
          >
            {SOURCES.map((s) => (
              <SelectItem key={s} textValue={sourceLabels[s]}>
                {sourceLabels[s]}
              </SelectItem>
            ))}
          </Select>
          <Button
            color="primary"
            onPress={() => download.submit(source)}
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
