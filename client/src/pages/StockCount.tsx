import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Plus, ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Label } from '../shared/ui/label';
import { Badge } from '../shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shared/ui/dialog';
import { useTranslation } from '../shared/i18n/index';
import { resource } from '../shared/lib/resource';
import { useTransport } from '../shared/lib/transport/index';
import type { CategoryRecord, StockCountDetail, StockCountSummary } from '@/types';

const stockCounts = resource<StockCountSummary>('stock-counts');
// The same collection read one record at a time: that response carries the
// counted items the list rows leave out.
const stockCountDetails = resource<StockCountDetail>('stock-counts');
const categoriesResource = resource<CategoryRecord>('categories');

export default function StockCountPage() {
  const { t, isRtl } = useTranslation();
  const queryClient = useQueryClient();
  const transport = useTransport();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const { data: counts, isLoading } = stockCounts.useList();
  const { data: detail } = stockCountDetails.useOne(selectedCount);
  const { data: categories } = categoriesResource.useList();

  // The page jumps straight into the count it just started, so this write needs
  // the created row back — something no `resource` write hands over.
  const createMutation = useMutation({
    mutationFn: () =>
      transport.request<StockCountSummary>({
        method: 'POST',
        path: 'stock-counts',
        body: { category_id: categoryId, notes: notes || undefined },
      }),
    onSuccess: ({ data }) => {
      toast.success(t('stockCount.created'));
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      setCreateOpen(false);
      setSelectedCount(data.id);
      setCategoryId(null);
      setNotes('');
    },
    onError: (error: Error) => toast.error(error.message || 'Error'),
  });

  // Count items hang two levels down (`stock-counts/:id/items/:itemId`), which
  // `useAction` cannot address: it names the sub-action once, not per row.
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, actual_qty }: { itemId: number; actual_qty: number }) =>
      transport.request({
        method: 'PUT',
        path: `stock-counts/${selectedCount}/items/${itemId}`,
        body: { actual_qty },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-counts'] }),
  });

  const toggleApproveMutation = useMutation({
    mutationFn: (itemId: number) =>
      transport.request({
        method: 'PUT',
        path: `stock-counts/${selectedCount}/items/${itemId}/approve`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-counts'] }),
  });

  const approveCountMutation = stockCounts.useAction('approve', {
    message: t('stockCount.approved'),
    fallbackMessage: 'Error',
    onDone: () => setSelectedCount(null),
  });

  const cancelMutation = stockCounts.useRemove({
    message: t('stockCount.cancelled'),
    onDone: () => setSelectedCount(null),
  });

  const statusBadge = (status: string) => {
    if (status === 'completed') return <Badge variant="success">{t('stockCount.completed')}</Badge>;
    if (status === 'cancelled')
      return <Badge variant="destructive">{t('stockCount.cancelled')}</Badge>;
    return <Badge variant="warning">{t('stockCount.inProgress')}</Badge>;
  };

  // Detail view
  if (selectedCount && detail) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedCount(null)}>
            {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
          <div>
            <h1 className="text-2xl font-display tracking-wider">
              {t('stockCount.title')} #{detail.id}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {statusBadge(detail.status)}
              {detail.category_name && <Badge variant="gold">{detail.category_name}</Badge>}
              <span className="text-xs text-muted">{detail.started_by_name}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded-md mb-4">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-start p-3 font-medium text-muted">{t('stockCount.product')}</th>
                <th className="text-start p-3 font-medium text-muted">SKU</th>
                <th className="text-center p-3 font-medium text-muted">
                  {t('stockCount.expected')}
                </th>
                <th className="text-center p-3 font-medium text-muted">{t('stockCount.actual')}</th>
                <th className="text-center p-3 font-medium text-muted">
                  {t('stockCount.variance')}
                </th>
                <th className="text-center p-3 font-medium text-muted">
                  {t('stockCount.approved')}
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => {
                const variance =
                  item.actual_qty !== null ? item.actual_qty - item.expected_qty : null;
                return (
                  <tr key={item.id} className="border-b border-border">
                    <td className="p-3 font-medium">{item.product_name}</td>
                    <td className="p-3 font-data text-muted">{item.product_sku}</td>
                    <td className="p-3 text-center font-data">{item.expected_qty}</td>
                    <td className="p-3 text-center">
                      {detail.status === 'in_progress' ? (
                        <Input
                          type="number"
                          min="0"
                          className="w-20 h-8 text-center font-data mx-auto"
                          value={item.actual_qty ?? ''}
                          onChange={(e) =>
                            updateItemMutation.mutate({
                              itemId: item.id,
                              actual_qty: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      ) : (
                        <span className="font-data">{item.actual_qty ?? '—'}</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-data">
                      {variance !== null ? (
                        <span
                          className={
                            variance === 0
                              ? 'text-muted'
                              : variance > 0
                                ? 'text-green-500'
                                : 'text-red-500'
                          }
                        >
                          {variance > 0 ? '+' : ''}
                          {variance}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {detail.status === 'in_progress' ? (
                        <button
                          onClick={() => toggleApproveMutation.mutate(item.id)}
                          className={`h-6 w-6 rounded border mx-auto flex items-center justify-center transition-colors ${
                            item.approved
                              ? 'bg-gold border-gold text-white'
                              : 'border-border hover:border-gold'
                          }`}
                        >
                          {item.approved ? <Check className="h-3.5 w-3.5" /> : null}
                        </button>
                      ) : item.approved ? (
                        <Check className="h-4 w-4 text-gold mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detail.status === 'in_progress' && (
          <div className="flex gap-2">
            <Button
              onClick={() => selectedCount && approveCountMutation.run({ id: selectedCount })}
              disabled={approveCountMutation.isRunning}
            >
              <Check className="h-4 w-4 me-2" /> {t('stockCount.approveCount')}
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedCount && cancelMutation.remove(selectedCount)}
              className="text-destructive"
            >
              <X className="h-4 w-4 me-2" /> {t('stockCount.cancel')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('stockCount.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> {t('stockCount.startCount')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">{t('common.loading')}</p>
      ) : !counts?.length ? (
        <div className="text-center py-16">
          <PackageCheck className="h-12 w-12 text-gold/40 mx-auto mb-3" />
          <p className="text-muted">{t('stockCount.noCounts')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {counts.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setSelectedCount(sc.id)}
              className="w-full text-start p-4 rounded-md border border-border hover:border-gold/50 bg-card transition-colors flex items-center justify-between"
            >
              <div>
                <p className="font-medium">
                  {t('stockCount.title')} #{sc.id}
                </p>
                <p className="text-xs text-muted mt-1">
                  {sc.category_name || t('stockCount.allCategories')} &middot; {sc.started_by_name}{' '}
                  &middot; {new Date(sc.started_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted font-data">
                  {sc.counted}/{sc.item_count}
                </span>
                {statusBadge(sc.status)}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stockCount.startCount')}</DialogTitle>
            <DialogDescription>{t('stockCount.startDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('stockCount.selectCategory')}</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t('stockCount.allCategories')}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t('stockCount.notes')}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full"
            >
              {t('stockCount.startCount')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
