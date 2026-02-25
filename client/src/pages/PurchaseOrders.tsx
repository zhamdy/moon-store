import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Send, PackageCheck, Trash2, X, Eye, Wand2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import POFormDialog from '../components/purchase-orders/POFormDialog';
import PODetailDialog from '../components/purchase-orders/PODetailDialog';
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';
import { usePurchaseOrderData } from '../hooks/usePurchaseOrderData';
import type { ColumnDef } from '@tanstack/react-table';
import type { PurchaseOrder, LineItem, LowStockSuggestion } from '../hooks/usePurchaseOrderData';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'secondary',
  Sent: 'gold',
  'Partially Received': 'warning',
  Received: 'success',
  Cancelled: 'destructive',
};

export default function PurchaseOrders() {
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState('All');
  const [distributorFilter, setDistributorFilter] = useState('all');

  // Create PO state
  const [createOpen, setCreateOpen] = useState(false);
  const [autoDistributorId, setAutoDistributorId] = useState('');
  const [autoLineItems, setAutoLineItems] = useState<LineItem[] | undefined>(undefined);
  // Key forces POFormDialog remount when auto-generate populates initial data
  const [formKey, setFormKey] = useState(0);

  // Detail/Receive dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [initialReceiveMode, setInitialReceiveMode] = useState(false);

  // Delete/Cancel confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const {
    orders,
    isLoading,
    detail,
    distributors,
    products,
    createMutation,
    statusMutation,
    receiveMutation,
    deleteMutation,
  } = usePurchaseOrderData({
    statusFilter,
    distributorFilter,
    detailId,
    detailOpen,
    createOpen,
    onCreateSuccess: () => {
      setCreateOpen(false);
      setAutoDistributorId('');
      setAutoLineItems(undefined);
    },
    onReceiveSuccess: () => {
      setInitialReceiveMode(false);
    },
    onDeleteSuccess: () => {
      setDeleteId(null);
    },
  });

  const handleAutoGenerate = async () => {
    try {
      const res = await api.get('/api/v1/purchase-orders/auto-generate');
      const suggestions: LowStockSuggestion[] = res.data.data;
      if (suggestions.length === 0) {
        toast.error(t('po.autoGenerateEmpty'));
        return;
      }
      // Group by first distributor and pre-fill
      const firstDist = suggestions[0].distributor_id;
      const distItems = suggestions.filter((s) => s.distributor_id === firstDist);
      setAutoDistributorId(String(firstDist));
      setAutoLineItems(
        distItems.map((s) => ({
          product_id: s.product_id,
          product_name: s.name,
          quantity: Math.max(s.suggested_qty, 1),
          cost_price: s.cost_price || 0,
        }))
      );
      setFormKey((k) => k + 1);
      setCreateOpen(true);
    } catch {
      toast.error(t('po.createFailed'));
    }
  };

  const handleCreateOpen = () => {
    setAutoDistributorId('');
    setAutoLineItems(undefined);
    setFormKey((k) => k + 1);
    setCreateOpen(true);
  };

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
                setInitialReceiveMode(false);
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
                  setInitialReceiveMode(true);
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
          <Button className="gap-2" onClick={handleCreateOpen}>
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
      <POFormDialog
        key={formKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
        distributors={distributors}
        products={products}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
        initialDistributorId={autoDistributorId}
        initialLineItems={autoLineItems}
      />

      {/* Detail / Receive Dialog */}
      <PODetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailId(null);
            setInitialReceiveMode(false);
          }
        }}
        detail={detail}
        onReceive={(items) => {
          if (!detailId) return;
          receiveMutation.mutate({ id: detailId, items });
        }}
        isReceiving={receiveMutation.isPending}
        initialReceiveMode={initialReceiveMode}
      />

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
