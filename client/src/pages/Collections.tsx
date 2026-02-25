import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Plus, Pencil, Trash2, Package, ArrowRight, X } from 'lucide-react';
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
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse, Product } from '@/types';

interface Collection {
  id: number;
  name: string;
  season: string | null;
  year: number | null;
  status: string;
  description: string | null;
  product_count: number;
}

interface CollectionDetail extends Collection {
  products: {
    id: number;
    name: string;
    sku: string;
    price: number;
    stock: number;
    image_url: string | null;
  }[];
}

const seasons = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
const statuses = ['upcoming', 'active', 'on_sale', 'archived'] as const;

export default function CollectionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    season: '',
    year: String(new Date().getFullYear()),
    status: 'upcoming',
    description: '',
  });
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const { data: collections } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: () => api.get('/api/collections').then((r) => r.data.data),
  });

  const { data: detail } = useQuery<CollectionDetail>({
    queryKey: ['collection-detail', selectedCol],
    queryFn: () => api.get(`/api/collections/${selectedCol}`).then((r) => r.data.data),
    enabled: !!selectedCol,
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ['products-for-collection', productSearch],
    queryFn: () =>
      api
        .get('/api/products', { params: { search: productSearch, limit: 20 } })
        .then((r) => r.data.data),
    enabled: addProductOpen,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (editingId) return api.put(`/api/collections/${editingId}`, data);
      return api.post('/api/collections', data);
    },
    onSuccess: () => {
      toast.success(t('collections.created'));
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setDialogOpen(false);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/collections/${id}`),
    onSuccess: () => {
      toast.success(t('common.delete'));
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setSelectedCol(null);
    },
  });

  const addProductMutation = useMutation({
    mutationFn: (productId: number) => {
      if (!detail) return Promise.reject();
      const currentIds = detail.products.map((p) => p.id);
      return api.put(`/api/collections/${selectedCol}`, {
        name: detail.name,
        season: detail.season || undefined,
        year: detail.year || undefined,
        status: detail.status,
        description: detail.description || undefined,
        product_ids: [...currentIds, productId],
      });
    },
    onSuccess: () => {
      toast.success(t('common.save'));
      queryClient.invalidateQueries({ queryKey: ['collection-detail', selectedCol] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: (productId: number) => {
      if (!detail) return Promise.reject();
      const currentIds = detail.products.map((p) => p.id).filter((id) => id !== productId);
      return api.put(`/api/collections/${selectedCol}`, {
        name: detail.name,
        season: detail.season || undefined,
        year: detail.year || undefined,
        status: detail.status,
        description: detail.description || undefined,
        product_ids: currentIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-detail', selectedCol] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const statusColors: Record<string, string> = {
    upcoming: 'bg-blue-500/10 text-blue-600',
    active: 'bg-emerald-500/10 text-emerald-600',
    on_sale: 'bg-orange-500/10 text-orange-600',
    archived: 'bg-gray-500/10 text-gray-600',
  };

  // Detail view
  if (selectedCol && detail) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCol(null)}>
            <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-display tracking-wider text-foreground">{detail.name}</h1>
            <div className="gold-divider mt-2" />
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setAddProductOpen(true);
              setProductSearch('');
            }}
          >
            <Plus className="h-4 w-4" /> {t('collections.addProduct')}
          </Button>
        </div>

        {detail.description && <p className="text-sm text-muted mb-4">{detail.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {!detail.products.length ? (
            <div className="col-span-full text-center py-16">
              <Package className="h-12 w-12 text-gold/40 mx-auto mb-3" />
              <p className="text-muted">{t('common.noResults')}</p>
            </div>
          ) : (
            detail.products.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-md border border-border bg-card hover:border-gold/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{p.name}</h4>
                    <p className="text-xs text-muted font-data">{p.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive shrink-0"
                    onClick={() => removeProductMutation.mutate(p.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-data font-bold text-sm">{formatCurrency(p.price)}</span>
                  <Badge variant={p.stock > 0 ? 'gold' : 'destructive'} className="text-[10px]">
                    {t('inventory.stock')}: {p.stock}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add product dialog */}
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('collections.addProduct')}</DialogTitle>
              <DialogDescription>{t('collections.title')}</DialogDescription>
            </DialogHeader>
            <Input
              placeholder={t('common.search')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-3"
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {allProducts
                ?.filter((p) => !detail.products.some((dp) => dp.id === p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-surface text-start"
                    onClick={() => {
                      addProductMutation.mutate(p.id);
                    }}
                  >
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted ms-2 font-data">{p.sku}</span>
                    </div>
                    <span className="text-sm font-data">{formatCurrency(Number(p.price))}</span>
                  </button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('collections.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm({
              name: '',
              season: '',
              year: String(new Date().getFullYear()),
              status: 'upcoming',
              description: '',
            });
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> {t('collections.create')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!collections?.length ? (
          <div className="col-span-full text-center py-16">
            <Palette className="h-12 w-12 text-gold/40 mx-auto mb-3" />
            <p className="text-muted">{t('collections.noCollections')}</p>
          </div>
        ) : (
          collections.map((col) => (
            <div
              key={col.id}
              className="p-4 rounded-md border border-border bg-card hover:border-gold/50 transition-colors cursor-pointer"
              onClick={() => setSelectedCol(col.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg">{col.name}</h3>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingId(col.id);
                      setForm({
                        name: col.name,
                        season: col.season || '',
                        year: String(col.year || ''),
                        status: col.status,
                        description: col.description || '',
                      });
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMutation.mutate(col.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <Badge className={`text-[10px] ${statusColors[col.status] || ''}`}>
                  {t(`collections.${col.status}` as never)}
                </Badge>
                {col.season && (
                  <Badge variant="gold" className="text-[10px]">
                    {t(`collections.${col.season.toLowerCase()}` as never)}
                  </Badge>
                )}
                {col.year && <span className="text-xs text-muted font-data">{col.year}</span>}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Package className="h-3 w-3" />
                <span>
                  {col.product_count} {t('collections.products').toLowerCase()}
                </span>
              </div>
              {col.description && (
                <p className="text-xs text-muted mt-1 line-clamp-2">{col.description}</p>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('common.edit') : t('collections.create')}</DialogTitle>
            <DialogDescription>{t('collections.title')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({
                name: form.name,
                season: form.season || undefined,
                year: Number(form.year) || undefined,
                status: form.status,
                description: form.description || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('common.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('collections.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t('collections.season')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.season}
                  onChange={(e) => setForm({ ...form, season: e.target.value })}
                >
                  <option value="">—</option>
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {t(`collections.${s.toLowerCase()}` as never)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('collections.year')}</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('common.status')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`collections.${s}` as never)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
