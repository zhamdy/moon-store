import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, History, Star } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Textarea } from '../../../shared/ui/textarea';
import { Label } from '../../../shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../shared/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog';
import DataTable from '../../../shared/components/DataTable';
import CustomerDetail from '../components/CustomerDetail';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import type { ColumnDef } from '@tanstack/react-table';
import type { Customer } from '@/types';

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

  const { data: customers, isLoading } = customersResource.useList({ limit: 1000 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(getCustomerFormSchema()),
  });

  // Creating and updating are the same write to the server, but each says
  // something different when it lands, so they stay two hooks.
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
      cell: ({ getValue }) => <span className="text-muted">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'loyalty_points',
      header: t('loyalty.points'),
      cell: ({ getValue }) => (
        <span className="font-data flex items-center gap-1 text-gold">
          <Star className="h-3 w-3" />
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
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewingCustomer(row.original)}
            title={t('customers.viewHistory')}
            aria-label={t('customers.viewHistory')}
          >
            <History className="h-3.5 w-3.5 text-gold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEditDialog(row.original)}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5 text-gold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDeleteId(row.original.id)}
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('customers.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          {t('customers.addCustomer')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={customers ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('customers.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? t('customers.editCustomer') : t('customers.addCustomerTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer ? t('customers.updateDetails') : t('customers.createNew')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.name')}</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('customers.phone')}</Label>
                <Input {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('customers.address')}</Label>
              <Textarea {...register('address')} />
            </div>
            <div className="space-y-2">
              <Label>{t('customers.notes')}</Label>
              <Textarea {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creator.isSaving || updater.isSaving}>
                {editingCustomer ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.deleteCustomer')}</AlertDialogTitle>
            <AlertDialogDescription>{t('customers.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remover.remove(deleteId)}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
