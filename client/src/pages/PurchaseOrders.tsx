import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Send, PackageCheck, Trash2, X, Eye, Wand2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import DataTable from '../components/DataTable';
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse, Product, Distributor } from '@/types';

interface PurchaseOrder {
  id: number;
  po_number: string;
  distributor_id: number;
  distributor_name: string;
  status: string;
  total: number;
  notes: string | null;
  item_count: number;
  created_by_name: string;
  created_at: string;
}

interface POItem {
  id: number;
  po_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  received_quantity: number;
  cost_price: number;
  product_name: string;
  product_sku: string;
  variant_sku: string | null;
  variant_attributes: Record<string, string> | null;
}

interface PODetail extends PurchaseOrder {
  items: POItem[];
}

interface LowStockSuggestion {
  product_id: number;
  name: string;
  sku: string;
  cost_price: number;
  stock: number;
  min_stock: number;
  distributor_id: number;
  distributor_name: string;
  suggested_qty: number;
}

interface LineItem {
  product_id: number;
  product_name: string;
  quantity: number;
  cost_price: number;
}

const STATUS_COLORS: Record<string, string> = {
  Draft: 'secondary',
  Sent: 'gold',
  'Partially Received': 'warning',
  Received: 'success',
  Cancelled: 'destructive',
};

export default function PurchaseOrders() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('All');
  const [distributorFilter, setDistributorFilter] = useState('all');

  // Create PO state
  const [createOpen, setCreateOpen] = useState(false);
  const [newDistributorId, setNewDistributorId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [addProductId, setAddProductId] = useState('');

  // Detail/Receive dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [receiveMode, setReceiveMode] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});

  // Delete/Cancel confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);

  // Queries
  const { data: orders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: [
      'purchase-orders',
      {
        status: statusFilter,
        distributor_id: distributorFilter === 'all' ? undefined : distributorFilter,
      },
    ],
    queryFn: () =>
      api
        .get('/api/purchase-orders', {
          params: {
            limit: 200,
            status: statusFilter === 'All' ? undefined : statusFilter,
            distributor_id: distributorFilter === 'all' ? undefined : distributorFilter,
          },
        })
        .then((r) => r.data.data),
  });

  const { data: detail } = useQuery<PODetail>({
    queryKey: ['purchase-order-detail', detailId],
    queryFn: () => api.get(`/api/purchase-orders/${detailId}`).then((r) => r.data.data),
    enabled: !!detailId && detailOpen,
  });

  const { data: distributors } = useQuery<Distributor[]>({
    queryKey: ['distributors'],
    queryFn: () => api.get('/api/distributors').then((r) => r.data.data),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-all'],
    queryFn: () => api.get('/api/products', { params: { limit: 500 } }).then((r) => r.data.data),
    enabled: createOpen,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: {
      distributor_id: number;
      items: Array<{ product_id: number; quantity: number; cost_price: number }>;
      notes: string | null;
    }) => api.post('/api/purchase-orders', data),
    onSuccess: () => {
      toast.success(t('po.created'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      resetCreateForm();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('po.createFailed')),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { id: number; status: string }) =>
      api.put(`/api/purchase-orders/${data.id}/status`, { status: data.status }),
    onSuccess: () => {
      toast.success(t('po.statusUpdated'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail'] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (data: { id: number; items: Array<{ item_id: number; quantity: number }> }) =>
      api.post(`/api/purchase-orders/${data.id}/receive`, { items: data.items }),
    onSuccess: () => {
      toast.success(t('po.received_success'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setReceiveMode(false);
      setReceiveQtys({});
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('po.receiveFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/purchase-orders/${id}`),
    onSuccess: () => {
      toast.success(t('po.deleted'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('po.deleteFailed')),
  });

  const resetCreateForm = () => {
    setCreateOpen(false);
    setNewDistributorId('');
    setNewNotes('');
    setLineItems([]);
    setAddProductId('');
  };

  const handleAddLineItem = () => {
    if (!addProductId) return;
    const product = products?.find((p) => p.id === Number(addProductId));
    if (!product) return;
    if (lineItems.find((li) => li.product_id === product.id)) return;
    setLineItems([
      ...lineItems,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        cost_price: product.cost_price || 0,
      },
    ]);
    setAddProductId('');
  };

  const handleCreatePO = () => {
    if (!newDistributorId || lineItems.length === 0) return;
    createMutation.mutate({
      distributor_id: Number(newDistributorId),
      items: lineItems.map((li) => ({
        product_id: li.product_id,
        quantity: li.quantity,
        cost_price: li.cost_price,
      })),
      notes: newNotes || null,
    });
  };

  const handleReceive = () => {
    if (!detailId) return;
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ item_id: Number(itemId), quantity: qty }));
    if (items.length === 0) return;
    receiveMutation.mutate({ id: detailId, items });
  };

  const handleAutoGenerate = async () => {
    try {
      const res = await api.get('/api/purchase-orders/auto-generate');
      const suggestions: LowStockSuggestion[] = res.data.data;
      if (suggestions.length === 0) {
        toast.error(t('po.autoGenerateEmpty'));
        return;
      }
      // Group by first distributor and pre-fill
      const firstDist = suggestions[0].distributor_id;
      const distItems = suggestions.filter((s) => s.distributor_id === firstDist);
      setNewDistributorId(String(firstDist));
      setLineItems(
        distItems.map((s) => ({
          product_id: s.product_id,
          product_name: s.name,
          quantity: Math.max(s.suggested_qty, 1),
          cost_price: s.cost_price || 0,
        }))
      );
      setCreateOpen(true);
    } catch {
      toast.error(t('po.createFailed'));
    }
  };

  const lineTotal = lineItems.reduce((s, li) => s + li.quantity * li.cost_price, 0);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      Draft: t('po.draft'),
      Sent: t('po.sent'),
      'Partially Received': t('po.partiallyReceived'),
      Received: t('po.fullyReceived'),
      Cancelled: t('po.cancelled'),
    };
    return map[status] || status;
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'po_number',
      header: t('po.poNumber'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'distributor_name',
      header: t('po.distributor'),
    },
    {
      accessorKey: 'status',
      header: t('po.status'),
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <Badge
            variant={
              (STATUS_COLORS[status] || 'secondary') as
                | 'secondary'
                | 'gold'
                | 'warning'
                | 'success'
                | 'destructive'
            }
          >
            {statusLabel(status)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'total',
      header: t('po.total'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold text-gold">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'item_count',
      header: t('po.items'),
      cell: ({ getValue }) => <span className="font-data">{getValue() as number}</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('po.createdAt'),
      cell: ({ getValue }) => (
        <span className="text-muted text-sm">
          {new Date(getValue() as string).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const po = row.original;
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('po.viewDetails')}
              onClick={() => {
                setDetailId(po.id);
                setDetailOpen(true);
                setReceiveMode(false);
                setReceiveQtys({});
              }}
            >
              <Eye className="h-3.5 w-3.5 text-gold" />
            </Button>
            {po.status === 'Draft' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('po.markSent')}
                onClick={() => statusMutation.mutate({ id: po.id, status: 'Sent' })}
              >
                <Send className="h-3.5 w-3.5 text-blue-400" />
              </Button>
            )}
            {(po.status === 'Sent' || po.status === 'Partially Received') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('po.receive')}
                onClick={() => {
                  setDetailId(po.id);
                  setDetailOpen(true);
                  setReceiveMode(true);
                  setReceiveQtys({});
                }}
              >
                <PackageCheck className="h-3.5 w-3.5 text-emerald-400" />
              </Button>
            )}
            {po.status !== 'Received' && po.status !== 'Cancelled' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('po.cancel')}
                onClick={() => setCancelId(po.id)}
              >
                <X className="h-3.5 w-3.5 text-amber-400" />
              </Button>
            )}
            {po.status === 'Draft' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('po.delete')}
                onClick={() => setDeleteId(po.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">{t('po.title')}</h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleAutoGenerate}>
            <Wand2 className="h-4 w-4 text-gold" />
            {t('po.autoGenerate')}
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('po.create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-muted text-xs uppercase tracking-widest">{t('po.status')}</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">{t('po.allStatuses')}</SelectItem>
            <SelectItem value="Draft">{t('po.draft')}</SelectItem>
            <SelectItem value="Sent">{t('po.sent')}</SelectItem>
            <SelectItem value="Partially Received">{t('po.partiallyReceived')}</SelectItem>
            <SelectItem value="Received">{t('po.fullyReceived')}</SelectItem>
            <SelectItem value="Cancelled">{t('po.cancelled')}</SelectItem>
          </SelectContent>
        </Select>

        <Label className="text-muted text-xs uppercase tracking-widest">
          {t('po.distributor')}
        </Label>
        <Select value={distributorFilter} onValueChange={setDistributorFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('po.allDistributors')}</SelectItem>
            {distributors?.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={orders ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('common.search')}
      />

      {/* Create PO Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) resetCreateForm();
          else setCreateOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('po.create')}</DialogTitle>
            <DialogDescription>{t('po.selectDistributor')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('po.distributor')}</Label>
                <Select value={newDistributorId} onValueChange={setNewDistributorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('po.selectDistributor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {distributors?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('po.notes')}</Label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder={t('po.notes')}
                />
              </div>
            </div>

            {/* Add product */}
            <div className="flex gap-2">
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('po.selectProduct')} />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleAddLineItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Line items */}
            {lineItems.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted font-medium px-1">
                  <span className="col-span-5">{t('po.product')}</span>
                  <span className="col-span-2">{t('po.quantity')}</span>
                  <span className="col-span-2">{t('po.costPrice')}</span>
                  <span className="col-span-2">{t('po.total')}</span>
                  <span className="col-span-1" />
                </div>
                {lineItems.map((li, i) => (
                  <div key={li.product_id} className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-5 text-sm truncate">{li.product_name}</span>
                    <Input
                      type="number"
                      className="col-span-2 h-8"
                      value={li.quantity}
                      min={1}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], quantity: Number(e.target.value) || 1 };
                        setLineItems(updated);
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      className="col-span-2 h-8"
                      value={li.cost_price}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], cost_price: Number(e.target.value) || 0 };
                        setLineItems(updated);
                      }}
                    />
                    <span className="col-span-2 text-sm font-data text-gold">
                      {formatCurrency(li.quantity * li.cost_price)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-7 w-7"
                      onClick={() => setLineItems(lineItems.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-gold">
                    {t('po.total')}: {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-4">{t('po.noItems')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetCreateForm}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreatePO}
              disabled={!newDistributorId || lineItems.length === 0 || createMutation.isPending}
            >
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Receive Dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailId(null);
            setReceiveMode(false);
            setReceiveQtys({});
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detail?.po_number} — {detail?.distributor_name}
            </DialogTitle>
            <DialogDescription>
              <Badge
                variant={
                  (STATUS_COLORS[detail?.status || ''] || 'secondary') as
                    | 'secondary'
                    | 'gold'
                    | 'warning'
                    | 'success'
                    | 'destructive'
                }
              >
                {statusLabel(detail?.status || '')}
              </Badge>{' '}
              {t('po.total')}: {formatCurrency(detail?.total || 0)}
            </DialogDescription>
          </DialogHeader>

          {detail?.notes && (
            <p className="text-sm text-muted">
              {t('po.notes')}: {detail.notes}
            </p>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto">
            <div className="grid grid-cols-12 gap-2 text-xs text-muted font-medium px-1">
              <span className="col-span-4">{t('po.product')}</span>
              <span className="col-span-2">{t('po.quantity')}</span>
              <span className="col-span-2">{t('po.received')}</span>
              <span className="col-span-2">{t('po.costPrice')}</span>
              {receiveMode && <span className="col-span-2">{t('po.receiveQty')}</span>}
            </div>
            {detail?.items.map((item) => {
              const remaining = item.quantity - item.received_quantity;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center py-1 border-b border-border/50"
                >
                  <div className="col-span-4">
                    <p className="text-sm truncate">{item.product_name}</p>
                    <p className="text-xs text-muted font-data">{item.product_sku}</p>
                  </div>
                  <span className="col-span-2 font-data">{item.quantity}</span>
                  <span
                    className={`col-span-2 font-data ${item.received_quantity >= item.quantity ? 'text-emerald-400' : item.received_quantity > 0 ? 'text-amber-400' : 'text-muted'}`}
                  >
                    {item.received_quantity}
                  </span>
                  <span className="col-span-2 font-data">{formatCurrency(item.cost_price)}</span>
                  {receiveMode && (
                    <Input
                      type="number"
                      className="col-span-2 h-8"
                      min={0}
                      max={remaining}
                      value={receiveQtys[item.id] ?? ''}
                      placeholder={String(remaining)}
                      onChange={(e) =>
                        setReceiveQtys({
                          ...receiveQtys,
                          [item.id]: Math.min(Number(e.target.value) || 0, remaining),
                        })
                      }
                      disabled={remaining <= 0}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            {receiveMode ? (
              <Button onClick={handleReceive} disabled={receiveMutation.isPending}>
                <PackageCheck className="h-4 w-4 me-2" />
                {t('po.receive')}
              </Button>
            ) : (
              detail?.status !== 'Received' &&
              detail?.status !== 'Cancelled' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setReceiveMode(true);
                    setReceiveQtys({});
                  }}
                >
                  <PackageCheck className="h-4 w-4 me-2" />
                  {t('po.receive')}
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('po.delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('po.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('po.cancel')}</AlertDialogTitle>
            <AlertDialogDescription>{t('po.cancelConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelId) {
                  statusMutation.mutate({ id: cancelId, status: 'Cancelled' });
                  setCancelId(null);
                }
              }}
              className="bg-amber-500 text-foreground hover:bg-amber-600"
            >
              {t('po.cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
