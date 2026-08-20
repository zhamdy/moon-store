import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Button } from '../../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Badge } from '../../../shared/ui/badge';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Textarea } from '../../../shared/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../shared/ui/dialog';
import { formatCurrency, formatDateTime, formatRelative } from '../../../shared/lib/utils';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { resource } from '../../../shared/lib/resource';
import { useTranslation } from '../../../shared/i18n/index';
import type { AppSettings } from '@/types';

/** Reached only for reads hanging off one customer and the points adjustment. */
const customers = resource<{ id: number }>('customers');

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

export default function CustomerDetail({ customerId, customerName, onBack }: CustomerDetailProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');

  // Settings.tsx writes this key and CartPanel.tsx reads it, so the cache entry
  // stays shared with them rather than moving under a resource-scoped key.
  const { data: appSettings } = useApiQuery<AppSettings>(['settings'], 'settings', undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const loyaltyEnabled = appSettings?.loyalty_enabled === 'true';

  const { data: stats } = customers.useRead<CustomerStats>(`${customerId}/stats`);

  const { data: sales = [], isLoading } = customers.useRead<CustomerSale[]>(`${customerId}/sales`, {
    limit: 100,
  });

  // Same story as settings: CartPanel.tsx reads ['customer-loyalty', id] and
  // the adjustment below invalidates it, so both have to keep meeting here.
  const { data: loyaltyData } = useApiQuery<LoyaltyData>(
    ['customer-loyalty', customerId],
    `customers/${customerId}/loyalty`,
    undefined,
    { enabled: loyaltyEnabled }
  );

  // `useAction` refreshes the customers collection itself; the loyalty read
  // lives under its own shared key, so that one is still invalidated by hand.
  const adjustMutation = customers.useAction('loyalty/adjust', {
    message: t('loyalty.adjustSuccess'),
    fallbackMessage: t('loyalty.adjustFailed'),
    onDone: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', customerId] });
      setAdjustDialogOpen(false);
      setAdjustPoints(0);
      setAdjustNote('');
    },
  });

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
                        <Badge variant="gold">
                          {{
                            Cash: t('cart.cash'),
                            Card: t('cart.card'),
                            Other: t('cart.other'),
                            'Gift Card': t('cart.giftCard'),
                          }[sale.payment_method] || sale.payment_method}
                        </Badge>
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
              onClick={() =>
                adjustMutation.run({
                  id: customerId,
                  body: { points: adjustPoints, note: adjustNote },
                })
              }
              disabled={adjustPoints === 0 || !adjustNote || adjustMutation.isRunning}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
