import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import { formatDateTime, formatDate } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { resource } from '../lib/resource';
import { useTranslation, t as tStandalone } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { User, UserRole } from '@/types';

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

const roleBadgeVariant: Record<UserRole, 'gold' | 'blush' | 'secondary'> = {
  Admin: 'gold',
  Cashier: 'blush',
  Delivery: 'secondary',
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
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'Cashier' },
  });

  // One save serves both verbs: `resource` reads the presence of an id to
  // decide create from update, so the page only has to say which it means.
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
      cell: ({ getValue }) => <span className="font-data">{getValue() as string}</span>,
    },
    {
      accessorKey: 'role',
      header: t('common.role'),
      cell: ({ getValue }) => (
        <Badge variant={roleBadgeVariant[getValue() as UserRole] || 'secondary'}>
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'last_login',
      header: t('users.lastLogin'),
      cell: ({ getValue }) => (
        <span className="text-muted font-data text-xs">
          {getValue() ? formatDateTime(getValue() as string) : t('users.never')}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('users.createdDate'),
      cell: ({ getValue }) => (
        <span className="text-muted font-data text-xs">{formatDate(getValue() as string)}</span>
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
            onClick={() => openEditDialog(row.original)}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5 text-gold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (row.original.id === currentUser?.id) {
                toast.error(t('users.cannotDeleteSelf'));
                return;
              }
              setDeleteId(row.original.id);
            }}
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
            {t('users.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          {t('users.addUser')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('users.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? t('users.editUser') : t('users.addUserTitle')}</DialogTitle>
            <DialogDescription>
              {editingUser ? t('users.updateDetails') : t('users.createAccount')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('common.email')}</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? t('users.passwordKeep') : t('common.password')}</Label>
              <Input type="password" {...register('password')} />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('common.role')}</Label>
              <select
                {...register('role')}
                className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-data text-foreground"
              >
                <option value="Admin">Admin</option>
                <option value="Cashier">Cashier</option>
                <option value="Delivery">Delivery</option>
              </select>
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saver.isSaving}>
                {editingUser ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.deleteUser')}</AlertDialogTitle>
            <AlertDialogDescription>{t('users.deleteConfirm')}</AlertDialogDescription>
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
