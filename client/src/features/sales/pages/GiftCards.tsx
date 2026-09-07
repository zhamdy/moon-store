import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Gift, XCircle, Eye, CreditCard, MoreHorizontal } from 'lucide-react';
import {
  Button,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
} from '@heroui/react';
import { Badge, ConfirmDialog, DataTable, PageHeader } from '../../../shared';
import { formatCurrency, formatDate } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { GiftCard, GiftCardTransaction } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

const giftCards = resource<GiftCard>('gift-cards');

const emptyGiftCard = { initial_value: '', customer_id: '', expires_at: '' };

export default function GiftCards() {
  const { t } = useTranslation();

  const [cancelId, setCancelId] = useState<number | null>(null);
  const [transactionsCard, setTransactionsCard] = useState<GiftCard | null>(null);
  const { page, pageSize, update } = useListRouteState();
  const [search, setSearch] = useState('');
  const [transactionsPage, setTransactionsPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const editor = useEditorDialog(emptyGiftCard);
  const form = editor.values;

  const {
    data: cards,
    meta,
    isLoading,
    isFetching,
  } = giftCards.useList({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const listPagination = meta?.pagination as PaginationMeta | undefined;
  const tablePagination: PaginationState = { pageIndex: page - 1, pageSize };

  useLastPageRecovery(page, listPagination?.totalItems, listPagination?.totalPages, update);

  const {
    data: transactions,
    meta: transactionsMeta,
    isLoading: transactionsLoading,
  } = giftCards.useRead<GiftCardTransaction[]>(
    `${transactionsCard?.id}/transactions`,
    { page: transactionsPage, pageSize: 25 },
    !!transactionsCard
  );
  const transactionPagination = transactionsMeta?.pagination as PaginationMeta | undefined;

  const creator = giftCards.useSave({
    message: t('giftCards.created'),
    fallbackMessage: t('giftCards.createFailed'),
    onDone: editor.close,
  });

  const canceller = giftCards.useSave({
    message: t('giftCards.cancelSuccess'),
    fallbackMessage: t('giftCards.cancelFailed'),
    onDone: () => setCancelId(null),
  });

  const handleCreate = () => {
    const value = parseFloat(form.initial_value);
    if (!value || value <= 0) {
      toast.error(t('validation.pricePositive'));
      return;
    }
    creator.save({
      initial_value: value,
      customer_id: form.customer_id ? Number(form.customer_id) : undefined,
      expires_at: form.expires_at || undefined,
    });
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge size="sm" variant="success">
            {t('giftCards.active')}
          </Badge>
        );
      case 'used':
        return (
          <Badge size="sm" variant="default">
            {t('giftCards.used')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge size="sm" variant="danger">
            {t('giftCards.cancelled')}
          </Badge>
        );
      default:
        return (
          <Badge size="sm" variant="default">
            {status}
          </Badge>
        );
    }
  };

  const columns: ColumnDef<GiftCard>[] = [
    {
      accessorKey: 'code',
      header: t('giftCards.code'),
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary shrink-0" />
          <span className="font-data font-semibold tracking-wider text-foreground">
            {getValue() as string}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'barcode',
      header: t('giftCards.barcode'),
      cell: ({ getValue }) => (
        <span className="font-data text-muted-foreground">{(getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'initial_value',
      header: t('giftCards.initialValue'),
      cell: ({ getValue }) => (
        <span className="font-data text-foreground">{formatCurrency(Number(getValue()))}</span>
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
          ratio > 0.5 ? 'text-success' : ratio > 0 ? 'text-warning' : 'text-muted-foreground';
        return (
          <span className={`font-data font-semibold ${color}`}>{formatCurrency(balance)}</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('giftCards.status'),
      cell: ({ getValue }) => getStatusChip(getValue() as string),
    },
    {
      accessorKey: 'expires_at',
      header: t('giftCards.expiresAt'),
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return <span className="text-muted-foreground">-</span>;
        const isExpired = new Date(val) < new Date();
        return (
          <span
            className={`font-data text-sm ${isExpired ? 'text-danger' : 'text-muted-foreground'}`}
          >
            {formatDate(val)}
          </span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: t('giftCards.createdAt'),
      cell: ({ getValue }) => (
        <span className="font-data text-sm text-muted-foreground">
          {formatDate(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const card = row.original;
        return (
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly variant="light" size="sm" aria-label={t('common.actions')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Gift card actions">
              <DropdownItem
                key="transactions"
                startContent={<Eye className="h-4 w-4 text-primary" />}
                onPress={() => {
                  setTransactionsPage(1);
                  setTransactionsCard(card);
                }}
              >
                {t('giftCards.transactions')}
              </DropdownItem>
              {card.status === 'active' ? (
                <DropdownItem
                  key="cancel"
                  className="text-danger"
                  color="danger"
                  startContent={<XCircle className="h-4 w-4" />}
                  onPress={() => setCancelId(card.id)}
                >
                  {t('giftCards.cancel')}
                </DropdownItem>
              ) : null}
            </DropdownMenu>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader title={t('giftCards.title')}>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus className="h-4 w-4" />}
          onPress={editor.openNew}
        >
          {t('giftCards.create')}
        </Button>
      </PageHeader>

      {/* Table */}
      <DataTable
        mode="server"
        columns={columns}
        data={cards ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          update({ page: 1 });
        }}
        pagination={tablePagination}
        pageCount={listPagination?.totalPages ?? 0}
        totalRows={listPagination?.totalItems ?? 0}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(tablePagination) : updater;
          update({ page: next.pageIndex + 1, pageSize: next.pageSize });
        }}
        searchPlaceholder={t('giftCards.searchPlaceholder')}
      />

      {/* Create Dialog */}
      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('giftCards.create')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('giftCards.createDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  type="number"
                  label={t('giftCards.initialValue')}
                  size="sm"
                  variant="bordered"
                  step="0.01"
                  min="0"
                  value={form.initial_value}
                  onValueChange={(val) => editor.set('initial_value', val)}
                  placeholder="0.00"
                  isRequired
                />
                <Input
                  type="number"
                  label={`${t('giftCards.customerId')} (${t('giftCards.optional')})`}
                  size="sm"
                  variant="bordered"
                  value={form.customer_id}
                  onValueChange={(val) => editor.set('customer_id', val)}
                  placeholder={t('giftCards.customerIdPlaceholder')}
                />
                <Input
                  type="date"
                  label={`${t('giftCards.expiresAt')} (${t('giftCards.optional')})`}
                  size="sm"
                  variant="bordered"
                  value={form.expires_at}
                  onValueChange={(val) => editor.set('expires_at', val)}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onPress={handleCreate}
                  isLoading={creator.isSaving}
                  isDisabled={!form.initial_value}
                  startContent={<CreditCard className="h-4 w-4" />}
                >
                  {t('common.create')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title={t('giftCards.cancelCard')}
        description={t('giftCards.cancelConfirm')}
        confirmText={t('common.confirm')}
        confirmColor="danger"
        isLoading={canceller.isSaving}
        onConfirm={() => {
          if (cancelId) canceller.save({ id: cancelId, status: 'cancelled' });
        }}
      />

      {/* Transactions Dialog */}
      <Modal
        isOpen={!!transactionsCard}
        onOpenChange={(open) => {
          if (!open) setTransactionsCard(null);
        }}
        backdrop="blur"
        placement="center"
        size="2xl"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {t('giftCards.transactions')} — {transactionsCard?.code}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('giftCards.balance')}: {formatCurrency(transactionsCard?.balance ?? 0)} /{' '}
                    {formatCurrency(transactionsCard?.initial_value ?? 0)}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {transactionsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('common.loading')}
                    </p>
                  ) : transactions && transactions.length > 0 ? (
                    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                      <table className="w-full text-sm font-data">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                            <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wider">
                              {t('giftCards.transactionType')}
                            </th>
                            <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wider">
                              {t('giftCards.transactionAmount')}
                            </th>
                            <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wider">
                              {t('giftCards.transactionDate')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 text-foreground">
                                <Badge
                                  size="sm"
                                  variant={
                                    txn.type === 'credit'
                                      ? 'success'
                                      : txn.type === 'debit'
                                        ? 'warning'
                                        : 'default'
                                  }
                                >
                                  {txn.type}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`font-semibold ${
                                    txn.type === 'credit' ? 'text-success' : 'text-danger'
                                  }`}
                                >
                                  {txn.type === 'credit' ? '+' : '-'}
                                  {formatCurrency(Math.abs(txn.amount))}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {formatDate(txn.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('giftCards.noTransactions')}
                    </p>
                  )}
                  {transactionPagination && transactionPagination.totalPages > 1 && (
                    <div className="flex justify-center pt-3">
                      <Pagination
                        page={transactionsPage}
                        total={transactionPagination.totalPages}
                        onChange={setTransactionsPage}
                        showControls
                      />
                    </div>
                  )}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
