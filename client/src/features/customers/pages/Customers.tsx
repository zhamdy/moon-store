import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, History, Star } from 'lucide-react';
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
import { DataTable, ConfirmDialog, PageHeader } from '../../../shared';
import CustomerDetail from '../components/CustomerDetail';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { Customer } from '../../../shared/types/index';
import type { PaginationMeta } from '../../../shared/lib/transport/types';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

const customersResource = resource<Customer>('customers');

const getCustomerFormSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameRequired')),
    phone: z.string().min(1, tStandalone('validation.phoneRequired')),
    address: z.string().optional(),
    notes: z.string().optional(),
  });

type CustomerFormData = z.infer<ReturnType<typeof getCustomerFormSchema>>;

export default function CustomersPage() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data: customers,
    meta,
    isLoading,
    isFetching,
  } = customersResource.useList({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const paginationMeta = meta?.pagination as PaginationMeta | undefined;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(getCustomerFormSchema()),
  });

  const creator = customersResource.useSave({
    message: t('customers.customerCreated'),
    fallbackMessage: t('customers.createFailed'),
    onDone: () => {
      setDialogOpen(false);
      reset();
    },
  });

  const updater = customersResource.useSave({
    message: t('customers.customerUpdated'),
    fallbackMessage: t('customers.updateFailed'),
    onDone: () => {
      setDialogOpen(false);
      setEditingCustomer(null);
      reset();
    },
  });

  const remover = customersResource.useRemove({
    message: t('customers.customerDeleted'),
    fallbackMessage: t('customers.deleteFailed'),
    onDone: () => setDeleteId(null),
  });

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updater.save({ id: editingCustomer.id, ...data });
    } else {
      creator.save(data);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCustomer(null);
    reset({ name: '', phone: '', address: '', notes: '' });
    setDialogOpen(true);
  };

  const columns: ColumnDef<Customer>[] = [
    { accessorKey: 'name', header: t('common.name') },
    {
      accessorKey: 'phone',
      header: t('customers.phone'),
      cell: ({ getValue }) => <span className="font-data">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'address',
      header: t('customers.address'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{(getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'loyalty_points',
      header: t('loyalty.points'),
      cell: ({ getValue }) => (
        <span className="font-data flex items-center gap-1 text-foreground font-medium">
          <Star className="h-3.5 w-3.5 text-warning fill-warning" />
          {(getValue() as number) || 0}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setViewingCustomer(row.original)}
            title={t('customers.viewHistory')}
            aria-label={t('customers.viewHistory')}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => openEditDialog(row.original)}
            title={t('common.edit')}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => setDeleteId(row.original.id)}
            title={t('common.delete')}
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (viewingCustomer) {
    return (
      <div className="p-6 animate-fade-in">
        <CustomerDetail
          customerId={viewingCustomer.id}
          customerName={viewingCustomer.name}
          onBack={() => setViewingCustomer(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('customers.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={openCreateDialog}
          >
            {t('customers.addCustomer')}
          </Button>
        }
      />

      <DataTable
        mode="server"
        columns={columns}
        data={customers ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        pagination={pagination}
        pageCount={paginationMeta?.totalPages ?? 0}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          setPage(next.pageIndex + 1);
          setPageSize(next.pageSize);
        }}
        searchPlaceholder={t('customers.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Modal
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form onSubmit={handleSubmit(onSubmit)}>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editingCustomer
                      ? t('customers.editCustomer')
                      : t('customers.addCustomerTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {editingCustomer ? t('customers.updateDetails') : t('customers.createNew')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('common.name')}
                    size="sm"
                    variant="bordered"
                    {...register('name')}
                    isInvalid={!!errors.name}
                    errorMessage={errors.name?.message}
                  />
                  <Input
                    label={t('customers.phone')}
                    size="sm"
                    variant="bordered"
                    {...register('phone')}
                    isInvalid={!!errors.phone}
                    errorMessage={errors.phone?.message}
                  />
                </div>
                <Textarea
                  label={t('customers.address')}
                  size="sm"
                  variant="bordered"
                  minRows={2}
                  {...register('address')}
                />
                <Textarea
                  label={t('customers.notes')}
                  size="sm"
                  variant="bordered"
                  minRows={2}
                  {...register('notes')}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  type="submit"
                  isLoading={creator.isSaving || updater.isSaving}
                >
                  {editingCustomer ? t('common.update') : t('common.create')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t('customers.deleteCustomer')}
        description={t('customers.deleteConfirm')}
        confirmText={t('common.delete')}
        confirmColor="danger"
        isLoading={remover.isRemoving}
        onConfirm={() => {
          if (deleteId) remover.remove(deleteId);
        }}
      />
    </div>
  );
}
