import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Pencil,
  Phone,
  Mail,
  Users,
  Package,
  Settings2,
  BarChart3,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../shared/lib/utils';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardBody,
  Select,
  SelectItem,
} from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import { useTransport } from '../../../shared/lib/transport/index';
import PageHeader from '../../../shared/components/PageHeader';
import type { User } from '../../../shared/types/index';
import type { Branch, BranchTransfer, ConsolidatedBranches } from '../types';

const branches = resource<Branch>('branches');

const emptyBranch = {
  name: '',
  address: '',
  type: 'Store',
  phone: '',
  email: '',
  manager_id: '',
  opening_hours: '',
  currency: 'EGP',
  tax_rate: 15,
};

const branchToForm = (b: Branch) => ({
  name: b.name,
  address: b.address || '',
  type: b.type,
  phone: b.phone || '',
  email: b.email || '',
  manager_id: b.manager_id?.toString() || '',
  opening_hours: b.opening_hours || '',
  currency: b.currency,
  tax_rate: b.tax_rate,
});

const emptyTransfer = {
  from_location_id: 0,
  to_location_id: 0,
  items: [{ product_id: 0, quantity: 1 }],
  notes: '',
};

export default function BranchesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const transport = useTransport();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [tab, setTab] = useState<'branches' | 'dashboard' | 'transfers'>('branches');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState(emptyTransfer);
  const editor = useEditorDialog(emptyBranch, branchToForm);
  const form = editor.values;
  const [settingForm, setSettingForm] = useState({ setting_key: '', setting_value: '' });

  const { data: branchList } = branches.useList();
  const { data: consolidated } = branches.useRead<ConsolidatedBranches>(
    'dashboard/consolidated',
    undefined,
    tab === 'dashboard'
  );
  const { data: users = [] } = useApiQuery<Pick<User, 'id' | 'name'>[]>(['users-list'], 'users');
  const { data: transfers } = branches.useRead<BranchTransfer[]>(
    'transfers',
    undefined,
    tab === 'transfers'
  );

  const saveBranch = branches.useSave({
    message: t('branches.saved'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const deleteBranch = branches.useRemove({
    message: t('branches.deleted'),
    fallbackMessage: 'Error',
  });

  const saveSetting = branches.useAction('settings', {
    method: 'PUT',
    message: t('settings.saved'),
    fallbackMessage: 'Error',
    onDone: () => setSettingForm({ setting_key: '', setting_value: '' }),
  });

  const createTransfer = useMutation({
    mutationFn: (data: typeof transferForm) =>
      transport.request({ method: 'POST', path: 'branches/transfers', body: data }),
    onSuccess: () => {
      toast.success(t('locations.transferCreated'));
      qc.invalidateQueries({ queryKey: ['branches'] });
      setTransferDialogOpen(false);
      setTransferForm(emptyTransfer);
    },
    onError: (err: Error) => toast.error(err.message || 'Error'),
  });

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('branches.title')}>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={tab === 'branches' ? 'solid' : 'bordered'}
            color={tab === 'branches' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setTab('branches')}
            startContent={<Building2 className="h-4 w-4" />}
          >
            {t('branches.list')}
          </Button>
          <Button
            variant={tab === 'dashboard' ? 'solid' : 'bordered'}
            color={tab === 'dashboard' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setTab('dashboard')}
            startContent={<BarChart3 className="h-4 w-4" />}
          >
            {t('branches.consolidated')}
          </Button>
          <Button
            variant={tab === 'transfers' ? 'solid' : 'bordered'}
            color={tab === 'transfers' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setTab('transfers')}
            startContent={<ArrowRightLeft className="h-4 w-4" />}
          >
            {t('locations.transfers')}
          </Button>
          <Button
            color="primary"
            size="sm"
            onClick={editor.openNew}
            startContent={<Plus className="h-4 w-4" />}
          >
            {t('branches.addBranch')}
          </Button>
        </div>
      </PageHeader>

      {tab === 'dashboard' && consolidated && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-4">
                <p className="text-xs text-muted-foreground">{t('branches.totalStores')}</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {consolidated.totals.store_count}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-4">
                <p className="text-xs text-muted-foreground">{t('branches.todaySalesAll')}</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {consolidated.totals.total_today_sales}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-4">
                <p className="text-xs text-muted-foreground">{t('branches.todayRevenueAll')}</p>
                <p className="text-2xl font-bold mt-1 text-primary">
                  {fmt(consolidated.totals.total_today_revenue)}
                </p>
              </CardBody>
            </Card>
          </div>
          <div className="overflow-x-auto border border-border rounded-lg bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-start p-3 font-medium text-muted-foreground">
                    {t('branches.storeName')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted-foreground">
                    {t('branches.todaySales')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted-foreground">
                    {t('branches.todayRevenue')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted-foreground">
                    {t('branches.stockLevel')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted-foreground">
                    {t('branches.lowStock')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {consolidated.stores.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 font-data">{s.today_sales}</td>
                    <td className="p-3 font-data text-primary font-medium">
                      {fmt(s.today_revenue)}
                    </td>
                    <td className="p-3 font-data">{s.total_stock}</td>
                    <td className="p-3">
                      {s.low_stock_count > 0 ? (
                        <Badge size="sm" variant="danger">
                          {s.low_stock_count}
                        </Badge>
                      ) : (
                        <Badge size="sm" variant="default">
                          0
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!branchList?.length ? (
            <div className="col-span-full text-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('branches.noBranches')}</p>
            </div>
          ) : (
            branchList.map((b) => (
              <Card
                key={b.id}
                className="border border-border bg-card shadow-sm hover:border-border/80 transition-colors"
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{b.name}</h3>
                    <div className="flex gap-1">
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => {
                          setSelectedBranch(b.id);
                          setSettingsOpen(true);
                        }}
                        aria-label={t('branches.storeSettings')}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => editor.openEdit(b)}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!b.is_primary && (
                        <Button
                          isIconOnly
                          variant="light"
                          color="danger"
                          size="sm"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm(t('branches.deleteConfirm'))) deleteBranch.remove(b.id);
                          }}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Badge size="sm" variant="primary">
                      {b.type}
                    </Badge>
                    {b.is_primary ? (
                      <Badge size="sm" variant="secondary">
                        {t('branches.primary')}
                      </Badge>
                    ) : null}
                  </div>
                  {b.address && <p className="text-xs text-muted-foreground mb-1">{b.address}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3 pt-2 border-t border-border/50">
                    {b.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {b.phone}
                      </span>
                    )}
                    {b.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {b.email}
                      </span>
                    )}
                    {b.manager_name && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {b.manager_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {b.product_count} {t('branches.products')}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="bordered"
              onClick={() => setTransferDialogOpen(true)}
              startContent={<ArrowRightLeft className="h-4 w-4" />}
            >
              {t('locations.newTransfer')}
            </Button>
          </div>
          {transfers && transfers.length > 0 ? (
            <div className="overflow-x-auto border border-border rounded-lg bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-start p-3 font-medium text-muted-foreground">
                      {t('locations.from')}
                    </th>
                    <th className="text-start p-3 font-medium text-muted-foreground">
                      {t('locations.to')}
                    </th>
                    <th className="text-start p-3 font-medium text-muted-foreground">
                      {t('locations.notes')}
                    </th>
                    <th className="text-start p-3 font-medium text-muted-foreground">
                      {t('common.date')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((tr) => (
                    <tr key={tr.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="p-3 font-medium">{tr.from_location_name}</td>
                      <td className="p-3 font-medium">{tr.to_location_name}</td>
                      <td className="p-3 text-muted-foreground">{tr.notes || '—'}</td>
                      <td className="p-3 font-data text-muted-foreground">
                        {new Date(tr.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">
              {t('locations.noTransfers')}
            </p>
          )}
        </div>
      )}

      {/* Transfer dialog */}
      <Modal
        isOpen={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTransfer.mutate(transferForm);
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('locations.newTransfer')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('locations.transferDescription')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label={t('locations.from')}
                    size="sm"
                    variant="bordered"
                    isRequired
                    selectedKeys={
                      transferForm.from_location_id ? [String(transferForm.from_location_id)] : []
                    }
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, from_location_id: Number(e.target.value) })
                    }
                  >
                    {[
                      <SelectItem key="0" textValue="—">
                        —
                      </SelectItem>,
                      ...(branchList || []).map((l) => (
                        <SelectItem key={String(l.id)} textValue={l.name}>
                          {l.name}
                        </SelectItem>
                      )),
                    ]}
                  </Select>
                  <Select
                    label={t('locations.to')}
                    size="sm"
                    variant="bordered"
                    isRequired
                    selectedKeys={
                      transferForm.to_location_id ? [String(transferForm.to_location_id)] : []
                    }
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, to_location_id: Number(e.target.value) })
                    }
                  >
                    {[
                      <SelectItem key="0" textValue="—">
                        —
                      </SelectItem>,
                      ...(branchList || []).map((l) => (
                        <SelectItem key={String(l.id)} textValue={l.name}>
                          {l.name}
                        </SelectItem>
                      )),
                    ]}
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {t('locations.product')} ID & {t('locations.quantity')}
                  </p>
                  {transferForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Product ID"
                        size="sm"
                        variant="bordered"
                        value={item.product_id ? String(item.product_id) : ''}
                        onChange={(e) => {
                          const items = [...transferForm.items];
                          items[idx] = { ...items[idx], product_id: parseInt(e.target.value) || 0 };
                          setTransferForm({ ...transferForm, items });
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        size="sm"
                        variant="bordered"
                        value={String(item.quantity)}
                        onChange={(e) => {
                          const items = [...transferForm.items];
                          items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 1 };
                          setTransferForm({ ...transferForm, items });
                        }}
                        className="w-24"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="flat"
                    size="sm"
                    onClick={() =>
                      setTransferForm({
                        ...transferForm,
                        items: [...transferForm.items, { product_id: 0, quantity: 1 }],
                      })
                    }
                    startContent={<Plus className="h-3.5 w-3.5" />}
                  >
                    {t('common.add')}
                  </Button>
                </div>
                <Input
                  label={t('locations.notes')}
                  size="sm"
                  variant="bordered"
                  value={transferForm.notes}
                  onValueChange={(val) => setTransferForm({ ...transferForm, notes: val })}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setTransferDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  size="sm"
                  isLoading={createTransfer.isPending}
                >
                  {t('locations.newTransfer')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Branch dialog */}
      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveBranch.save({
                  id: editor.editingId,
                  ...form,
                  manager_id: form.manager_id ? Number(form.manager_id) : null,
                  tax_rate: Number(form.tax_rate),
                });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editor.isEditing ? t('branches.editBranch') : t('branches.addBranch')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('branches.branchDetails')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('branches.name')}
                    size="sm"
                    variant="bordered"
                    value={form.name}
                    onValueChange={(val) => editor.set('name', val)}
                    isRequired
                  />
                  <Select
                    label={t('branches.type')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.type]}
                    onChange={(e) => editor.set('type', e.target.value)}
                  >
                    <SelectItem key="Store" textValue={t('locations.store')}>
                      {t('locations.store')}
                    </SelectItem>
                    <SelectItem key="Warehouse" textValue={t('locations.warehouse')}>
                      {t('locations.warehouse')}
                    </SelectItem>
                  </Select>
                </div>
                <Input
                  label={t('branches.address')}
                  size="sm"
                  variant="bordered"
                  value={form.address}
                  onValueChange={(val) => editor.set('address', val)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('branches.phone')}
                    size="sm"
                    variant="bordered"
                    value={form.phone}
                    onValueChange={(val) => editor.set('phone', val)}
                  />
                  <Input
                    type="email"
                    label={t('branches.email')}
                    size="sm"
                    variant="bordered"
                    value={form.email}
                    onValueChange={(val) => editor.set('email', val)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label={t('branches.manager')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={form.manager_id ? [form.manager_id] : []}
                    onChange={(e) => editor.set('manager_id', e.target.value)}
                  >
                    {[
                      <SelectItem key="" textValue="—">
                        —
                      </SelectItem>,
                      ...users.map((u) => (
                        <SelectItem key={String(u.id)} textValue={u.name}>
                          {u.name}
                        </SelectItem>
                      )),
                    ]}
                  </Select>
                  <Input
                    label={t('branches.currency')}
                    size="sm"
                    variant="bordered"
                    value={form.currency}
                    onValueChange={(val) => editor.set('currency', val)}
                  />
                </div>
                <Input
                  type="number"
                  step="0.1"
                  label={t('branches.taxRate')}
                  size="sm"
                  variant="bordered"
                  value={String(form.tax_rate)}
                  onChange={(e) => editor.set('tax_rate', parseFloat(e.target.value) || 0)}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saveBranch.isSaving}>
                  {t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Store settings dialog */}
      <Modal
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedBranch) saveSetting.run({ id: selectedBranch, body: settingForm });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('branches.storeSettings')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('branches.storeSettingsDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-3">
                <Select
                  label={t('branches.settingKey')}
                  size="sm"
                  variant="bordered"
                  selectedKeys={settingForm.setting_key ? [settingForm.setting_key] : []}
                  onChange={(e) => setSettingForm({ ...settingForm, setting_key: e.target.value })}
                >
                  <SelectItem key="receipt_header" textValue={t('branches.receiptHeader')}>
                    {t('branches.receiptHeader')}
                  </SelectItem>
                  <SelectItem key="receipt_footer" textValue={t('branches.receiptFooter')}>
                    {t('branches.receiptFooter')}
                  </SelectItem>
                  <SelectItem key="default_payment_method" textValue={t('branches.defaultPayment')}>
                    {t('branches.defaultPayment')}
                  </SelectItem>
                  <SelectItem
                    key="allow_negative_stock"
                    textValue={t('branches.allowNegativeStock')}
                  >
                    {t('branches.allowNegativeStock')}
                  </SelectItem>
                  <SelectItem key="auto_print_receipt" textValue={t('branches.autoPrintReceipt')}>
                    {t('branches.autoPrintReceipt')}
                  </SelectItem>
                </Select>
                <Input
                  label={t('branches.settingValue')}
                  size="sm"
                  variant="bordered"
                  value={settingForm.setting_value}
                  onValueChange={(val) => setSettingForm({ ...settingForm, setting_value: val })}
                  isRequired
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setSettingsOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saveSetting.isRunning}>
                  {t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
