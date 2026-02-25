import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus } from 'lucide-react';
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
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';

interface Claim {
  id: number;
  sale_id: number;
  product_name: string;
  customer_name: string | null;
  issue: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-500/10 text-blue-600',
  under_review: 'bg-yellow-500/10 text-yellow-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  in_progress: 'bg-purple-500/10 text-purple-600',
  resolved: 'bg-green-500/10 text-green-700',
  rejected: 'bg-red-500/10 text-red-600',
};

export default function WarrantyPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ sale_id: '', product_id: '', issue: '' });

  const { data: claims } = useQuery<Claim[]>({
    queryKey: ['warranty'],
    queryFn: () => api.get('/api/v1/warranty').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { sale_id: number; product_id: number; issue: string }) =>
      api.post('/api/v1/warranty', data),
    onSuccess: () => {
      toast.success(t('warranty.create'));
      queryClient.invalidateQueries({ queryKey: ['warranty'] });
      setCreateOpen(false);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/v1/warranty/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranty'] });
    },
  });

  const statusKey = (s: string) => {
    const map: Record<string, string> = {
      submitted: 'warranty.submitted',
      under_review: 'warranty.underReview',
      approved: 'warranty.approved',
      in_progress: 'warranty.inProgress',
      resolved: 'warranty.resolved',
      rejected: 'warranty.rejected',
    };
    return map[s] || s;
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('warranty.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> {t('warranty.create')}
        </Button>
      </div>

      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-start p-3 font-medium text-muted">#</th>
              <th className="text-start p-3 font-medium text-muted">{t('warranty.saleId')}</th>
              <th className="text-start p-3 font-medium text-muted">Product</th>
              <th className="text-start p-3 font-medium text-muted">{t('warranty.issue')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('warranty.status')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('common.date')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {!claims?.length ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted">
                  <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-gold/40" />
                  {t('warranty.noClaims')}
                </td>
              </tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id} className="border-b border-border">
                  <td className="p-3 font-data text-muted">#{c.id}</td>
                  <td className="p-3 font-data">#{c.sale_id}</td>
                  <td className="p-3">{c.product_name}</td>
                  <td className="p-3 text-muted max-w-48 truncate">{c.issue}</td>
                  <td className="p-3">
                    <Badge className={`text-[10px] ${statusColors[c.status] || ''}`}>
                      {t(statusKey(c.status) as never)}
                    </Badge>
                  </td>
                  <td className="p-3 font-data text-xs text-muted">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <select
                      className="h-7 text-xs rounded border border-border bg-background px-2"
                      value={c.status}
                      onChange={(e) => updateStatus.mutate({ id: c.id, status: e.target.value })}
                    >
                      {[
                        'submitted',
                        'under_review',
                        'approved',
                        'in_progress',
                        'resolved',
                        'rejected',
                      ].map((s) => (
                        <option key={s} value={s}>
                          {t(statusKey(s) as never)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('warranty.create')}</DialogTitle>
            <DialogDescription>{t('warranty.title')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                sale_id: Number(form.sale_id),
                product_id: Number(form.product_id),
                issue: form.issue,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('warranty.saleId')}</Label>
                <Input
                  type="number"
                  value={form.sale_id}
                  onChange={(e) => setForm({ ...form, sale_id: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Product ID</Label>
                <Input
                  type="number"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('warranty.issue')}</Label>
              <Input
                value={form.issue}
                onChange={(e) => setForm({ ...form, issue: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
