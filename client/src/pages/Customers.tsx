import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, History, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
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
import DataTable from '../components/DataTable';
import CustomerDetail from '../components/CustomerDetail';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError } from 'axios';

interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

interface ApiErrorResponse {
  error: string;
}

const customerFormSchema = z.object({
  name: z.string().min(1, 'Name required'),
  phone: z.string().min(1, 'Phone required'),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

export default function CustomersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerRecord | null>(null);

  const { data: customers, isLoading } = useQuery<CustomerRecord[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/api/customers').then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => api.post('/api/customers', data),
    onSuccess: () => {
      toast.success(t('customers.customerCreated'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('customers.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CustomerFormData }) =>
      api.put(`/api/customers/${id}`, data),
    onSuccess: () => {
      toast.success(t('customers.customerUpdated'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
      setEditingCustomer(null);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('customers.updateFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      toast.success(t('customers.customerDeleted'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('customers.deleteFailed')),
  });

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (customer: CustomerRecord) => {
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

  const columns: ColumnDef<CustomerRecord>[] = [
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
          >
            <History className="h-3.5 w-3.5 text-gold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEditDialog(row.original)}
          >
            <Pencil className="h-3.5 w-3.5 text-gold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDeleteId(row.original.id)}
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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
