import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError } from 'axios';

interface DistributorRecord {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiErrorResponse {
  error: string;
}

const distributorFormSchema = z.object({
  name: z.string().min(1, 'Name required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type DistributorFormData = z.infer<typeof distributorFormSchema>;

export default function DistributorsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<DistributorRecord | null>(null);

  const { data: distributors, isLoading } = useQuery<DistributorRecord[]>({
    queryKey: ['distributors'],
    queryFn: () => api.get('/api/distributors').then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DistributorFormData>({
    resolver: zodResolver(distributorFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: DistributorFormData) => api.post('/api/distributors', data),
    onSuccess: () => {
      toast.success(t('distributors.distributorCreated'));
      queryClient.invalidateQueries({ queryKey: ['distributors'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('distributors.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DistributorFormData }) =>
      api.put(`/api/distributors/${id}`, data),
    onSuccess: () => {
      toast.success(t('distributors.distributorUpdated'));
      queryClient.invalidateQueries({ queryKey: ['distributors'] });
      setDialogOpen(false);
      setEditingDistributor(null);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('distributors.updateFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/distributors/${id}`),
    onSuccess: () => {
      toast.success(t('distributors.distributorDeleted'));
      queryClient.invalidateQueries({ queryKey: ['distributors'] });
      setDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('distributors.deleteFailed')),
  });

  const onSubmit = (data: DistributorFormData) => {
    if (editingDistributor) {
      updateMutation.mutate({ id: editingDistributor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (distributor: DistributorRecord) => {
    setEditingDistributor(distributor);
    reset({
      name: distributor.name,
      contact_person: distributor.contact_person || '',
      phone: distributor.phone || '',
      email: distributor.email || '',
      address: distributor.address || '',
      notes: distributor.notes || '',
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingDistributor(null);
    reset({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
    setDialogOpen(true);
  };

  const columns: ColumnDef<DistributorRecord>[] = [
    { accessorKey: 'name', header: t('common.name') },
    {
      accessorKey: 'contact_person',
      header: t('distributors.contactPerson'),
      cell: ({ getValue }) => <span className="text-muted">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'phone',
      header: t('distributors.phone'),
      cell: ({ getValue }) => <span className="font-data">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'email',
      header: t('distributors.email'),
      cell: ({ getValue }) => <span className="font-data">{(getValue() as string) || '-'}</span>,
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('distributors.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          {t('distributors.addDistributor')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={distributors ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('distributors.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDistributor
                ? t('distributors.editDistributor')
                : t('distributors.addDistributorTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingDistributor ? t('distributors.updateDetails') : t('distributors.createNew')}
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
                <Label>{t('distributors.contactPerson')}</Label>
                <Input {...register('contact_person')} />
              </div>
              <div className="space-y-2">
                <Label>{t('distributors.phone')}</Label>
                <Input {...register('phone')} />
              </div>
              <div className="space-y-2">
                <Label>{t('distributors.email')}</Label>
                <Input type="email" {...register('email')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('distributors.address')}</Label>
              <Input {...register('address')} />
            </div>
            <div className="space-y-2">
              <Label>{t('distributors.notes')}</Label>
              <Input {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingDistributor ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('distributors.deleteDistributor')}</AlertDialogTitle>
            <AlertDialogDescription>{t('distributors.deleteConfirm')}</AlertDialogDescription>
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
    </div>
  );
}
