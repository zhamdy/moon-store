import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, ArrowRightLeft } from 'lucide-react';
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
import api from '../services/api';

interface ApiErrorResponse {
  error?: string;
}

interface Location {
  id: number;
  name: string;
  address: string | null;
  type: string;
  status: string;
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

export default function LocationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [locForm, setLocForm] = useState({ name: '', address: '', type: 'Store' });
  const [transferForm, setTransferForm] = useState({
    from_location_id: 0,
    to_location_id: 0,
    items: [{ product_id: 0, quantity: 1 }],
    notes: '',
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/api/locations').then((r) => r.data.data),
  });

  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ['transfers'],
    queryFn: () => api.get('/api/locations/transfers').then((r) => r.data.data),
  });

  const saveLoc = useMutation({
    mutationFn: (data: typeof locForm) => {
      if (editingId) return api.put(`/api/locations/${editingId}`, data);
      return api.post('/api/locations', data);
    },
    onSuccess: () => {
      toast.success(t('locations.saved'));
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setLocDialogOpen(false);
      setEditingId(null);
      setLocForm({ name: '', address: '', type: 'Store' });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const createTransfer = useMutation({
    mutationFn: (data: typeof transferForm) => api.post('/api/locations/transfers', data),
    onSuccess: () => {
      toast.success(t('locations.transferCreated'));
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
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

  const openEditLoc = (loc: Location) => {
    setEditingId(loc.id);
    setLocForm({ name: loc.name, address: loc.address || '', type: loc.type });
    setLocDialogOpen(true);
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('locations.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)} className="gap-2">
            <ArrowRightLeft className="h-4 w-4" /> {t('locations.newTransfer')}
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setLocForm({ name: '', address: '', type: 'Store' });
              setLocDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> {t('locations.addLocation')}
          </Button>
        </div>
      </div>

      {/* Locations grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {!locations?.length ? (
          <div className="col-span-full text-center py-16">
            <MapPin className="h-12 w-12 text-gold/40 mx-auto mb-3" />
            <p className="text-muted">{t('locations.noLocations')}</p>
          </div>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className="p-4 rounded-md border border-border bg-card hover:border-gold/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{loc.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEditLoc(loc)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Badge variant="gold" className="text-[10px] mb-1">
                {loc.type}
              </Badge>
              {loc.address && <p className="text-xs text-muted mt-1">{loc.address}</p>}
            </div>
          ))
        )}
      </div>

      {/* Transfer history */}
      <h2 className="text-xl font-display tracking-wider mb-4">{t('locations.transfers')}</h2>
      {transfers && transfers.length > 0 ? (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-start p-3 font-medium text-muted">{t('locations.from')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('locations.to')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('locations.notes')}</th>
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
        <p className="text-muted text-sm">{t('locations.noTransfers')}</p>
      )}

      {/* Location dialog */}
      <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('locations.editLocation') : t('locations.addLocation')}
            </DialogTitle>
            <DialogDescription>{t('locations.locationDetails')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveLoc.mutate(locForm);
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('locations.name')}</Label>
              <Input
                value={locForm.name}
                onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('locations.address')}</Label>
              <Input
                value={locForm.address}
                onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('locations.type')}</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={locForm.type}
                onChange={(e) => setLocForm({ ...locForm, type: e.target.value })}
              >
                <option value="Store">{t('locations.store')}</option>
                <option value="Warehouse">{t('locations.warehouse')}</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={saveLoc.isPending}>
              {saveLoc.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
                  {locations?.map((l) => (
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
                  {locations?.map((l) => (
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
              {t('locations.newTransfer')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
