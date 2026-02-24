import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Gift, XCircle, Eye, CreditCard } from 'lucide-react';
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
import { formatCurrency, formatDate } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError } from 'axios';

interface GiftCard {
  id: number;
  code: string;
  barcode: string | null;
  initial_value: number;
  balance: number;
  status: 'active' | 'used' | 'cancelled';
  customer_id: number | null;
  customer_name: string | null;
  expires_at: string | null;
  created_at: string;
}

interface GiftCardTransaction {
  id: number;
  gift_card_id: number;
  type: string;
  amount: number;
  reference_id: number | null;
  created_at: string;
}

interface ApiErrorResponse {
  error: string;
}

export default function GiftCards() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [transactionsCard, setTransactionsCard] = useState<GiftCard | null>(null);

  // Form state
  const [initialValue, setInitialValue] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Queries
  const { data: giftCards, isLoading } = useQuery<GiftCard[]>({
    queryKey: ['gift-cards'],
    queryFn: () => api.get('/api/gift-cards', { params: { limit: 200 } }).then((r) => r.data.data),
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<GiftCardTransaction[]>({
    queryKey: ['gift-card-transactions', transactionsCard?.id],
    queryFn: () =>
      api.get(`/api/gift-cards/${transactionsCard!.id}/transactions`).then((r) => r.data.data),
    enabled: !!transactionsCard,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { initial_value: number; customer_id?: number; expires_at?: string }) =>
      api.post('/api/gift-cards', data),
    onSuccess: () => {
      toast.success(t('giftCards.created'));
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      resetForm();
      setCreateOpen(false);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('giftCards.createFailed')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.put(`/api/gift-cards/${id}`, { status: 'cancelled' }),
    onSuccess: () => {
      toast.success(t('giftCards.cancelSuccess'));
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      setCancelId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('giftCards.cancelFailed')),
  });

  const resetForm = () => {
    setInitialValue('');
    setCustomerId('');
    setExpiresAt('');
  };

  const handleCreate = () => {
    const value = parseFloat(initialValue);
    if (!value || value <= 0) {
      toast.error(t('validation.pricePositive'));
      return;
    }
    const payload: {
      initial_value: number;
      customer_id?: number;
      expires_at?: string;
    } = { initial_value: value };
    if (customerId) payload.customer_id = Number(customerId);
    if (expiresAt) payload.expires_at = expiresAt;
    createMutation.mutate(payload);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">{t('giftCards.active')}</Badge>;
      case 'used':
        return <Badge variant="secondary">{t('giftCards.used')}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{t('giftCards.cancelled')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const columns: ColumnDef<GiftCard>[] = [
    {
      accessorKey: 'code',
      header: t('giftCards.code'),
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-gold shrink-0" />
          <span className="font-data font-semibold tracking-wider">{getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'barcode',
      header: t('giftCards.barcode'),
      cell: ({ getValue }) => (
        <span className="font-data text-muted">{(getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'initial_value',
      header: t('giftCards.initialValue'),
      cell: ({ getValue }) => (
        <span className="font-data">{formatCurrency(Number(getValue()))}</span>
      ),
    },
    {
      accessorKey: 'balance',
      header: t('giftCards.balance'),
      cell: ({ row }) => {
        const balance = row.original.balance;
        const initial = row.original.initial_value;
        const ratio = initial > 0 ? balance / initial : 0;
        const color =
          ratio > 0.5 ? 'text-emerald-400' : ratio > 0 ? 'text-amber-400' : 'text-muted';
        return (
          <span className={`font-data font-semibold ${color}`}>{formatCurrency(balance)}</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('giftCards.status'),
      cell: ({ getValue }) => getStatusBadge(getValue() as string),
    },
    {
      accessorKey: 'expires_at',
      header: t('giftCards.expiresAt'),
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return <span className="text-muted">-</span>;
        const isExpired = new Date(val) < new Date();
        return (
          <span className={`font-data text-sm ${isExpired ? 'text-destructive' : 'text-muted'}`}>
            {formatDate(val)}
          </span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: t('giftCards.createdAt'),
      cell: ({ getValue }) => (
        <span className="font-data text-sm text-muted">{formatDate(getValue() as string)}</span>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const card = row.original;
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('giftCards.transactions')}
              onClick={() => setTransactionsCard(card)}
            >
              <Eye className="h-3.5 w-3.5 text-gold" />
            </Button>
            {card.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('giftCards.cancel')}
                onClick={() => setCancelId(card.id)}
              >
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('giftCards.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('giftCards.create')}
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={giftCards ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('giftCards.searchPlaceholder')}
      />

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('giftCards.create')}</DialogTitle>
            <DialogDescription>{t('giftCards.createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('giftCards.initialValue')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={initialValue}
                onChange={(e) => setInitialValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t('giftCards.customerId')}{' '}
                <span className="text-muted text-xs">({t('giftCards.optional')})</span>
              </Label>
              <Input
                type="number"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder={t('giftCards.customerIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t('giftCards.expiresAt')}{' '}
                <span className="text-muted text-xs">({t('giftCards.optional')})</span>
              </Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !initialValue}>
              <CreditCard className="h-4 w-4 me-2" />
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('giftCards.cancelCard')}</AlertDialogTitle>
            <AlertDialogDescription>{t('giftCards.cancelConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelId && cancelMutation.mutate(cancelId)}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transactions Dialog */}
      <Dialog
        open={!!transactionsCard}
        onOpenChange={(open) => {
          if (!open) setTransactionsCard(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('giftCards.transactions')} — {transactionsCard?.code}
            </DialogTitle>
            <DialogDescription>
              {t('giftCards.balance')}: {formatCurrency(transactionsCard?.balance ?? 0)} /{' '}
              {formatCurrency(transactionsCard?.initial_value ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {transactionsLoading ? (
              <p className="text-sm text-muted text-center py-4">{t('common.loading')}</p>
            ) : transactions && transactions.length > 0 ? (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm font-data">
                  <thead>
                    <tr className="bg-table-header border-b border-border">
                      <th className="px-4 py-2 text-start text-xs font-medium uppercase tracking-wider text-foreground">
                        {t('giftCards.transactionType')}
                      </th>
                      <th className="px-4 py-2 text-start text-xs font-medium uppercase tracking-wider text-foreground">
                        {t('giftCards.transactionAmount')}
                      </th>
                      <th className="px-4 py-2 text-start text-xs font-medium uppercase tracking-wider text-foreground">
                        {t('giftCards.transactionDate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr
                        key={txn.id}
                        className="border-b border-border hover:bg-surface/50 transition-colors"
                      >
                        <td className="px-4 py-2 text-foreground">
                          <Badge
                            variant={
                              txn.type === 'credit'
                                ? 'success'
                                : txn.type === 'debit'
                                  ? 'warning'
                                  : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {txn.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`font-semibold ${
                              txn.type === 'credit' ? 'text-emerald-400' : 'text-destructive'
                            }`}
                          >
                            {txn.type === 'credit' ? '+' : '-'}
                            {formatCurrency(Math.abs(txn.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted">{formatDate(txn.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-8">{t('giftCards.noTransactions')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
