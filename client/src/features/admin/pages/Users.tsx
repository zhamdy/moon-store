import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  Select,
  SelectItem,
} from '@heroui/react';
import { Badge, type BadgeVariant, DataTable, ConfirmDialog, PageHeader } from '../../../shared';
import { formatDateTime, formatDate } from '../../../shared/lib/utils';
import { useAuthStore } from '../../auth';
import { resource } from '../../../shared/lib/resource';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import type { ColumnDef } from '@tanstack/react-table';
import type { User, UserRole } from '../../../shared/types/index';

const getCreateSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameRequired')),
    email: z.string().email(tStandalone('validation.emailInvalid')),
    password: z.string().min(6, tStandalone('validation.passwordMin')),
    role: z.enum(['Admin', 'Cashier', 'Delivery']),
  });

const getEditSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameRequired')),
    email: z.string().email(tStandalone('validation.emailInvalid')),
    password: z.string().optional(),
    role: z.enum(['Admin', 'Cashier', 'Delivery']),
  });

type CreateUserFormData = z.infer<ReturnType<typeof getCreateSchema>>;
type EditUserFormData = z.infer<ReturnType<typeof getEditSchema>>;
type UserFormData = CreateUserFormData | EditUserFormData;

const users = resource<User>('users');

const roleBadgeVariant: Record<UserRole, BadgeVariant> = {
  Admin: 'primary',
  Cashier: 'secondary',
  Delivery: 'default',
};

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: rows, isLoading } = users.useList();

  const schema = editingUser ? getEditSchema() : getCreateSchema();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'Cashier' },
  });

  const saver = users.useSave({
    message: editingUser ? t('users.userUpdated') : t('users.userCreated'),
    fallbackMessage: editingUser ? t('users.updateFailed') : t('users.createFailed'),
    onDone: () => {
      setDialogOpen(false);
      if (editingUser) setEditingUser(null);
      else reset();
    },
  });

  const remover = users.useRemove({
    message: t('users.userDeleted'),
    fallbackMessage: t('users.deleteFailed'),
    onDone: () => setDeleteId(null),
  });

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      const payload = { ...data };
      if (!payload.password) delete (payload as Partial<UserFormData>).password;
      saver.save({ id: editingUser.id, ...payload });
    } else {
      saver.save({ ...data });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    reset({ name: user.name, email: user.email, password: '', role: user.role });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    reset({ name: '', email: '', password: '', role: 'Cashier' });
    setDialogOpen(true);
  };

  const columns: ColumnDef<User>[] = [
    { accessorKey: 'name', header: t('common.name') },
    {
      accessorKey: 'email',
      header: t('common.email'),
      cell: ({ getValue }) => <span className="font-data">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'role',
      header: t('users.role'),
      cell: ({ getValue }) => {
        const role = getValue() as UserRole;
        return (
          <Badge size="sm" variant={roleBadgeVariant[role] || 'default'}>
            {t(`users.roles.${role}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: t('users.createdAt'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground text-sm">
          {getValue() ? formatDate(getValue() as string) : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'last_login',
      header: t('users.lastLogin'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground text-sm font-data">
          {getValue() ? formatDateTime(getValue() as string) : t('users.neverLoggedIn')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        const isSelf = currentUser?.id === user.id;
        return (
          <div className="flex gap-1">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openEditDialog(user)}
              title={t('common.edit')}
              aria-label={t('common.edit')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              isIconOnly
              variant="light"
              color="danger"
              size="sm"
              className="h-8 w-8 text-danger"
              isDisabled={isSelf}
              onClick={() => setDeleteId(user.id)}
              title={isSelf ? t('users.cannotDeleteSelf') : t('common.delete')}
              aria-label={isSelf ? t('users.cannotDeleteSelf') : t('common.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('users.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={openCreateDialog}
          >
            {t('users.addUser')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rows ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('users.searchPlaceholder')}
        enableDensityToggle
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
                    {editingUser ? t('users.editUser') : t('users.addUserTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {editingUser ? t('users.updateDetails') : t('users.createAccount')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  label={t('common.name')}
                  size="sm"
                  variant="bordered"
                  {...register('name')}
                  isInvalid={!!errors.name}
                  errorMessage={errors.name?.message}
                />
                <Input
                  type="email"
                  label={t('common.email')}
                  size="sm"
                  variant="bordered"
                  {...register('email')}
                  isInvalid={!!errors.email}
                  errorMessage={errors.email?.message}
                />
                <Input
                  type="password"
                  label={editingUser ? t('users.passwordKeep') : t('common.password')}
                  size="sm"
                  variant="bordered"
                  {...register('password')}
                  isInvalid={!!errors.password}
                  errorMessage={errors.password?.message}
                />
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('common.role')}
                      size="sm"
                      variant="bordered"
                      selectedKeys={[field.value]}
                      onChange={(e) => field.onChange(e.target.value)}
                      isInvalid={!!errors.role}
                      errorMessage={errors.role?.message}
                    >
                      <SelectItem key="Admin" textValue="Admin">
                        Admin
                      </SelectItem>
                      <SelectItem key="Cashier" textValue="Cashier">
                        Cashier
                      </SelectItem>
                      <SelectItem key="Delivery" textValue="Delivery">
                        Delivery
                      </SelectItem>
                    </Select>
                  )}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button color="primary" size="sm" type="submit" isLoading={saver.isSaving}>
                  {editingUser ? t('common.update') : t('common.create')}
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
        title={t('users.deleteUser')}
        description={t('users.deleteConfirm')}
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
