import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Truck, XCircle, CheckCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
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
import api from '../services/api';

interface OnlineOrder {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  payment_status: string;
  total: number;
  shipping_method: string;
  tracking_number: string | null;
  created_at: string;
  items?: {
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

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
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  const { data } = useQuery<{ data: OnlineOrder[]; meta: Record<string, unknown> }>({
    queryKey: ['online-orders', statusFilter],
    queryFn: () =>
      api
        .get('/api/online-orders', { params: { status: statusFilter || undefined } })
        .then((r) => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
      tracking_number,
    }: {
      id: number;
      status: string;
      tracking_number?: string;
    }) => api.put(`/api/online-orders/${id}/status`, { status, tracking_number }),
    onSuccess: () => {
      toast.success(t('onlineOrders.statusUpdated'));
      qc.invalidateQueries({ queryKey: ['online-orders'] });
      setDetailOpen(false);
    },
  });

  const viewOrder = async (id: number) => {
    const res = await api.get(`/api/online-orders/${id}`);
    setSelectedOrder(res.data.data);
    setDetailOpen(true);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(n);
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
            {!data?.data?.length ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  {t('onlineOrders.noOrders')}
                </td>
              </tr>
            ) : (
              data.data.map((o) => (
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
                      updateStatus.mutate({ id: selectedOrder.id, status: 'confirmed' })
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
                      updateStatus.mutate({ id: selectedOrder.id, status: 'processing' })
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
                    onClick={() => updateStatus.mutate({ id: selectedOrder.id, status: 'shipped' })}
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
                      updateStatus.mutate({ id: selectedOrder.id, status: 'delivered' })
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
                      updateStatus.mutate({ id: selectedOrder.id, status: 'cancelled' })
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
