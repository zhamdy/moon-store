import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { useTranslation } from '../i18n';
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  recurring: string;
  user_name: string;
}

interface PnLData {
  period: { from: string; to: string };
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  expenses_by_category: { category: string; total: number }[];
  net_profit: number;
}

const categories = ['rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other'] as const;
const recurrences = ['one_time', 'daily', 'weekly', 'monthly', 'yearly'] as const;

export default function ExpensesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'list' | 'pnl'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    category: 'other' as string,
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    recurring: 'one_time',
  });

  const { data: expensesData } = useQuery<{
    data: Expense[];
    meta: { total: number; total_amount: number };
  }>({
    queryKey: ['expenses'],
    queryFn: () =>
      api.get('/api/expenses?limit=100').then((r) => ({ data: r.data.data, meta: r.data.meta })),
  });

  const { data: pnl } = useQuery<PnLData>({
    queryKey: ['expenses', 'pnl'],
    queryFn: () => api.get('/api/expenses/pnl').then((r) => r.data.data),
    enabled: tab === 'pnl',
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (editingId) return api.put(`/api/expenses/${editingId}`, data);
      return api.post('/api/expenses', data);
    },
    onSuccess: () => {
      toast.success(editingId ? t('expenses.updated') : t('expenses.created'));
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/expenses/${id}`),
    onSuccess: () => {
      toast.success(t('expenses.deleted'));
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      category: 'other',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      recurring: 'one_time',
    });
  };

  const openEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      category: exp.category,
      amount: String(exp.amount),
      description: exp.description || '',
      date: exp.date,
      recurring: exp.recurring,
    });
    setDialogOpen(true);
  };

  const categoryKey = (cat: string) => `expenses.${cat}` as const;

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('expenses.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> {t('expenses.addExpense')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'list' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-foreground'}`}
        >
          {t('expenses.title')}
        </button>
        <button
          onClick={() => setTab('pnl')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'pnl' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-foreground'}`}
        >
          {t('expenses.pnl')}
        </button>
      </div>

      {tab === 'list' && (
        <>
          {/* Summary card */}
          <Card className="border-border mb-6">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted uppercase tracking-wider">
                  {t('expenses.totalExpenses')}
                </span>
                <p className="text-2xl font-data font-bold text-red-500">
                  {formatCurrency(expensesData?.meta.total_amount || 0)}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-gold/40" />
            </CardContent>
          </Card>

          {/* Expense table */}
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-start p-3 font-medium text-muted">{t('expenses.date')}</th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('expenses.category')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('expenses.description')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('expenses.recurrence')}
                  </th>
                  <th className="text-end p-3 font-medium text-muted">{t('expenses.amount')}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {!expensesData?.data.length ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted">
                      {t('common.noResults')}
                    </td>
                  </tr>
                ) : (
                  expensesData.data.map((exp) => (
                    <tr key={exp.id} className="border-b border-border hover:bg-surface/50">
                      <td className="p-3 font-data text-xs">{exp.date}</td>
                      <td className="p-3">
                        <Badge variant="gold" className="text-[10px]">
                          {t(categoryKey(exp.category))}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted">{exp.description || '—'}</td>
                      <td className="p-3 text-xs">
                        {t(
                          `expenses.${exp.recurring === 'one_time' ? 'oneTime' : exp.recurring}` as never
                        )}
                      </td>
                      <td className="p-3 text-end font-data font-medium text-red-500">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(exp)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (window.confirm(t('expenses.deleteConfirm')))
                                deleteMutation.mutate(exp.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'pnl' && pnl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted uppercase tracking-wider">
                    {t('expenses.revenue')}
                  </span>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-data font-bold text-emerald-500">
                  {formatCurrency(pnl.revenue)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted uppercase tracking-wider">
                    {t('expenses.operatingExpenses')}
                  </span>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-2xl font-data font-bold text-red-500">
                  {formatCurrency(pnl.operating_expenses)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted uppercase tracking-wider">
                    {t('expenses.netProfit')}
                  </span>
                  <DollarSign className="h-4 w-4 text-gold" />
                </div>
                <p
                  className={`text-2xl font-data font-bold ${pnl.net_profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {formatCurrency(pnl.net_profit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* P&L breakdown */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span>{t('expenses.revenue')}</span>
                <span className="font-data font-bold">{formatCurrency(pnl.revenue)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border text-muted">
                <span>- {t('expenses.cogs')}</span>
                <span className="font-data">{formatCurrency(pnl.cogs)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border font-medium">
                <span>{t('expenses.grossProfit')}</span>
                <span className="font-data">{formatCurrency(pnl.gross_profit)}</span>
              </div>
              {pnl.expenses_by_category.map((cat) => (
                <div
                  key={cat.category}
                  className="flex justify-between py-1 text-sm text-muted ps-4"
                >
                  <span>- {t(categoryKey(cat.category))}</span>
                  <span className="font-data">{formatCurrency(cat.total)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 border-t-2 border-gold font-bold text-lg">
                <span>{t('expenses.netProfit')}</span>
                <span
                  className={`font-data ${pnl.net_profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {formatCurrency(pnl.net_profit)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('expenses.editExpense') : t('expenses.addExpense')}
            </DialogTitle>
            <DialogDescription>{t('expenses.title')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({
                category: form.category,
                amount: Number(form.amount),
                description: form.description || undefined,
                date: form.date,
                recurring: form.recurring,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('expenses.category')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {t(categoryKey(c))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('expenses.amount')}</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('expenses.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('expenses.date')}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('expenses.recurrence')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.recurring}
                  onChange={(e) => setForm({ ...form, recurring: e.target.value })}
                >
                  {recurrences.map((r) => (
                    <option key={r} value={r}>
                      {t(`expenses.${r === 'one_time' ? 'oneTime' : r}` as never)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
