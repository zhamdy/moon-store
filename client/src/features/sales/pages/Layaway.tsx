import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Ban, Eye, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import type { Customer, Product } from '../../../shared/types/index';
import type { LayawayDetail, LayawayLine, LayawayOrder } from '../types';

const layaway = resource<LayawayOrder>('layaway');

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
  const transport = useTransport();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [createItems, setCreateItems] = useState<LayawayLine[]>([]);
  const [deposit, setDeposit] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const { data: layaways } = layaway.useList({ limit: 100 });

  const { data: customers } = useApiQuery<Customer[]>(
    ['customers-list'],
    'customers',
    { limit: 200 },
    { enabled: createOpen }
  );

  const { data: products } = useApiQuery<Product[]>(
    ['products-layaway'],
    'products',
    { limit: 200 },
    { enabled: createOpen }
  );

  // Read as a named segment rather than `useOne`, because `selectedId` is also
  // set by the payment dialog and only the detail dialog wants the fetch.
  const { data: detail } = layaway.useRead<LayawayDetail>(
    String(selectedId),
    undefined,
    detailDialogOpen && !!selectedId
  );

  const payMutation = layaway.useAction('payment', {
    message: t('layaway.paymentSuccess'),
    fallbackMessage: 'Error',
    onDone: () => {
      setPaymentDialogOpen(false);
      setPaymentAmount('');
    },
  });

  // Not `resource('customers').useSave`: the new customer's id is needed here
  // to select them, and the list this page reads is keyed 'customers-list'.
  const createCustomerMutation = useMutation({
    mutationFn: (data: { name: string; phone: string }) =>
      transport.request<Customer>({ method: 'POST', path: 'customers', body: data }),
    onSuccess: (response) => {
      setCustomerId(String(response.data.id));
      setShowNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      toast.success(t('cart.customerCreated'));
    },
    onError: () => toast.error(t('cart.customerCreateError')),
  });

  const createMutation = layaway.useSave({
    message: t('layaway.created'),
    fallbackMessage: 'Error',
    onDone: () => {
      setCreateOpen(false);
      resetCreateForm();
    },
  });

  const cancelMutation = layaway.useAction('cancel', {
    message: t('layaway.cancelled'),
    fallbackMessage: 'Error',
  });

  const defaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const resetCreateForm = () => {
    setCustomerId('');
    setCreateItems([]);
    setDeposit('');
    setDueDate(defaultDueDate());
    setSelectedProductId('');
    setShowNewCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  const addProduct = () => {
    if (!selectedProductId) return;
    const product = products?.find((p) => p.id === Number(selectedProductId));
    if (!product) return;
    if (createItems.some((i) => i.product_id === product.id)) return;
    setCreateItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        unit_price: Number(product.price),
        quantity: 1,
      },
    ]);
    setSelectedProductId('');
  };

  const itemsTotal = createItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const handleCreate = () => {
    if (!customerId || createItems.length === 0 || !dueDate) return;
    createMutation.save({
      customer_id: Number(customerId),
      items: createItems.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      deposit: Number(deposit) || 0,
      due_date: dueDate,
    });
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('layaway.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('layaway.create')}
        </Button>
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
            {!layaways?.length ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted">
                  {t('layaway.noLayaways')}
                </td>
              </tr>
            ) : (
              layaways.map((lo) => (
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
                                cancelMutation.run({ id: lo.id });
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
              if (selectedId)
                payMutation.run({ id: selectedId, body: { amount: Number(paymentAmount) } });
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
            <Button type="submit" className="w-full" disabled={payMutation.isRunning}>
              {payMutation.isRunning ? t('common.loading') : t('layaway.makePayment')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('layaway.create')}</DialogTitle>
            <DialogDescription>{t('layaway.minDeposit', { percent: '0' })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('deliveries.customer')}</Label>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(!showNewCustomer)}
                  className="text-xs text-gold hover:underline"
                >
                  {showNewCustomer ? t('deliveries.existingCustomer') : t('cart.addNewCustomer')}
                </button>
              </div>
              {showNewCustomer ? (
                <div className="space-y-2 p-3 border border-border rounded-md bg-surface/50">
                  <Input
                    placeholder={t('cart.customerName')}
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                  />
                  <Input
                    placeholder={t('cart.customerPhone')}
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!newCustName.trim() || createCustomerMutation.isPending}
                    onClick={() =>
                      createCustomerMutation.mutate({
                        name: newCustName.trim(),
                        phone: newCustPhone.trim(),
                      })
                    }
                  >
                    {t('cart.saveCustomer')}
                  </Button>
                </div>
              ) : (
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('deliveries.selectCustomer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Add product */}
            <div className="space-y-1">
              <Label>{t('deliveries.items')}</Label>
              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('deliveries.selectProduct')} />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      ?.filter((p) => !createItems.some((i) => i.product_id === p.id))
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} — {formatCurrency(Number(p.price))}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addProduct}
                  disabled={!selectedProductId}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Items list */}
            {createItems.length > 0 && (
              <div className="border border-border rounded-md divide-y divide-border">
                {createItems.map((item, idx) => (
                  <div key={item.product_id} className="flex items-center gap-2 p-2">
                    <span className="flex-1 text-sm truncate">{item.product_name}</span>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = Math.max(1, Number(e.target.value));
                        setCreateItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, quantity: qty } : it))
                        );
                      }}
                      className="w-16 h-8 text-sm font-data text-center"
                    />
                    <span className="text-sm font-data w-20 text-end">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setCreateItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between p-2 bg-surface">
                  <span className="text-sm font-medium">{t('cart.total')}</span>
                  <span className="text-sm font-data font-bold">{formatCurrency(itemsTotal)}</span>
                </div>
              </div>
            )}

            {/* Deposit */}
            <div className="space-y-1">
              <Label>{t('layaway.deposit')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0.00"
                className="font-data"
              />
            </div>

            {/* Due date */}
            <div className="space-y-1">
              <Label>{t('layaway.dueDate')}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="font-data"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={
                createMutation.isSaving || !customerId || createItems.length === 0 || !dueDate
              }
            >
              {createMutation.isSaving ? t('common.loading') : t('layaway.create')}
            </Button>
          </div>
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
