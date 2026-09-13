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
import { ConfirmDialog, DataTable, PageHeader } from '../../../shared';
import { resource } from '../../../shared/lib/resource';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import type { ColumnDef } from '@tanstack/react-table';
import type { Distributor } from '../../../shared/types/index';

const distributorsResource = resource<Distributor>('distributors');

const getDistributorFormSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameRequired')),
    contact_person: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
  });

type DistributorFormData = z.infer<ReturnType<typeof getDistributorFormSchema>>;

export default function DistributorsPage() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);

  const { data: distributors, isLoading } = distributorsResource.useList();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DistributorFormData>({
    resolver: zodResolver(getDistributorFormSchema()),
  });

  const saver = distributorsResource.useSave({
    message: editingDistributor
      ? t('distributors.distributorUpdated')
      : t('distributors.distributorCreated'),
    fallbackMessage: editingDistributor
      ? t('distributors.updateFailed')
      : t('distributors.createFailed'),
    onDone: () => {
      setDialogOpen(false);
      setEditingDistributor(null);
      reset();
    },
  });

  const remover = distributorsResource.useRemove({
    message: t('distributors.distributorDeleted'),
    fallbackMessage: t('distributors.deleteFailed'),
    onDone: () => setDeleteId(null),
  });

  const onSubmit = (data: DistributorFormData) =>
    saver.save({ id: editingDistributor?.id, ...data });

  const openEditDialog = (distributor: Distributor) => {
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

  const columns: ColumnDef<Distributor>[] = [
    { accessorKey: 'name', header: t('common.name') },
    {
      accessorKey: 'contact_person',
      header: t('distributors.contactPerson'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{(getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'phone',
      header: t('distributors.phone'),
      cell: ({ getValue }) => (
        <span className="font-data text-foreground">{(getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: t('distributors.email'),
      cell: ({ getValue }) => (
        <span className="font-data text-foreground">{(getValue() as string) || '-'}</span>
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
            className="h-8 w-8"
            onPress={() => openEditDialog(row.original)}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
          </Button>
          <Button
            isIconOnly
            variant="light"
            color="danger"
            size="sm"
            className="h-8 w-8"
            onPress={() => setDeleteId(row.original.id)}
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('distributors.title')}>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus className="h-4 w-4" />}
          onPress={openCreateDialog}
        >
          {t('distributors.addDistributor')}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={distributors ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('distributors.searchPlaceholder')}
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
                    {editingDistributor
                      ? t('distributors.editDistributor')
                      : t('distributors.addDistributorTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {editingDistributor
                      ? t('distributors.updateDetails')
                      : t('distributors.createNew')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('common.name')}
                    size="sm"
                    variant="bordered"
                    {...register('name')}
                    isInvalid={!!errors.name}
                    errorMessage={errors.name?.message}
                    isRequired
                  />
                  <Input
                    label={t('distributors.contactPerson')}
                    size="sm"
                    variant="bordered"
                    {...register('contact_person')}
                  />
                  <Input
                    label={t('distributors.phone')}
                    size="sm"
                    variant="bordered"
                    {...register('phone')}
                  />
                  <Input
                    type="email"
                    label={t('distributors.email')}
                    size="sm"
                    variant="bordered"
                    {...register('email')}
                  />
                </div>
                <Input
                  label={t('distributors.address')}
                  size="sm"
                  variant="bordered"
                  {...register('address')}
                />
                <Input
                  label={t('distributors.notes')}
                  size="sm"
                  variant="bordered"
                  {...register('notes')}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saver.isSaving}>
                  {editingDistributor ? t('common.update') : t('common.create')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('distributors.deleteDistributor')}
        description={t('distributors.deleteConfirm')}
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
