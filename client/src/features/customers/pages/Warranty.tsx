import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import {
  Button,
  Input,
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
import type { WarrantyClaim } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

const warranty = resource<WarrantyClaim>('warranty');

const emptyClaim = { sale_id: '', product_id: '', issue: '' };

const statusVariantMap: Record<string, BadgeVariant> = {
  submitted: 'primary',
  under_review: 'warning',
  approved: 'success',
  in_progress: 'secondary',
  resolved: 'success',
  rejected: 'danger',
};

const STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'in_progress',
  'resolved',
  'rejected',
] as const;

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
    message: t('warranty.create'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const updateStatus = warranty.useAction('status', { method: 'PUT' });

  const statusKey = (s: string) => {
    const map: Record<string, string> = {
      submitted: 'warranty.submitted',
      under_review: 'warranty.underReview',
      approved: 'warranty.approved',
      in_progress: 'warranty.inProgress',
      resolved: 'warranty.resolved',
      rejected: 'warranty.rejected',
    };
    return map[s] || s;
  };

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
      cell: ({ getValue }) => (
        <span className="font-data font-medium">#{getValue() as number}</span>
      ),
    },
    {
      accessorKey: 'product_name',
      header: 'Product',
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'issue',
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
        <Badge size="sm" variant={statusVariantMap[row.original.status] || 'default'}>
          {t(statusKey(row.original.status) as never)}
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
      cell: ({ row }) => (
        <select
          className="h-8 w-36 text-xs rounded-md border border-border bg-background px-2 text-foreground"
          value={row.original.status}
          onChange={(e) =>
            updateStatus.run({ id: row.original.id, body: { status: e.target.value } })
          }
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(statusKey(s) as never)}
            </option>
          ))}
        </select>
      ),
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
            onClick={editor.openNew}
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
                  id: editor.editingId,
                  sale_id: Number(form.sale_id),
                  product_id: Number(form.product_id),
                  issue: form.issue,
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
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label={t('warranty.saleId')}
                    size="sm"
                    variant="bordered"
                    value={form.sale_id}
                    onValueChange={(val) => editor.set('sale_id', val)}
                    isRequired
                  />
                  <Input
                    type="number"
                    label="Product ID"
                    size="sm"
                    variant="bordered"
                    value={form.product_id}
                    onValueChange={(val) => editor.set('product_id', val)}
                    isRequired
                  />
                </div>
                <Input
                  label={t('warranty.issue')}
                  size="sm"
                  variant="bordered"
                  value={form.issue}
                  onValueChange={(val) => editor.set('issue', val)}
                  isRequired
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
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
