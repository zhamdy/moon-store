import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../../shared/ui/button';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
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
    // ApiError carries the server's wording, and nothing when the failure was
    // the transport's own — so the page keeps its own fallback.
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
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('exports.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      {/* Generator */}
      <div className="p-6 border border-border rounded-md bg-card mb-8 max-w-lg">
        <h2 className="text-lg font-display tracking-wider mb-4">{t('exports.generate')}</h2>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{t('exports.module')}</Label>
            <select
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {moduleLabels[m]}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            {generateMutation.isPending ? t('common.loading') : t('exports.download')}
          </Button>
        </div>
      </div>

      {/* History */}
      <h2 className="text-xl font-display tracking-wider mb-4">{t('exports.history')}</h2>
      {!history?.length ? (
        <div className="text-center py-16">
          <FileSpreadsheet className="h-12 w-12 text-gold/40 mx-auto mb-3" />
          <p className="text-muted">{t('exports.noExports')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-start p-3 font-medium text-muted">{t('exports.module')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('exports.format')}</th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('exports.recordCount')}
                </th>
                <th className="text-start p-3 font-medium text-muted">{t('common.user')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('common.date')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((exp) => (
                <tr key={exp.id} className="border-b border-border">
                  <td className="p-3">
                    <Badge variant="gold">{moduleLabels[exp.module] || exp.module}</Badge>
                  </td>
                  <td className="p-3 font-data uppercase">{exp.format}</td>
                  <td className="p-3 font-data">{exp.record_count}</td>
                  <td className="p-3">{exp.user_name}</td>
                  <td className="p-3 font-data text-muted">
                    {new Date(exp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
