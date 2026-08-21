import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Plus, ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport/index';
import type { CategoryRecord, StockCountDetail, StockCountSummary } from '../types';

const stockCounts = resource<StockCountSummary>('stock-counts');
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
    if (status === 'completed')
      return (
        <Badge size="sm" variant="success">
          {t('stockCount.completed')}
        </Badge>
      );
    if (status === 'cancelled')
      return (
        <Badge size="sm" variant="danger">
          {t('stockCount.cancelled')}
        </Badge>
      );
    return (
      <Badge size="sm" variant="warning">
        {t('stockCount.inProgress')}
      </Badge>
    );
  };

  // Detail view
  if (selectedCount && detail) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            size="sm"
            onClick={() => setSelectedCount(null)}
            aria-label={t('common.back')}
          >
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('stockCount.title')} #{detail.id}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {statusBadge(detail.status)}
              {detail.category_name && (
                <Badge size="sm" variant="primary">
                  {detail.category_name}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{detail.started_by_name}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/80 dark:bg-zinc-800/90 border-b border-border text-foreground font-semibold text-xs">
              <tr>
                <th className="text-start p-3">{t('stockCount.product')}</th>
                <th className="text-start p-3">SKU</th>
                <th className="text-center p-3">{t('stockCount.expected')}</th>
                <th className="text-center p-3">{t('stockCount.actual')}</th>
                <th className="text-center p-3">{t('stockCount.variance')}</th>
                <th className="text-center p-3">{t('stockCount.approved')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {detail.items.map((item) => {
                const variance =
                  item.actual_qty !== null ? item.actual_qty - item.expected_qty : null;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{item.product_name}</td>
                    <td className="p-3 font-data text-muted-foreground">{item.product_sku}</td>
                    <td className="p-3 text-center font-data text-foreground">
                      {item.expected_qty}
                    </td>
                    <td className="p-3 text-center">
                      {detail.status === 'in_progress' ? (
                        <Input
                          type="number"
                          min="0"
                          size="sm"
                          variant="bordered"
                          className="w-24 mx-auto"
                          value={String(item.actual_qty ?? '')}
                          onValueChange={(val) =>
                            updateItemMutation.mutate({
                              itemId: item.id,
                              actual_qty: parseInt(val) || 0,
                            })
                          }
                        />
                      ) : (
                        <span className="font-data text-foreground">{item.actual_qty ?? '—'}</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-data">
                      {variance !== null ? (
                        <span
                          className={`font-semibold ${
                            variance === 0
                              ? 'text-muted-foreground'
                              : variance > 0
                                ? 'text-success'
                                : 'text-danger'
                          }`}
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
                        <Button
                          isIconOnly
                          size="sm"
                          variant={item.approved ? 'solid' : 'bordered'}
                          color={item.approved ? 'primary' : 'default'}
                          className="h-8 w-8 mx-auto"
                          onClick={() => toggleApproveMutation.mutate(item.id)}
                          aria-label={t('common.confirm')}
                        >
                          {item.approved ? <Check className="h-4 w-4" /> : null}
                        </Button>
                      ) : item.approved ? (
                        <Check className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground mx-auto" />
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
              color="primary"
              size="sm"
              startContent={<Check className="h-4 w-4" />}
              onClick={() => selectedCount && approveCountMutation.run({ id: selectedCount })}
              isLoading={approveCountMutation.isRunning}
            >
              {t('stockCount.approveCount')}
            </Button>
            <Button
              variant="flat"
              color="danger"
              size="sm"
              startContent={<X className="h-4 w-4" />}
              onClick={() => selectedCount && cancelMutation.remove(selectedCount)}
            >
              {t('stockCount.cancel')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('stockCount.title')}>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        >
          {t('stockCount.startCount')}
        </Button>
      </PageHeader>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : !counts?.length ? (
        <div className="text-center py-16">
          <PackageCheck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('stockCount.noCounts')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {counts.map((sc) => (
            <Card
              key={sc.id}
              isPressable
              onPress={() => setSelectedCount(sc.id)}
              className="border border-border bg-card hover:border-primary/50 transition-colors shadow-sm"
            >
              <CardBody className="p-4 flex flex-row items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">
                    {t('stockCount.title')} #{sc.id}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sc.category_name || t('stockCount.allCategories')} &middot;{' '}
                    {sc.started_by_name} &middot; {new Date(sc.started_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-data">
                    {sc.counted}/{sc.item_count}
                  </span>
                  {statusBadge(sc.status)}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('stockCount.startCount')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('stockCount.startDescription')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Select
                  label={t('stockCount.selectCategory')}
                  size="sm"
                  variant="bordered"
                  placeholder={t('stockCount.allCategories')}
                  selectedKeys={categoryId ? [String(categoryId)] : []}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  {categories?.map((c) => (
                    <SelectItem key={String(c.id)} textValue={c.name}>
                      {c.name}
                    </SelectItem>
                  )) || []}
                </Select>
                <Input
                  label={t('stockCount.notes')}
                  size="sm"
                  variant="bordered"
                  value={notes}
                  onValueChange={setNotes}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setCreateOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  isLoading={createMutation.isPending}
                >
                  {t('stockCount.startCount')}
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
