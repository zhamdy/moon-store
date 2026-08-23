import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Ban, Eye, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Pagination,
} from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useProductCatalog } from '../../../shared/hooks/useProductCatalog';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useTransport } from '../../../shared/lib/transport/index';
import type { Customer } from '../../../shared/types/index';
import type { LayawayDetail, LayawayLine, LayawayOrder } from '../types';

const layaway = resource<LayawayOrder>('layaway');

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
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const { data: layaways, meta } = layaway.useList({
    page,
    pageSize: 25,
    status: status === 'all' ? undefined : status,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const pagination = (meta as { pagination?: { totalPages: number } } | undefined)?.pagination;

  const { data: customers } = useApiQuery<Customer[]>(
    ['customers-list'],
    'customers',
    { page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' },
    { enabled: createOpen }
  );

  const {
    products,
    hasNextPage: hasMoreProducts,
    fetchNextPage: loadMoreProducts,
    isFetchingNextPage: isLoadingMoreProducts,
  } = useProductCatalog({
    search: debouncedProductSearch,
    enabled: createOpen,
    selectedIds: createItems.map((item) => item.product_id),
  });

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
    setProductSearch('');
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

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge size="sm" variant="primary">
            {t('layaway.active')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge size="sm" variant="success">
            {t('layaway.completed')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge size="sm" variant="danger">
            {t('layaway.cancelled')}
          </Badge>
        );
      case 'overdue':
        return (
          <Badge size="sm" variant="warning">
            {t('layaway.overdue')}
          </Badge>
        );
      default:
        return (
          <Badge size="sm" variant="default">
            {t(`layaway.${status}` as never)}
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('layaway.title')}>
        <div className="flex gap-2">
          <Select
            aria-label="Layaway status"
            className="w-40"
            size="sm"
            selectedKeys={[status]}
            onSelectionChange={(keys) => {
              setStatus(String(Array.from(keys)[0] ?? 'all'));
              setPage(1);
            }}
          >
            <SelectItem key="all">All statuses</SelectItem>
            <SelectItem key="active">{t('layaway.active')}</SelectItem>
            <SelectItem key="completed">{t('layaway.completed')}</SelectItem>
            <SelectItem key="cancelled">{t('layaway.cancelled')}</SelectItem>
          </Select>
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            {t('layaway.create')}
          </Button>
        </div>
      </PageHeader>

      {/* Layaway table */}
      <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="text-start p-3 font-semibold">#</th>
              <th className="text-start p-3 font-semibold">{t('common.name')}</th>
              <th className="text-end p-3 font-semibold">{t('layaway.deposit')}</th>
              <th className="text-end p-3 font-semibold">{t('layaway.balance')}</th>
              <th className="text-start p-3 font-semibold">{t('layaway.dueDate')}</th>
              <th className="text-start p-3 font-semibold">{t('common.status')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {!layaways?.length ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  {t('layaway.noLayaways')}
                </td>
              </tr>
            ) : (
              layaways.map((lo) => (
                <tr key={lo.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-data text-muted-foreground">#{lo.id}</td>
                  <td className="p-3">
                    <span className="font-medium text-foreground">{lo.customer_name}</span>
                    {lo.customer_phone && (
                      <p className="text-xs text-muted-foreground">{lo.customer_phone}</p>
                    )}
                  </td>
                  <td className="p-3 text-end font-data text-foreground">
                    {formatCurrency(lo.deposit)}
                  </td>
                  <td className="p-3 text-end font-data font-bold text-foreground">
                    {formatCurrency(lo.balance)}
                  </td>
                  <td className="p-3 font-data text-xs text-muted-foreground">{lo.due_date}</td>
                  <td className="p-3">{getStatusChip(lo.status)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        className="h-7 w-7"
                        onClick={() => {
                          setSelectedId(lo.id);
                          setDetailDialogOpen(true);
                        }}
                        aria-label="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {lo.status === 'active' && (
                        <>
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="h-7 w-7 text-success"
                            onClick={() => {
                              setSelectedId(lo.id);
                              setPaymentAmount('');
                              setPaymentDialogOpen(true);
                            }}
                            aria-label="Make payment"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            isIconOnly
                            variant="light"
                            color="danger"
                            size="sm"
                            className="h-7 w-7"
                            onClick={() => {
                              if (window.confirm(t('layaway.cancel') + '?'))
                                cancelMutation.run({ id: lo.id });
                            }}
                            aria-label="Cancel layaway"
                          >
                            <Ban className="h-3.5 w-3.5" />
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
      {(pagination?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center">
          <Pagination
            total={pagination!.totalPages}
            page={page}
            onChange={setPage}
            size="sm"
            variant="flat"
          />
        </div>
      )}

      {/* Payment Dialog */}
      <Modal
        isOpen={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedId)
                  payMutation.run({ id: selectedId, body: { amount: Number(paymentAmount) } });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('layaway.makePayment')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">#{selectedId}</p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  type="number"
                  label={t('layaway.paymentAmount')}
                  size="sm"
                  variant="bordered"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onValueChange={setPaymentAmount}
                  autoFocus
                  isRequired
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setPaymentDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={payMutation.isRunning}>
                  {payMutation.isRunning ? t('common.loading') : t('layaway.makePayment')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Create Dialog */}
      <Modal
        isOpen={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setProductSearch('');
        }}
        backdrop="blur"
        placement="center"
        size="lg"
        scrollBehavior="inside"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl max-h-[90vh]',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('layaway.create')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('layaway.minDeposit', { percent: '0' })}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                {/* Customer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {t('deliveries.customer')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(!showNewCustomer)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showNewCustomer
                        ? t('deliveries.existingCustomer')
                        : t('cart.addNewCustomer')}
                    </button>
                  </div>
                  {showNewCustomer ? (
                    <div className="space-y-3 p-3 border border-border rounded-xl bg-muted/20">
                      <Input
                        label={t('cart.customerName')}
                        size="sm"
                        variant="bordered"
                        value={newCustName}
                        onValueChange={setNewCustName}
                      />
                      <Input
                        label={t('cart.customerPhone')}
                        size="sm"
                        variant="bordered"
                        value={newCustPhone}
                        onValueChange={setNewCustPhone}
                      />
                      <Button
                        size="sm"
                        variant="bordered"
                        className="w-full"
                        isDisabled={!newCustName.trim() || createCustomerMutation.isPending}
                        isLoading={createCustomerMutation.isPending}
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
                    <Select
                      label={t('deliveries.selectCustomer')}
                      size="sm"
                      variant="bordered"
                      selectedKeys={customerId ? [customerId] : []}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      {(customers ?? []).map((c) => (
                        <SelectItem
                          key={String(c.id)}
                          textValue={`${c.name} ${c.phone ? `(${c.phone})` : ''}`}
                        >
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                </div>

                {/* Add product */}
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    {t('deliveries.items')}
                  </label>
                  <div className="flex gap-2 items-center">
                    <Input
                      aria-label="Search products"
                      placeholder={t('common.search')}
                      size="sm"
                      variant="bordered"
                      value={productSearch}
                      onValueChange={setProductSearch}
                    />
                    <Select
                      label={t('deliveries.selectProduct')}
                      size="sm"
                      variant="bordered"
                      className="flex-1"
                      selectedKeys={selectedProductId ? [selectedProductId] : []}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      {(products ?? [])
                        .filter((p) => p.status === 'active')
                        .filter((p) => !createItems.some((i) => i.product_id === p.id))
                        .map((p) => (
                          <SelectItem
                            key={String(p.id)}
                            textValue={`${p.name} — ${formatCurrency(Number(p.price))}`}
                          >
                            {p.name} — {formatCurrency(Number(p.price))}
                          </SelectItem>
                        ))}
                    </Select>
                    <Button
                      isIconOnly
                      variant="bordered"
                      size="sm"
                      className="h-10 w-10"
                      onClick={addProduct}
                      isDisabled={!selectedProductId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {hasMoreProducts && (
                    <Button
                      fullWidth
                      variant="bordered"
                      size="sm"
                      onPress={() => void loadMoreProducts()}
                      isLoading={isLoadingMoreProducts}
                      aria-label="Load more products"
                    >
                      Load more
                    </Button>
                  )}
                </div>

                {/* Items list */}
                {createItems.length > 0 && (
                  <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card">
                    {createItems.map((item, idx) => (
                      <div key={item.product_id} className="flex items-center gap-2 p-2.5">
                        <span className="flex-1 text-sm font-medium text-foreground truncate">
                          {item.product_name}
                          {products.find((product) => product.id === item.product_id)?.status !==
                            'active' && (
                            <span className="ms-2 text-xs text-warning">Unavailable</span>
                          )}
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = Math.max(1, Number(e.target.value));
                            setCreateItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: qty } : it))
                            );
                          }}
                          className="w-14 h-7 text-sm font-data text-center border border-border rounded-lg bg-background text-foreground"
                        />
                        <span className="text-sm font-data w-20 text-end text-foreground">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </span>
                        <Button
                          isIconOnly
                          variant="light"
                          color="danger"
                          size="sm"
                          className="h-7 w-7"
                          onClick={() => setCreateItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between p-3 bg-muted/20 font-semibold">
                      <span className="text-sm">{t('cart.total')}</span>
                      <span className="text-sm font-data text-primary">
                        {formatCurrency(itemsTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Deposit */}
                <Input
                  type="number"
                  label={t('layaway.deposit')}
                  size="sm"
                  variant="bordered"
                  min="0"
                  step="0.01"
                  value={deposit}
                  onValueChange={setDeposit}
                  placeholder="0.00"
                  className="font-data"
                />

                {/* Due date */}
                <Input
                  type="date"
                  label={t('layaway.dueDate')}
                  size="sm"
                  variant="bordered"
                  value={dueDate}
                  onValueChange={setDueDate}
                  className="font-data"
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setCreateOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onClick={handleCreate}
                  isLoading={createMutation.isSaving}
                  isDisabled={
                    createMutation.isSaving || !customerId || createItems.length === 0 || !dueDate
                  }
                >
                  {createMutation.isSaving ? t('common.loading') : t('layaway.create')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Detail Dialog */}
      <Modal
        isOpen={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {t('layaway.title')} #{selectedId}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {detail?.customer_name}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                {detail && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                        <span className="text-xs text-muted-foreground">Total</span>
                        <p className="font-data font-bold text-foreground">
                          {formatCurrency(detail.total)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                        <span className="text-xs text-muted-foreground">
                          {t('layaway.deposit')}
                        </span>
                        <p className="font-data font-bold text-success">
                          {formatCurrency(detail.deposit)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                        <span className="text-xs text-muted-foreground">
                          {t('layaway.balance')}
                        </span>
                        <p className="font-data font-bold text-danger">
                          {formatCurrency(detail.balance)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Items
                      </h4>
                      <div className="divide-y divide-border/50 border border-border rounded-xl p-2 bg-card">
                        {detail.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm py-1.5 px-2">
                            <span className="text-foreground">
                              {item.product_name} x{item.quantity}
                            </span>
                            <span className="font-data font-semibold text-foreground">
                              {formatCurrency(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {detail.payments.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Payments
                        </h4>
                        <div className="divide-y divide-border/50 border border-border rounded-xl p-2 bg-card">
                          {detail.payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-sm py-1.5 px-2">
                              <span className="text-muted-foreground text-xs">
                                {new Date(p.created_at).toLocaleDateString()} — {p.cashier_name}
                              </span>
                              <span className="font-data font-semibold text-success">
                                +{formatCurrency(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
