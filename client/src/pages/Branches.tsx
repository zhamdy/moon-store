import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { useTranslation } from '../i18n';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';
import api from '../services/api';

interface Branch {
  id: number;
  name: string;
  address: string | null;
  type: string;
  status: string;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  manager_id: number | null;
  currency: string;
  tax_rate: number;
  is_primary: number;
  product_count: number;
  total_stock: number;
  opening_hours: string | null;
}
interface Transfer {
  id: number;
  from_location_name: string;
  to_location_name: string;
  user_name: string;
  status: string;
  notes: string | null;
  created_at: string;
}
interface ConsolidatedData {
  stores: {
    id: number;
    name: string;
    today_sales: number;
    today_revenue: number;
    total_stock: number;
    low_stock_count: number;
  }[];
  totals: { total_today_sales: number; total_today_revenue: number; store_count: number };
}

export default function BranchesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [tab, setTab] = useState<'branches' | 'dashboard' | 'transfers'>('branches');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_location_id: 0,
    to_location_id: 0,
    items: [{ product_id: 0, quantity: 1 }],
    notes: '',
  });
  const [form, setForm] = useState({
    name: '',
    address: '',
    type: 'Store',
    phone: '',
    email: '',
    manager_id: '',
    opening_hours: '',
    currency: 'SAR',
    tax_rate: 15,
  });
  const [settingForm, setSettingForm] = useState({ setting_key: '', setting_value: '' });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/api/v1/branches').then((r) => r.data.data),
  });
  const { data: consolidated } = useQuery<ConsolidatedData>({
    queryKey: ['branches-dashboard'],
    queryFn: () => api.get('/api/v1/branches/dashboard/consolidated').then((r) => r.data.data),
    enabled: tab === 'dashboard',
  });
  const { data: users } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/api/v1/users').then((r) => r.data.data),
  });
  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ['branch-transfers'],
    queryFn: () => api.get('/api/v1/branches/transfers').then((r) => r.data.data),
    enabled: tab === 'transfers',
  });

  const saveBranch = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        ...data,
        manager_id: data.manager_id ? Number(data.manager_id) : null,
        tax_rate: Number(data.tax_rate),
      };
      return editingId
        ? api.put(`/api/v1/branches/${editingId}`, payload)
        : api.post('/api/v1/branches', payload);
    },
    onSuccess: () => {
      toast.success(t('branches.saved'));
      qc.invalidateQueries({ queryKey: ['branches'] });
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const deleteBranch = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/branches/${id}`),
    onSuccess: () => {
      toast.success(t('branches.deleted'));
      qc.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const saveSetting = useMutation({
    mutationFn: (data: typeof settingForm) =>
      api.put(`/api/v1/branches/${selectedBranch}/settings`, data),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      setSettingForm({ setting_key: '', setting_value: '' });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const createTransfer = useMutation({
    mutationFn: (data: typeof transferForm) => api.post('/api/v1/branches/transfers', data),
    onSuccess: () => {
      toast.success(t('locations.transferCreated'));
      qc.invalidateQueries({ queryKey: ['branch-transfers'] });
      setTransferDialogOpen(false);
      setTransferForm({
        from_location_id: 0,
        to_location_id: 0,
        items: [{ product_id: 0, quantity: 1 }],
        notes: '',
      });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({
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
    setDialogOpen(true);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(n);

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('branches.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'branches' ? 'default' : 'outline'}
            onClick={() => setTab('branches')}
            className="gap-2"
          >
            <Building2 className="h-4 w-4" /> {t('branches.list')}
          </Button>
          <Button
            variant={tab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setTab('dashboard')}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" /> {t('branches.consolidated')}
          </Button>
          <Button
            variant={tab === 'transfers' ? 'default' : 'outline'}
            onClick={() => setTab('transfers')}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" /> {t('locations.transfers')}
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm({
                name: '',
                address: '',
                type: 'Store',
                phone: '',
                email: '',
                manager_id: '',
                opening_hours: '',
                currency: 'SAR',
                tax_rate: 15,
              });
              setDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> {t('branches.addBranch')}
          </Button>
        </div>
      </div>

      {tab === 'dashboard' && consolidated && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md border border-border bg-card">
              <p className="text-xs text-muted">{t('branches.totalStores')}</p>
              <p className="text-2xl font-display">{consolidated.totals.store_count}</p>
            </div>
            <div className="p-4 rounded-md border border-border bg-card">
              <p className="text-xs text-muted">{t('branches.todaySalesAll')}</p>
              <p className="text-2xl font-display">{consolidated.totals.total_today_sales}</p>
            </div>
            <div className="p-4 rounded-md border border-border bg-card">
              <p className="text-xs text-muted">{t('branches.todayRevenueAll')}</p>
              <p className="text-2xl font-display text-gold">
                {fmt(consolidated.totals.total_today_revenue)}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('branches.storeName')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('branches.todaySales')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('branches.todayRevenue')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('branches.stockLevel')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('branches.lowStock')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {consolidated.stores.map((s) => (
                  <tr key={s.id} className="border-b border-border">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 font-data">{s.today_sales}</td>
                    <td className="p-3 font-data text-gold">{fmt(s.today_revenue)}</td>
                    <td className="p-3 font-data">{s.total_stock}</td>
                    <td className="p-3">
                      {s.low_stock_count > 0 ? (
                        <Badge variant="destructive">{s.low_stock_count}</Badge>
                      ) : (
                        <Badge variant="gold">0</Badge>
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
          {!branches?.length ? (
            <div className="col-span-full text-center py-16">
              <Building2 className="h-12 w-12 text-gold/40 mx-auto mb-3" />
              <p className="text-muted">{t('branches.noBranches')}</p>
            </div>
          ) : (
            branches.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-md border border-border bg-card hover:border-gold/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{b.name}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedBranch(b.id);
                        setSettingsOpen(true);
                      }}
                      aria-label={t('branches.storeSettings')}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(b)}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!b.is_primary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm(t('branches.deleteConfirm'))) deleteBranch.mutate(b.id);
                        }}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <Badge variant="gold" className="text-[10px]">
                    {b.type}
                  </Badge>
                  {b.is_primary ? (
                    <Badge className="text-[10px] bg-gold/20 text-gold">
                      {t('branches.primary')}
                    </Badge>
                  ) : null}
                </div>
                {b.address && <p className="text-xs text-muted mb-1">{b.address}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-2">
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
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setTransferDialogOpen(true)} className="gap-2">
              <ArrowRightLeft className="h-4 w-4" /> {t('locations.newTransfer')}
            </Button>
          </div>
          {transfers && transfers.length > 0 ? (
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="text-start p-3 font-medium text-muted">{t('locations.from')}</th>
                    <th className="text-start p-3 font-medium text-muted">{t('locations.to')}</th>
                    <th className="text-start p-3 font-medium text-muted">
                      {t('locations.notes')}
                    </th>
                    <th className="text-start p-3 font-medium text-muted">{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((tr) => (
                    <tr key={tr.id} className="border-b border-border">
                      <td className="p-3">{tr.from_location_name}</td>
                      <td className="p-3">{tr.to_location_name}</td>
                      <td className="p-3 text-muted">{tr.notes || '—'}</td>
                      <td className="p-3 font-data text-muted">
                        {new Date(tr.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-sm text-center py-8">{t('locations.noTransfers')}</p>
          )}
        </div>
      )}

      {/* Transfer dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('locations.newTransfer')}</DialogTitle>
            <DialogDescription>{t('locations.transferDescription')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTransfer.mutate(transferForm);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('locations.from')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={transferForm.from_location_id}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, from_location_id: Number(e.target.value) })
                  }
                  required
                >
                  <option value={0}>—</option>
                  {branches?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('locations.to')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={transferForm.to_location_id}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, to_location_id: Number(e.target.value) })
                  }
                  required
                >
                  <option value={0}>—</option>
                  {branches?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {t('locations.product')} ID & {t('locations.quantity')}
              </Label>
              {transferForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Product ID"
                    value={item.product_id || ''}
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
                    value={item.quantity}
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
                variant="outline"
                size="sm"
                onClick={() =>
                  setTransferForm({
                    ...transferForm,
                    items: [...transferForm.items, { product_id: 0, quantity: 1 }],
                  })
                }
              >
                <Plus className="h-3 w-3 me-1" /> {t('common.add')}
              </Button>
            </div>
            <div className="space-y-1">
              <Label>{t('locations.notes')}</Label>
              <Input
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createTransfer.isPending}>
              {createTransfer.isPending ? t('common.saving') : t('locations.newTransfer')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Branch dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('branches.editBranch') : t('branches.addBranch')}
            </DialogTitle>
            <DialogDescription>{t('branches.branchDetails')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveBranch.mutate(form);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('branches.name')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('branches.type')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="Store">{t('locations.store')}</option>
                  <option value="Warehouse">{t('locations.warehouse')}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('branches.address')}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('branches.phone')}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('branches.email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('branches.manager')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.manager_id}
                  onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                >
                  <option value="">—</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('branches.currency')}</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('branches.taxRate')}</Label>
              <Input
                type="number"
                step="0.1"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saveBranch.isPending}>
              {saveBranch.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Store settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('branches.storeSettings')}</DialogTitle>
            <DialogDescription>{t('branches.storeSettingsDesc')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSetting.mutate(settingForm);
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>{t('branches.settingKey')}</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={settingForm.setting_key}
                onChange={(e) => setSettingForm({ ...settingForm, setting_key: e.target.value })}
              >
                <option value="">—</option>
                <option value="receipt_header">{t('branches.receiptHeader')}</option>
                <option value="receipt_footer">{t('branches.receiptFooter')}</option>
                <option value="default_payment_method">{t('branches.defaultPayment')}</option>
                <option value="allow_negative_stock">{t('branches.allowNegativeStock')}</option>
                <option value="auto_print_receipt">{t('branches.autoPrintReceipt')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t('branches.settingValue')}</Label>
              <Input
                value={settingForm.setting_value}
                onChange={(e) => setSettingForm({ ...settingForm, setting_value: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saveSetting.isPending}>
              {saveSetting.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
