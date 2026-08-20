import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
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
import { resource } from '../../../shared/lib/resource';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import type { ColumnDef } from '@tanstack/react-table';
import type { CategoryRecord } from '../types';

const categoriesResource = resource<CategoryRecord>('categories');

const getCategoryFormSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameRequired')),
    code: z.string().min(1, tStandalone('validation.codeRequired')),
  });

type CategoryFormData = z.infer<ReturnType<typeof getCategoryFormSchema>>;

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);

  const { data: categories, isLoading } = categoriesResource.useList();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(getCategoryFormSchema()),
  });

  const saver = categoriesResource.useSave({
    message: editingCategory ? t('categories.categoryUpdated') : t('categories.categoryCreated'),
    fallbackMessage: editingCategory ? t('categories.updateFailed') : t('categories.createFailed'),
    onDone: () => {
      setDialogOpen(false);
      setEditingCategory(null);
      reset();
    },
  });

  const remover = categoriesResource.useRemove({
    message: t('categories.categoryDeleted'),
    fallbackMessage: t('categories.deleteFailed'),
    onDone: () => setDeleteId(null),
  });

  const onSubmit = (data: CategoryFormData) => saver.save({ id: editingCategory?.id, ...data });

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
              <Button type="submit" disabled={saver.isSaving}>
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
