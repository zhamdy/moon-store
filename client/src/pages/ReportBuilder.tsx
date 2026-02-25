import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Plus, Play, Trash2, Clock, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { useTranslation } from '../i18n';
import api from '../services/api';

interface SavedReport {
  id: number;
  name: string;
  description: string;
  report_type: string;
  config: string;
  chart_type: string;
  is_public: number;
  is_favorite: number;
  last_run_at: string | null;
  created_by_name: string;
  created_at: string;
}

const reportTypeColors: Record<string, string> = {
  sales: 'bg-green-500/20 text-green-600',
  inventory: 'bg-blue-500/20 text-blue-600',
  customers: 'bg-purple-500/20 text-purple-600',
  financial: 'bg-gold/20 text-gold',
  custom: 'bg-gray-500/20 text-gray-600',
};

export default function ReportBuilderPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'saved' | 'builder' | 'quick'>('saved');
  const [createOpen, setCreateOpen] = useState(false);
  const [resultData, setResultData] = useState<Record<string, unknown>[] | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    report_type: 'sales' as string,
    config: '{}',
    chart_type: 'table' as string,
    is_public: false,
  });
  const [quickForm, setQuickForm] = useState({
    type: 'revenue_by_date',
    date_from: '',
    date_to: '',
  });

  const { data: reports } = useQuery<SavedReport[]>({
    queryKey: ['reports'],
    queryFn: () => api.get('/api/v1/reports').then((r) => r.data.data),
  });

  const createReport = useMutation({
    mutationFn: (data: typeof form) => api.post('/api/v1/reports', data),
    onSuccess: () => {
      toast.success(t('reportBuilder.created'));
      qc.invalidateQueries({ queryKey: ['reports'] });
      setCreateOpen(false);
    },
  });

  const deleteReport = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/reports/${id}`),
    onSuccess: () => {
      toast.success(t('reportBuilder.deleted'));
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const runReport = useMutation({
    mutationFn: (id: number) => api.post(`/api/v1/reports/${id}/run`).then((r) => r.data.data),
    onSuccess: (data) => {
      setResultData(data);
      toast.success(t('reportBuilder.runSuccess'));
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const runQuick = useMutation({
    mutationFn: (data: typeof quickForm) =>
      api.post('/api/v1/reports/quick', data).then((r) => r.data.data),
    onSuccess: (data) => {
      setResultData(data);
      toast.success(t('reportBuilder.runSuccess'));
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(n);

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('reportBuilder.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'saved' ? 'default' : 'outline'}
            onClick={() => setTab('saved')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" /> {t('reportBuilder.saved')}
          </Button>
          <Button
            variant={tab === 'quick' ? 'default' : 'outline'}
            onClick={() => setTab('quick')}
            className="gap-2"
          >
            <Play className="h-4 w-4" /> {t('reportBuilder.quickReport')}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('reportBuilder.create')}
          </Button>
        </div>
      </div>

      {tab === 'saved' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!reports?.length ? (
            <div className="col-span-full text-center py-16">
              <BarChart3 className="h-12 w-12 text-gold/40 mx-auto mb-3" />
              <p className="text-muted">{t('reportBuilder.noReports')}</p>
            </div>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-md border border-border bg-card hover:border-gold/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium truncate">{r.name}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => runReport.mutate(r.id)}
                    >
                      <Play className="h-3.5 w-3.5 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteReport.mutate(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Badge className={reportTypeColors[r.report_type]}>{r.report_type}</Badge>
                {r.description && <p className="text-xs text-muted mt-2">{r.description}</p>}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                  <Clock className="h-3 w-3" />
                  {r.last_run_at
                    ? new Date(r.last_run_at).toLocaleDateString()
                    : t('reportBuilder.neverRun')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'quick' && (
        <div className="max-w-2xl space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t('reportBuilder.reportType')}</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={quickForm.type}
                onChange={(e) => setQuickForm({ ...quickForm, type: e.target.value })}
              >
                <option value="revenue_by_date">{t('reportBuilder.revenueByDate')}</option>
                <option value="revenue_by_category">{t('reportBuilder.revenueByCategory')}</option>
                <option value="top_products">{t('reportBuilder.topProducts')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t('reportBuilder.dateFrom')}</Label>
              <Input
                type="date"
                value={quickForm.date_from}
                onChange={(e) => setQuickForm({ ...quickForm, date_from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('reportBuilder.dateTo')}</Label>
              <Input
                type="date"
                value={quickForm.date_to}
                onChange={(e) => setQuickForm({ ...quickForm, date_to: e.target.value })}
              />
            </div>
          </div>
          <Button
            onClick={() => runQuick.mutate(quickForm)}
            disabled={runQuick.isPending}
            className="gap-2"
          >
            <Play className="h-4 w-4" /> {t('reportBuilder.run')}
          </Button>
        </div>
      )}

      {resultData && resultData.length > 0 && (
        <div className="mt-6 overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                {Object.keys(resultData[0]).map((k) => (
                  <th key={k} className="text-start p-3 font-medium text-muted">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultData.map((row, i) => (
                <tr key={i} className="border-b border-border">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="p-3 font-data">
                      {typeof v === 'number' && v > 100 ? fmt(v) : String(v ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportBuilder.create')}</DialogTitle>
            <DialogDescription>{t('reportBuilder.createDesc')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createReport.mutate(form);
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>{t('reportBuilder.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('reportBuilder.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('reportBuilder.reportType')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.report_type}
                  onChange={(e) => setForm({ ...form, report_type: e.target.value })}
                >
                  <option value="sales">{t('reportBuilder.sales')}</option>
                  <option value="inventory">{t('reportBuilder.inventory')}</option>
                  <option value="customers">{t('reportBuilder.customers')}</option>
                  <option value="financial">{t('reportBuilder.financial')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('reportBuilder.chartType')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.chart_type}
                  onChange={(e) => setForm({ ...form, chart_type: e.target.value })}
                >
                  <option value="table">{t('reportBuilder.table')}</option>
                  <option value="bar">{t('reportBuilder.bar')}</option>
                  <option value="line">{t('reportBuilder.line')}</option>
                  <option value="pie">{t('reportBuilder.pie')}</option>
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createReport.isPending}>
              {createReport.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
