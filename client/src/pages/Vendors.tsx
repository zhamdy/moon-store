import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, DollarSign, CheckCircle, Ban } from 'lucide-react';
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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600',
  active: 'bg-green-500/20 text-green-600',
  suspended: 'bg-red-500/20 text-red-600',
  rejected: 'bg-gray-500/20 text-gray-600',
};

export default function VendorsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({
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
  });
  const [payoutForm, setPayoutForm] = useState({
    amount: 0,
    method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['vendors', statusFilter],
    queryFn: () =>
      api
        .get('/api/v1/vendors', { params: { status: statusFilter || undefined } })
        .then((r) => r.data.data),
  });
  const { data: stats } = useQuery<Record<string, unknown>>({
    queryKey: ['vendor-stats'],
    queryFn: () => api.get('/api/v1/vendors/dashboard/stats').then((r) => r.data.data),
  });

  const saveVendor = useMutation({
    mutationFn: (data: typeof form) =>
      editingId ? api.put(`/api/v1/vendors/${editingId}`, data) : api.post('/api/v1/vendors', data),
    onSuccess: () => {
      toast.success(t('vendors.saved'));
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/v1/vendors/${id}/status`, { status }),
    onSuccess: () => {
      toast.success(t('vendors.statusUpdated'));
      qc.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  const createPayout = useMutation({
    mutationFn: (data: typeof payoutForm) =>
      api.post(`/api/v1/vendors/${selectedVendor?.id}/payouts`, data),
    onSuccess: () => {
      toast.success(t('vendors.payoutCreated'));
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setPayoutOpen(false);
    },
  });

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      slug: v.slug,
      email: v.email,
      phone: v.phone || '',
      description: '',
      address: '',
      city: '',
      commission_rate: v.commission_rate,
      bank_name: '',
      bank_account: '',
      bank_iban: '',
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
            {t('vendors.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm({
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
            });
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> {t('vendors.addVendor')}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-md border border-border bg-card">
            <p className="text-xs text-muted">{t('vendors.activeVendors')}</p>
            <p className="text-2xl font-display">{stats.active_vendors}</p>
          </div>
          <div className="p-4 rounded-md border border-border bg-card">
            <p className="text-xs text-muted">{t('vendors.pendingApproval')}</p>
            <p className="text-2xl font-display text-yellow-500">{stats.pending_vendors}</p>
          </div>
          <div className="p-4 rounded-md border border-border bg-card">
            <p className="text-xs text-muted">{t('vendors.totalUnpaid')}</p>
            <p className="text-2xl font-display text-gold">{fmt(stats.total_unpaid)}</p>
          </div>
          <div className="p-4 rounded-md border border-border bg-card">
            <p className="text-xs text-muted">{t('vendors.pendingCommissions')}</p>
            <p className="text-2xl font-display">{fmt(stats.pending_commissions)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'pending', 'active', 'suspended'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s ? t(`vendors.${s}`) : t('common.all')}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-start p-3 font-medium text-muted">{t('vendors.vendor')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('vendors.email')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('common.status')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('vendors.commission')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('vendors.balance')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('vendors.products')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!vendors?.length ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  {t('vendors.noVendors')}
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id} className="border-b border-border hover:bg-surface/50">
                  <td className="p-3 font-medium">{v.name}</td>
                  <td className="p-3 text-muted">{v.email}</td>
                  <td className="p-3">
                    <Badge className={statusColors[v.status]}>{t(`vendors.${v.status}`)}</Badge>
                  </td>
                  <td className="p-3 font-data">{v.commission_rate}%</td>
                  <td className="p-3 font-data text-gold">{fmt(v.balance)}</td>
                  <td className="p-3 font-data">{v.product_count}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(v)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {v.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-500"
                          onClick={() => updateStatus.mutate({ id: v.id, status: 'active' })}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {v.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedVendor(v);
                            setPayoutOpen(true);
                          }}
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {v.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => updateStatus.mutate({ id: v.id, status: 'suspended' })}
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('vendors.editVendor') : t('vendors.addVendor')}
            </DialogTitle>
            <DialogDescription>{t('vendors.vendorDetails')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveVendor.mutate(form);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('vendors.name')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('vendors.slug')}</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('vendors.email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('vendors.phone')}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('vendors.commission')} (%)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.commission_rate}
                onChange={(e) =>
                  setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t('vendors.bankName')}</Label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('vendors.bankAccount')}</Label>
                <Input
                  value={form.bank_account}
                  onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>IBAN</Label>
                <Input
                  value={form.bank_iban}
                  onChange={(e) => setForm({ ...form, bank_iban: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saveVendor.isPending}>
              {saveVendor.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payout dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('vendors.createPayout')}</DialogTitle>
            <DialogDescription>
              {t('vendors.payoutDesc')} — {selectedVendor?.name}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPayout.mutate(payoutForm);
            }}
            className="space-y-3"
          >
            <p className="text-sm text-muted">
              {t('vendors.currentBalance')}:{' '}
              <span className="text-gold font-data">{fmt(selectedVendor?.balance || 0)}</span>
            </p>
            <div className="space-y-1">
              <Label>{t('vendors.payoutAmount')}</Label>
              <Input
                type="number"
                step="0.01"
                value={payoutForm.amount}
                onChange={(e) =>
                  setPayoutForm({ ...payoutForm, amount: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('vendors.reference')}</Label>
              <Input
                value={payoutForm.reference}
                onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('vendors.notes')}</Label>
              <Input
                value={payoutForm.notes}
                onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createPayout.isPending}>
              {createPayout.isPending ? t('common.saving') : t('vendors.processPayout')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
