import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Ban, Eye } from 'lucide-react';
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
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';

interface LayawayOrder {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  deposit: number;
  balance: number;
  due_date: string;
  status: string;
  created_at: string;
}

interface LayawayDetail extends LayawayOrder {
  items: { id: number; product_name: string; quantity: number; unit_price: number }[];
  payments: {
    id: number;
    amount: number;
    payment_method: string;
    cashier_name: string;
    created_at: string;
  }[];
}

const statusColors: Record<string, string> = {
  active: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  cancelled: 'bg-red-500/10 text-red-600',
  overdue: 'bg-orange-500/10 text-orange-600',
  expired: 'bg-gray-500/10 text-gray-600',
};

export default function LayawayPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: layaways } = useQuery<{ data: LayawayOrder[]; meta: { total: number } }>({
    queryKey: ['layaway'],
    queryFn: () =>
      api.get('/api/layaway?limit=100').then((r) => ({ data: r.data.data, meta: r.data.meta })),
  });

  const { data: detail } = useQuery<LayawayDetail>({
    queryKey: ['layaway', selectedId],
    queryFn: () => api.get(`/api/layaway/${selectedId}`).then((r) => r.data.data),
    enabled: detailDialogOpen && !!selectedId,
  });

  const payMutation = useMutation({
    mutationFn: (data: { id: number; amount: number }) =>
      api.post(`/api/layaway/${data.id}/payment`, { amount: data.amount }),
    onSuccess: () => {
      toast.success(t('layaway.paymentSuccess'));
      queryClient.invalidateQueries({ queryKey: ['layaway'] });
      setPaymentDialogOpen(false);
      setPaymentAmount('');
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/layaway/${id}/cancel`),
    onSuccess: () => {
      toast.success(t('layaway.cancelled'));
      queryClient.invalidateQueries({ queryKey: ['layaway'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('layaway.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
      </div>

      {/* Layaway table */}
      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-start p-3 font-medium text-muted">#</th>
              <th className="text-start p-3 font-medium text-muted">{t('common.name')}</th>
              <th className="text-end p-3 font-medium text-muted">{t('layaway.deposit')}</th>
              <th className="text-end p-3 font-medium text-muted">{t('layaway.balance')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('layaway.dueDate')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('common.status')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {!layaways?.data.length ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted">
                  {t('layaway.noLayaways')}
                </td>
              </tr>
            ) : (
              layaways.data.map((lo) => (
                <tr key={lo.id} className="border-b border-border hover:bg-surface/50">
                  <td className="p-3 font-data text-muted">#{lo.id}</td>
                  <td className="p-3">
                    <span className="font-medium">{lo.customer_name}</span>
                    {lo.customer_phone && <p className="text-xs text-muted">{lo.customer_phone}</p>}
                  </td>
                  <td className="p-3 text-end font-data">{formatCurrency(lo.deposit)}</td>
                  <td className="p-3 text-end font-data font-bold">{formatCurrency(lo.balance)}</td>
                  <td className="p-3 font-data text-xs">{lo.due_date}</td>
                  <td className="p-3">
                    <Badge className={`text-[10px] ${statusColors[lo.status] || ''}`}>
                      {t(`layaway.${lo.status}` as never)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setSelectedId(lo.id);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      {lo.status === 'active' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-500"
                            onClick={() => {
                              setSelectedId(lo.id);
                              setPaymentAmount('');
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <DollarSign className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (window.confirm(t('layaway.cancel') + '?'))
                                cancelMutation.mutate(lo.id);
                            }}
                          >
                            <Ban className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('layaway.makePayment')}</DialogTitle>
            <DialogDescription>#{selectedId}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedId) payMutation.mutate({ id: selectedId, amount: Number(paymentAmount) });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('layaway.paymentAmount')}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={payMutation.isPending}>
              {payMutation.isPending ? t('common.loading') : t('layaway.makePayment')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('layaway.title')} #{selectedId}
            </DialogTitle>
            <DialogDescription>{detail?.customer_name}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2 rounded bg-surface text-center">
                  <span className="text-xs text-muted">Total</span>
                  <p className="font-data font-bold">{formatCurrency(detail.total)}</p>
                </div>
                <div className="p-2 rounded bg-surface text-center">
                  <span className="text-xs text-muted">{t('layaway.deposit')}</span>
                  <p className="font-data font-bold text-emerald-500">
                    {formatCurrency(detail.deposit)}
                  </p>
                </div>
                <div className="p-2 rounded bg-surface text-center">
                  <span className="text-xs text-muted">{t('layaway.balance')}</span>
                  <p className="font-data font-bold text-red-500">
                    {formatCurrency(detail.balance)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Items</h4>
                {detail.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm py-1">
                    <span>
                      {item.product_name} x{item.quantity}
                    </span>
                    <span className="font-data">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {detail.payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Payments</h4>
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm py-1">
                      <span className="text-muted">
                        {new Date(p.created_at).toLocaleDateString()} — {p.cashier_name}
                      </span>
                      <span className="font-data text-emerald-500">
                        +{formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
