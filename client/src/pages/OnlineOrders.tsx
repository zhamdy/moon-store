import { useState } from 'react';
import { Eye, Truck, XCircle, CheckCircle, Package } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { useTranslation } from '../i18n';
import { resource } from '../lib/resource';
import type { OnlineOrder } from '@/types';

const onlineOrders = resource<OnlineOrder>('online-orders');

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600',
  confirmed: 'bg-blue-500/20 text-blue-600',
  processing: 'bg-purple-500/20 text-purple-600',
  shipped: 'bg-cyan-500/20 text-cyan-600',
  delivered: 'bg-green-500/20 text-green-600',
  cancelled: 'bg-red-500/20 text-red-600',
  refunded: 'bg-gray-500/20 text-gray-600',
};

export default function OnlineOrdersPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: orders } = onlineOrders.useList({ status: statusFilter || undefined });
  // The single read carries the order's lines, which the list rows leave out.
  const { data: selectedOrder } = onlineOrders.useOne(detailOpen ? detailId : null);

  const updateStatus = onlineOrders.useAction('status', {
    method: 'PUT',
    message: t('onlineOrders.statusUpdated'),
    onDone: () => setDetailOpen(false),
  });

  const viewOrder = (id: number) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const fmt = (n: number) => formatCurrency(n);
  const statuses = ['', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl tracking-wider font-display text-foreground">
            {t('onlineOrders.title')}
          </h1>
          <div className="mt-2 gold-divider" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s ? t(`onlineOrders.${s}`) : t('common.all')}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto border rounded-md border-border">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface border-border">
            <tr>
              <th className="p-3 font-medium text-start text-muted">
                {t('onlineOrders.orderNumber')}
              </th>
              <th className="p-3 font-medium text-start text-muted">
                {t('onlineOrders.customer')}
              </th>
              <th className="p-3 font-medium text-start text-muted">{t('common.status')}</th>
              <th className="p-3 font-medium text-start text-muted">{t('onlineOrders.payment')}</th>
              <th className="p-3 font-medium text-start text-muted">{t('onlineOrders.total')}</th>
              <th className="p-3 font-medium text-start text-muted">{t('common.date')}</th>
              <th className="p-3 font-medium text-start text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!orders?.length ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  {t('onlineOrders.noOrders')}
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-border hover:bg-surface/50">
                  <td className="p-3 font-medium font-data">{o.order_number}</td>
                  <td className="p-3">{o.customer_name || '—'}</td>
                  <td className="p-3">
                    <Badge className={statusColors[o.status] || ''}>
                      {t(`onlineOrders.${o.status}`)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={o.payment_status === 'paid' ? 'gold' : 'outline'}>
                      {o.payment_status}
                    </Badge>
                  </td>
                  <td className="p-3 font-data text-gold">{fmt(o.total)}</td>
                  <td className="p-3 font-data text-muted">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => viewOrder(o.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('onlineOrders.orderDetails')} — {selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription>{t('onlineOrders.manageOrder')}</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedOrder.status] || ''}>
                  {t(`onlineOrders.${selectedOrder.status}`)}
                </Badge>
                <span className="text-sm text-muted">{fmt(selectedOrder.total)}</span>
              </div>
              {selectedOrder.items && (
                <div className="border divide-y rounded-md border-border divide-border">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between p-2 text-sm">
                      <span>
                        {item.product_name} x{item.quantity}
                      </span>
                      <span className="font-data">{fmt(item.total)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {selectedOrder.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      updateStatus.run({ id: selectedOrder.id, body: { status: 'confirmed' } })
                    }
                    className="gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {t('onlineOrders.confirm')}
                  </Button>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      updateStatus.run({ id: selectedOrder.id, body: { status: 'processing' } })
                    }
                    className="gap-1"
                  >
                    <Package className="w-3 h-3" />
                    {t('onlineOrders.process')}
                  </Button>
                )}
                {selectedOrder.status === 'processing' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      updateStatus.run({ id: selectedOrder.id, body: { status: 'shipped' } })
                    }
                    className="gap-1"
                  >
                    <Truck className="w-3 h-3" />
                    {t('onlineOrders.ship')}
                  </Button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      updateStatus.run({ id: selectedOrder.id, body: { status: 'delivered' } })
                    }
                    className="gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {t('onlineOrders.markDelivered')}
                  </Button>
                )}
                {!['cancelled', 'delivered', 'refunded'].includes(selectedOrder.status) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      updateStatus.run({ id: selectedOrder.id, body: { status: 'cancelled' } })
                    }
                    className="gap-1"
                  >
                    <XCircle className="w-3 h-3" />
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
