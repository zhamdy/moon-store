import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingBag, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { formatCurrency, formatDateTime, formatRelative } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';

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

export default function CustomerDetail({ customerId, customerName, onBack }: CustomerDetailProps) {
  const { t } = useTranslation();

  const { data: stats } = useQuery<CustomerStats>({
    queryKey: ['customer-stats', customerId],
    queryFn: () => api.get(`/api/customers/${customerId}/stats`).then((r) => r.data.data),
  });

  const { data: salesData, isLoading } = useQuery<{ data: CustomerSale[] }>({
    queryKey: ['customer-sales', customerId],
    queryFn: () =>
      api.get(`/api/customers/${customerId}/sales`, { params: { limit: 100 } }).then((r) => r.data),
  });

  const sales = salesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-display tracking-wider text-foreground">{customerName}</h2>
          <p className="text-sm text-muted font-body">{t('customers.purchaseHistory')}</p>
        </div>
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
    </div>
  );
}
