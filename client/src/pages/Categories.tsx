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
import { useTranslation, t as tStandalone } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError } from 'axios';

interface CategoryRecord {
  id: number;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

interface ApiErrorResponse {
  error: string;
}

const getCategoryFormSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameRequired')),
    code: z.string().min(1, tStandalone('validation.codeRequired')),
  });

type CategoryFormData = z.infer<ReturnType<typeof getCategoryFormSchema>>;

export default function CategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);

  const { data: categories, isLoading } = useQuery<CategoryRecord[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(getCategoryFormSchema()),
  });

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) => api.post('/api/categories', data),
    onSuccess: () => {
      toast.success(t('categories.categoryCreated'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('categories.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryFormData }) =>
      api.put(`/api/categories/${id}`, data),
    onSuccess: () => {
      toast.success(t('categories.categoryUpdated'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDialogOpen(false);
      setEditingCategory(null);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('categories.updateFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      toast.success(t('categories.categoryDeleted'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('categories.deleteFailed')),
  });

  const onSubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (category: CategoryRecord) => {
    setEditingCategory(category);
    reset({
      name: category.name,
      code: category.code,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    reset({ name: '', code: '' });
    setDialogOpen(true);
  };

  const columns: ColumnDef<CategoryRecord>[] = [
    { accessorKey: 'name', header: t('common.name') },
    {
      accessorKey: 'code',
      header: t('categories.code'),
      cell: ({ getValue }) => <span className="font-data">{getValue() as string}</span>,
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
            {t('categories.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          {t('categories.addCategory')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categories ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('categories.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('categories.editCategory') : t('categories.addCategoryTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? t('categories.updateDetails') : t('categories.createNew')}
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
                <Label>{t('categories.code')}</Label>
                <Input {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCategory ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categories.deleteCategory')}</AlertDialogTitle>
            <AlertDialogDescription>{t('categories.deleteConfirm')}</AlertDialogDescription>
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
