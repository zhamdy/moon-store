import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Calendar,
  Star,
  Plus,
  Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { formatCurrency, formatDateTime, formatRelative } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { AxiosError } from 'axios';

interface CustomerDetailProps {
  customerId: number;
  customerName: string;
  onBack: () => void;
}

interface CustomerStats {
  total_spent: number;
  order_count: number;
  avg_order: number;
  last_purchase: string | null;
}

interface CustomerSale {
  id: number;
  total: number;
  payment_method: string;
  cashier_name: string;
  items_count: number;
  created_at: string;
}

interface LoyaltyTransaction {
  id: number;
  customer_id: number;
  sale_id: number | null;
  points: number;
  type: 'earned' | 'redeemed' | 'adjustment' | 'refund_deduct';
  note: string | null;
  created_at: string;
}

interface LoyaltyData {
  points: number;
  transactions: LoyaltyTransaction[];
}

interface AppSettings {
  loyalty_enabled: string;
}

export default function CustomerDetail({ customerId, customerName, onBack }: CustomerDetailProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const loyaltyEnabled = appSettings?.loyalty_enabled === 'true';

  const { data: stats } = useQuery<CustomerStats>({
    queryKey: ['customer-stats', customerId],
    queryFn: () => api.get(`/api/customers/${customerId}/stats`).then((r) => r.data.data),
  });

  const { data: salesData, isLoading } = useQuery<{ data: CustomerSale[] }>({
    queryKey: ['customer-sales', customerId],
    queryFn: () =>
      api.get(`/api/customers/${customerId}/sales`, { params: { limit: 100 } }).then((r) => r.data),
  });

  const { data: loyaltyData } = useQuery<LoyaltyData>({
    queryKey: ['customer-loyalty', customerId],
    queryFn: () => api.get(`/api/customers/${customerId}/loyalty`).then((r) => r.data.data),
    enabled: loyaltyEnabled,
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { points: number; note: string }) =>
      api.post(`/api/customers/${customerId}/loyalty/adjust`, data),
    onSuccess: () => {
      toast.success(t('loyalty.adjustSuccess'));
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setAdjustDialogOpen(false);
      setAdjustPoints(0);
      setAdjustNote('');
    },
    onError: (err: AxiosError<{ error?: string }>) =>
      toast.error(err.response?.data?.error || t('loyalty.adjustFailed')),
  });

  const sales = salesData?.data || [];

  const typeLabel = (type: string) => {
    switch (type) {
      case 'earned':
        return t('loyalty.earned');
      case 'redeemed':
        return t('loyalty.redeemed');
      case 'adjustment':
        return t('loyalty.adjustment');
      case 'refund_deduct':
        return t('loyalty.refundDeduct');
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-display tracking-wider text-foreground">{customerName}</h2>
          <p className="text-sm text-muted font-body">{t('customers.purchaseHistory')}</p>
        </div>
        {loyaltyEnabled && loyaltyData && (
          <div className="flex items-center gap-2">
            <div className="text-end">
              <p className="text-xs text-muted uppercase tracking-widest">{t('loyalty.points')}</p>
              <p className="text-xl font-semibold text-gold font-data flex items-center gap-1 justify-end">
                <Star className="h-4 w-4" />
                {loyaltyData.points}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdjustDialogOpen(true)}
              className="text-xs"
            >
              {t('loyalty.adjustPoints')}
            </Button>
          </div>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-gold/10">
                <DollarSign className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-widest font-body">
                  {t('customers.totalSpent')}
                </p>
                <p className="text-lg font-semibold text-gold font-data">
                  {formatCurrency(stats.total_spent)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-gold/10">
                <ShoppingBag className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-widest font-body">
                  {t('customers.orderCount')}
                </p>
                <p className="text-lg font-semibold font-data">{stats.order_count}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-gold/10">
                <TrendingUp className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-widest font-body">
                  {t('customers.avgOrder')}
                </p>
                <p className="text-lg font-semibold font-data">{formatCurrency(stats.avg_order)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-gold/10">
                <Calendar className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-widest font-body">
                  {t('customers.lastPurchase')}
                </p>
                <p className="text-sm font-data">
                  {stats.last_purchase ? formatRelative(stats.last_purchase) : '-'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loyalty Points History */}
      {loyaltyEnabled && loyaltyData && loyaltyData.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" />
              {t('loyalty.history')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('sales.dateTime')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('loyalty.points')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('customers.notes')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loyaltyData.transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-data">{formatDateTime(txn.created_at)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={txn.points > 0 ? 'gold' : 'destructive'}>
                          {typeLabel(txn.type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-data font-semibold">
                        <span className={txn.points > 0 ? 'text-green-500' : 'text-red-500'}>
                          {txn.points > 0 ? '+' : ''}
                          {txn.points}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{txn.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted">{t('common.loading')}</div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center text-muted">{t('customers.noPurchases')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('sales.saleId')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('sales.dateTime')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('sales.items')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('sales.total')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted uppercase tracking-wider">
                      {t('sales.payment')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-data text-gold">#{sale.id}</td>
                      <td className="px-4 py-3 font-data">{formatDateTime(sale.created_at)}</td>
                      <td className="px-4 py-3 font-data">{sale.items_count}</td>
                      <td className="px-4 py-3 font-semibold font-data">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="gold">{sale.payment_method}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Points Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('loyalty.adjustPoints')}</DialogTitle>
            <DialogDescription>{t('loyalty.adjustDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('loyalty.points')}</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAdjustPoints((p) => p - 10)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(parseInt(e.target.value) || 0)}
                  className="w-32 text-center font-data"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAdjustPoints((p) => p + 10)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted">
                {adjustPoints > 0 ? `+${adjustPoints}` : adjustPoints} points
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('loyalty.adjustNote')}</Label>
              <Textarea
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder={t('loyalty.adjustNote')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => adjustMutation.mutate({ points: adjustPoints, note: adjustNote })}
              disabled={adjustPoints === 0 || !adjustNote || adjustMutation.isPending}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
