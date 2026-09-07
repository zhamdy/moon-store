import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import {
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Badge, type BadgeVariant, PageHeader, DataTable } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import type { WarrantyClaim, WarrantyStatus } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

const warranty = resource<WarrantyClaim>('warranty');

const emptyClaim = {
  customer_name: '',
  customer_phone: '',
  product_id: '',
  sale_id: '',
  issue_description: '',
};

const statusVariantMap: Record<WarrantyStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'primary',
  rejected: 'danger',
  completed: 'success',
  resolved: 'success',
  replaced: 'secondary',
  refunded: 'secondary',
};

/**
 * Which statuses a claim may move to next. The set of values is the database's,
 * not ours: `warranty_claims.status` carries a CHECK constraint over exactly
 * these seven, so anything else is rejected by the database itself.
 *
 * The shape is a triage step then a resolution step. `pending` is what the
 * server stamps on create and is never offered as a target; the four outcomes
 * (`rejected`, and the three ways to make a customer good) are terminal.
 * `completed` is a legacy synonym of `resolved` — displayable, because rows may
 * already hold it, but never offered as a transition.
 */
const STATUS_TRANSITIONS: Record<WarrantyStatus, readonly WarrantyStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['replaced', 'refunded', 'resolved'],
  rejected: [],
  completed: [],
  resolved: [],
  replaced: [],
  refunded: [],
};

const statusKey = (status: string) => `warranty.${status}`;

export default function WarrantyPage() {
  const { t } = useTranslation();
  const editor = useEditorDialog(emptyClaim);
  const form = editor.values;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: claims, meta, isLoading, isFetching } = warranty.useList({ page, pageSize });
  const pageMeta = meta?.pagination as PaginationMeta | undefined;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };

  const saver = warranty.useSave({
    message: t('warranty.created'),
    fallbackMessage: t('common.error'),
    onDone: editor.close,
  });

  // The server exposes no `warranty/:id/status` sub-action: a status change is
  // a PUT of the record itself, which accepts `{ status, resolution }`.
  const updateStatus = warranty.useSave({
    message: t('warranty.statusUpdated'),
    fallbackMessage: t('common.error'),
  });

  const columns: ColumnDef<WarrantyClaim>[] = [
    {
      accessorKey: 'id',
      header: '#',
      cell: ({ getValue }) => (
        <span className="font-data text-muted-foreground">#{getValue() as number}</span>
      ),
    },
    {
      accessorKey: 'sale_id',
      header: t('warranty.saleId'),
      cell: ({ getValue }) => {
        const saleId = getValue() as number | null | undefined;
        return saleId === null || saleId === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-data font-medium">#{saleId}</span>
        );
      },
    },
    {
      accessorKey: 'product_name',
      header: t('warranty.product'),
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: t('warranty.customerName'),
      cell: ({ getValue }) => (
        <span className="text-foreground">{(getValue() as string | null) ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'issue_description',
      header: t('warranty.issue'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground max-w-48 truncate block">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('warranty.status'),
      cell: ({ row }) => (
        <Badge size="sm" variant={statusVariantMap[row.original.status] ?? 'default'}>
          {t(statusKey(row.original.status))}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('common.date'),
      cell: ({ getValue }) => (
        <span className="font-data text-xs text-muted-foreground">
          {new Date(getValue() as string).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const current = row.original.status;
        const nextStatuses = STATUS_TRANSITIONS[current] ?? [];
        return (
          <select
            className="h-8 w-36 text-xs rounded-md border border-border bg-background px-2 text-foreground disabled:opacity-60"
            value={current}
            disabled={nextStatuses.length === 0}
            aria-label={t('warranty.changeStatus')}
            onChange={(e) => updateStatus.save({ id: row.original.id, status: e.target.value })}
          >
            <option value={current}>{t(statusKey(current))}</option>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {t(statusKey(s))}
              </option>
            ))}
          </select>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('warranty.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onPress={editor.openNew}
          >
            {t('warranty.create')}
          </Button>
        }
      />

      <DataTable
        mode="server"
        columns={columns}
        data={claims ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={pagination}
        pageCount={pageMeta?.totalPages ?? 0}
        totalRows={pageMeta?.totalItems ?? 0}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          setPage(next.pageIndex + 1);
          setPageSize(next.pageSize);
        }}
        searchPlaceholder={t('common.search')}
      />

      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
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
                saver.save({
                  customer_name: form.customer_name,
                  customer_phone: form.customer_phone,
                  product_id: Number(form.product_id),
                  // Optional server-side: a claim can be filed before the
                  // original sale has been located.
                  sale_id: form.sale_id ? Number(form.sale_id) : undefined,
                  issue_description: form.issue_description,
                });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('warranty.create')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('warranty.title')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t('warranty.customerName')}
                    size="sm"
                    variant="bordered"
                    value={form.customer_name}
                    onValueChange={(val) => editor.set('customer_name', val)}
                    isRequired
                  />
                  <Input
                    label={t('warranty.customerPhone')}
                    size="sm"
                    variant="bordered"
                    value={form.customer_phone}
                    onValueChange={(val) => editor.set('customer_phone', val)}
                    isRequired
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label={t('warranty.productId')}
                    size="sm"
                    variant="bordered"
                    value={form.product_id}
                    onValueChange={(val) => editor.set('product_id', val)}
                    isRequired
                  />
                  <Input
                    type="number"
                    label={t('warranty.saleIdOptional')}
                    size="sm"
                    variant="bordered"
                    value={form.sale_id}
                    onValueChange={(val) => editor.set('sale_id', val)}
                  />
                </div>
                <Textarea
                  label={t('warranty.issue')}
                  size="sm"
                  variant="bordered"
                  minRows={2}
                  value={form.issue_description}
                  onValueChange={(val) => editor.set('issue_description', val)}
                  isRequired
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button color="primary" size="sm" type="submit" isLoading={saver.isSaving}>
                  {saver.isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
