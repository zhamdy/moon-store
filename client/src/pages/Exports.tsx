import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { useTranslation } from '../i18n';
import type { AxiosError } from 'axios';
import api from '../services/api';
import type { ApiErrorResponse } from '@/types';

interface ExportRecord {
  id: number;
  module: string;
  format: string;
  record_count: number;
  user_name: string;
  created_at: string;
}

const MODULES = ['products', 'sales', 'customers', 'inventory', 'deliveries'] as const;

function downloadCSV(columns: string[], rows: Record<string, unknown>[], filename: string) {
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      })
      .join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<string>('products');
  const [format, setFormat] = useState<string>('csv');

  const { data: history } = useQuery<ExportRecord[]>({
    queryKey: ['exports'],
    queryFn: () => api.get('/api/v1/exports').then((r) => r.data.data),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/api/v1/exports/generate', { module: selectedModule, format }),
    onSuccess: (res) => {
      const { columns, rows, module: mod } = res.data.data;
      const filename = `moon-${mod}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCSV(columns, rows, filename);
      toast.success(t('exports.downloaded', { count: String(rows.length) }));
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Export failed'),
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
          <div className="space-y-1">
            <Label>{t('exports.format')}</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                  format === 'csv'
                    ? 'bg-gold text-primary-foreground border-gold'
                    : 'border-border hover:border-gold/50'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                  format === 'xlsx'
                    ? 'bg-gold text-primary-foreground border-gold'
                    : 'border-border hover:border-gold/50'
                }`}
              >
                XLSX
              </button>
            </div>
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
