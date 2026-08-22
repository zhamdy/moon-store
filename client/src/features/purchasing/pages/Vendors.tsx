import { useState } from 'react';
import { Plus, Pencil, DollarSign, CheckCircle, Ban } from 'lucide-react';
import { formatCurrency } from '../../../shared/lib/utils';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
} from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

interface Vendor {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  status: string;
  commission_rate: number;
  balance: number;
  total_sales: number;
  product_count: number;
  created_at: string;
}

/** GET vendors/dashboard/stats */
interface VendorStats {
  active_vendors: number;
  pending_vendors: number;
  total_unpaid: number;
  pending_commissions: number;
}

const vendorsResource = resource<Vendor>('vendors');

const emptyVendor = {
  name: '',
  slug: '',
  email: '',
  phone: '',
  description: '',
  address: '',
  city: '',
  commission_rate: 15,
  bank_name: '',
  bank_account: '',
  bank_iban: '',
};

const vendorToForm = (v: Vendor) => ({
  ...emptyVendor,
  name: v.name,
  slug: v.slug,
  email: v.email,
  phone: v.phone || '',
  commission_rate: v.commission_rate,
});

export default function VendorsPage() {
  const { t } = useTranslation();
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [page, setPage] = useState(1);
  const editor = useEditorDialog(emptyVendor, vendorToForm);
  const form = editor.values;
  const [payoutForm, setPayoutForm] = useState({
    amount: 0,
    method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  const { data: vendors, meta } = vendorsResource.useList({
    page,
    pageSize: 25,
    status: statusFilter || undefined,
  });
  const pagination = meta?.pagination as PaginationMeta | undefined;
  const { data: stats } = vendorsResource.useRead<VendorStats>('dashboard/stats');

  const saveVendor = vendorsResource.useSave({
    message: t('vendors.saved'),
    onDone: editor.close,
  });

  const updateStatus = vendorsResource.useAction('status', {
    method: 'PUT',
    message: t('vendors.statusUpdated'),
  });

  const createPayout = vendorsResource.useAction('payouts', {
    message: t('vendors.payoutCreated'),
    onDone: () => setPayoutOpen(false),
  });

  const fmt = (n: number) => formatCurrency(n);

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge size="sm" variant="success">
            {t('vendors.active')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge size="sm" variant="warning">
            {t('vendors.pending')}
          </Badge>
        );
      case 'suspended':
        return (
          <Badge size="sm" variant="danger">
            {t('vendors.suspended')}
          </Badge>
        );
      default:
        return (
          <Badge size="sm" variant="default">
            {t(`vendors.${status}` as never)}
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('vendors.title')}>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus className="h-4 w-4" />}
          onClick={editor.openNew}
        >
          {t('vendors.addVendor')}
        </Button>
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {t('vendors.activeVendors')}
            </p>
            <p className="text-2xl font-bold font-data text-foreground mt-1">
              {stats.active_vendors}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {t('vendors.pendingApproval')}
            </p>
            <p className="text-2xl font-bold font-data text-warning mt-1">
              {stats.pending_vendors}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {t('vendors.totalUnpaid')}
            </p>
            <p className="text-2xl font-bold font-data text-primary mt-1">
              {fmt(stats.total_unpaid)}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {t('vendors.pendingCommissions')}
            </p>
            <p className="text-2xl font-bold font-data text-foreground mt-1">
              {fmt(stats.pending_commissions)}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'active', 'suspended'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'solid' : 'bordered'}
            color={statusFilter === s ? 'primary' : 'default'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s ? t(`vendors.${s}`) : t('common.all')}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="text-start p-3 font-semibold">{t('vendors.vendor')}</th>
              <th className="text-start p-3 font-semibold">{t('vendors.email')}</th>
              <th className="text-start p-3 font-semibold">{t('common.status')}</th>
              <th className="text-start p-3 font-semibold">{t('vendors.commission')}</th>
              <th className="text-start p-3 font-semibold">{t('vendors.balance')}</th>
              <th className="text-start p-3 font-semibold">{t('vendors.products')}</th>
              <th className="text-start p-3 font-semibold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {!vendors?.length ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t('vendors.noVendors')}
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{v.name}</td>
                  <td className="p-3 text-muted-foreground">{v.email}</td>
                  <td className="p-3">{getStatusChip(v.status)}</td>
                  <td className="p-3 font-data text-foreground">{v.commission_rate}%</td>
                  <td className="p-3 font-data text-primary font-semibold">{fmt(v.balance)}</td>
                  <td className="p-3 font-data text-foreground">{v.product_count}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        className="h-7 w-7"
                        onClick={() => editor.openEdit(v)}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      {v.status === 'pending' && (
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className="h-7 w-7 text-success"
                          onClick={() => updateStatus.run({ id: v.id, body: { status: 'active' } })}
                          aria-label={t('common.confirm')}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {v.status === 'active' && (
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className="h-7 w-7 text-primary"
                          onClick={() => {
                            setSelectedVendor(v);
                            setPayoutOpen(true);
                          }}
                          aria-label={t('vendors.createPayout')}
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {v.status === 'active' && (
                        <Button
                          isIconOnly
                          variant="light"
                          color="danger"
                          size="sm"
                          className="h-7 w-7"
                          onClick={() =>
                            updateStatus.run({ id: v.id, body: { status: 'suspended' } })
                          }
                          aria-label={t('common.delete')}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Vendor dialog */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} total={pagination.totalPages} onChange={setPage} showControls />
        </div>
      )}

      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveVendor.save({ id: editor.editingId, ...form });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editor.isEditing ? t('vendors.editVendor') : t('vendors.addVendor')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('vendors.vendorDetails')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('vendors.name')}
                    size="sm"
                    variant="bordered"
                    value={form.name}
                    onValueChange={(val) => {
                      editor.set('name', val);
                      editor.set('slug', val.toLowerCase().replace(/\s+/g, '-'));
                    }}
                    isRequired
                  />
                  <Input
                    label={t('vendors.slug')}
                    size="sm"
                    variant="bordered"
                    value={form.slug}
                    onValueChange={(val) => editor.set('slug', val)}
                    isRequired
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="email"
                    label={t('vendors.email')}
                    size="sm"
                    variant="bordered"
                    value={form.email}
                    onValueChange={(val) => editor.set('email', val)}
                    isRequired
                  />
                  <Input
                    label={t('vendors.phone')}
                    size="sm"
                    variant="bordered"
                    value={form.phone}
                    onValueChange={(val) => editor.set('phone', val)}
                  />
                </div>
                <Input
                  type="number"
                  step="0.5"
                  label={`${t('vendors.commission')} (%)`}
                  size="sm"
                  variant="bordered"
                  value={String(form.commission_rate)}
                  onValueChange={(val) => editor.set('commission_rate', parseFloat(val) || 0)}
                />
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label={t('vendors.bankName')}
                    size="sm"
                    variant="bordered"
                    value={form.bank_name}
                    onValueChange={(val) => editor.set('bank_name', val)}
                  />
                  <Input
                    label={t('vendors.bankAccount')}
                    size="sm"
                    variant="bordered"
                    value={form.bank_account}
                    onValueChange={(val) => editor.set('bank_account', val)}
                  />
                  <Input
                    label="IBAN"
                    size="sm"
                    variant="bordered"
                    value={form.bank_iban}
                    onValueChange={(val) => editor.set('bank_iban', val)}
                  />
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saveVendor.isSaving}>
                  {saveVendor.isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Payout dialog */}
      <Modal
        isOpen={payoutOpen}
        onOpenChange={setPayoutOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPayout.run({ id: selectedVendor!.id, body: payoutForm });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('vendors.createPayout')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('vendors.payoutDesc')} — {selectedVendor?.name}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('vendors.currentBalance')}:{' '}
                  <span className="text-primary font-bold font-data">
                    {fmt(selectedVendor?.balance || 0)}
                  </span>
                </p>
                <Input
                  type="number"
                  step="0.01"
                  label={t('vendors.payoutAmount')}
                  size="sm"
                  variant="bordered"
                  value={String(payoutForm.amount || '')}
                  onValueChange={(val) =>
                    setPayoutForm({ ...payoutForm, amount: parseFloat(val) || 0 })
                  }
                  isRequired
                />
                <Input
                  label={t('vendors.reference')}
                  size="sm"
                  variant="bordered"
                  value={payoutForm.reference}
                  onValueChange={(val) => setPayoutForm({ ...payoutForm, reference: val })}
                />
                <Input
                  label={t('vendors.notes')}
                  size="sm"
                  variant="bordered"
                  value={payoutForm.notes}
                  onValueChange={(val) => setPayoutForm({ ...payoutForm, notes: val })}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setPayoutOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={createPayout.isRunning}>
                  {createPayout.isRunning ? t('common.saving') : t('vendors.processPayout')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
