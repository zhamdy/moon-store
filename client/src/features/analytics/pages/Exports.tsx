import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Select, SelectItem, Card, CardBody } from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { exportToExcel } from '../../../shared/lib/exportUtils';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';

interface ExportRecord {
  id: number;
  module: string;
  format: string;
  record_count: number;
  user_name: string;
  created_at: string;
}

/** POST exports/generate */
interface ExportPayload {
  module: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

const MODULES = ['products', 'sales', 'customers', 'inventory', 'deliveries'] as const;

export default function ExportsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const transport = useTransport();
  const [selectedModule, setSelectedModule] = useState<string>('products');

  const { data: history } = useApiQuery<ExportRecord[]>(['exports'], 'exports');

  const generateMutation = useMutation({
    mutationFn: () =>
      transport.request<ExportPayload>({
        method: 'POST',
        path: 'exports/generate',
        body: { module: selectedModule, format: 'xlsx' },
      }),
    onSuccess: (res) => {
      const { columns, rows, module: mod } = res.data;
      const exportData = rows;
      const cols = columns.map((c) => ({ key: c, label: c }));
      const filename = `moon-${mod}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportToExcel(filename, exportData, cols);
      toast.success(t('exports.downloaded', { count: String(rows.length) }));
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Export failed'),
  });

  const moduleLabels: Record<string, string> = {
    products: t('exports.products'),
    sales: t('exports.sales'),
    customers: t('exports.customers'),
    inventory: t('exports.inventory'),
    deliveries: t('exports.deliveries'),
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('exports.title')} />

      {/* Generator */}
      <Card className="max-w-lg border border-border bg-card shadow-sm">
        <CardBody className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">{t('exports.generate')}</h2>
          <Select
            label={t('exports.module')}
            size="sm"
            variant="bordered"
            selectedKeys={[selectedModule]}
            onChange={(e) => setSelectedModule(e.target.value || 'products')}
          >
            {MODULES.map((m) => (
              <SelectItem key={m} textValue={moduleLabels[m]}>
                {moduleLabels[m]}
              </SelectItem>
            ))}
          </Select>
          <Button
            color="primary"
            onClick={() => generateMutation.mutate()}
            isLoading={generateMutation.isPending}
            className="w-full"
            startContent={!generateMutation.isPending && <Download className="h-4 w-4" />}
          >
            {generateMutation.isPending ? t('common.loading') : t('exports.download')}
          </Button>
        </CardBody>
      </Card>

      {/* History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('exports.history')}</h2>
        {!history?.length ? (
          <div className="text-center py-16">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('exports.noExports')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="text-start p-3 font-semibold">{t('exports.module')}</th>
                  <th className="text-start p-3 font-semibold">{t('exports.format')}</th>
                  <th className="text-start p-3 font-semibold">{t('exports.recordCount')}</th>
                  <th className="text-start p-3 font-semibold">{t('common.user')}</th>
                  <th className="text-start p-3 font-semibold">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((exp) => (
                  <tr key={exp.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3">
                      <Badge size="sm" variant="secondary">
                        {moduleLabels[exp.module] || exp.module}
                      </Badge>
                    </td>
                    <td className="p-3 font-data uppercase">{exp.format}</td>
                    <td className="p-3 font-data">{exp.record_count}</td>
                    <td className="p-3">{exp.user_name}</td>
                    <td className="p-3 font-data text-muted-foreground">
                      {new Date(exp.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
