import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { ConfirmDialog, PageHeader, DataTable } from '../../../shared';
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('categories.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={openCreateDialog}
          >
            {t('categories.addCategory')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={categories ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('categories.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Modal
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        backdrop="blur"
        placement="center"
        size="md"
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
                    {editingCategory
                      ? t('categories.editCategory')
                      : t('categories.addCategoryTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {editingCategory ? t('categories.updateDetails') : t('categories.createNew')}
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
                    label={t('categories.code')}
                    size="sm"
                    variant="bordered"
                    {...register('code')}
                    isInvalid={!!errors.code}
                    errorMessage={errors.code?.message}
                  />
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saver.isSaving}>
                  {editingCategory ? t('common.update') : t('common.create')}
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
        title={t('categories.deleteCategory')}
        description={t('categories.deleteConfirm')}
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
