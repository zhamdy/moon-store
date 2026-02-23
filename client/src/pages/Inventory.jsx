import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Upload, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import DataTable from '../components/DataTable';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation, t as tStandalone } from '../i18n';

const getProductSchema = () => z.object({
  name: z.string().min(1, tStandalone('inventory.nameRequired')),
  sku: z.string().min(1, tStandalone('inventory.skuRequired')),
  barcode: z.string().optional(),
  price: z.coerce.number().positive(tStandalone('inventory.priceMustBePositive')),
  stock: z.coerce.number().int().min(0, tStandalone('inventory.stockCannotBeNegative')),
  category: z.string().optional(),
  min_stock: z.coerce.number().int().min(0).default(5),
});

export default function Inventory() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const { t } = useTranslation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', { category: categoryFilter === 'all' ? undefined : categoryFilter }],
    queryFn: () =>
      api.get('/api/products', {
        params: {
          limit: 200,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
        },
      }).then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/api/products/categories').then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(getProductSchema()),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/api/products', data),
    onSuccess: () => {
      toast.success(t('inventory.productCreated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err) => toast.error(err.response?.data?.error || t('inventory.failedToCreateProduct')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/products/${id}`, data),
    onSuccess: () => {
      toast.success(t('inventory.productUpdated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDialogOpen(false);
      setEditingProduct(null);
      reset();
    },
    onError: (err) => toast.error(err.response?.data?.error || t('inventory.failedToUpdateProduct')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      toast.success(t('inventory.productDeleted'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || t('inventory.failedToDeleteProduct')),
  });

  const importMutation = useMutation({
    mutationFn: (products) => api.post('/api/products/import', { products }),
    onSuccess: (res) => {
      const { imported, errors } = res.data.data;
      toast.success(`${imported} ${t('inventory.productsImported')}`);
      if (errors.length > 0) {
        toast.error(`${errors.length} ${t('inventory.rowsHadErrors')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || t('inventory.importFailed')),
  });

  const onSubmit = (data) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (product) => {
    setEditingProduct(product);
    reset(product);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    reset({ name: '', sku: '', barcode: '', price: '', stock: 0, category: '', min_stock: 5 });
    setDialogOpen(true);
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const products = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i];
        });
        return {
          name: obj.name || '',
          sku: obj.sku || '',
          barcode: obj.barcode || '',
          price: parseFloat(obj.price) || 0,
          stock: parseInt(obj.stock) || 0,
          category: obj.category || '',
          min_stock: parseInt(obj.min_stock) || 5,
        };
      });

      importMutation.mutate(products);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const columns = [
    { accessorKey: 'name', header: t('inventory.productName'), cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.name}</span>
        {row.original.stock <= row.original.min_stock && (
          <Badge variant="warning" className="text-[10px]">{t('inventory.lowStock')}</Badge>
        )}
      </div>
    )},
    { accessorKey: 'sku', header: t('inventory.sku') },
    { accessorKey: 'price', header: t('inventory.price'), cell: ({ getValue }) => (
      <span className="font-data">{formatCurrency(getValue())}</span>
    )},
    { accessorKey: 'stock', header: t('inventory.stock'), cell: ({ row }) => (
      <span className={`font-data ${row.original.stock <= row.original.min_stock ? 'text-amber-400' : ''}`}>
        {row.original.stock}
      </span>
    )},
    { accessorKey: 'category', header: t('inventory.categoryCol'), cell: ({ getValue }) => (
      <Badge variant="secondary">{getValue() || t('inventory.na')}</Badge>
    )},
    ...(isAdmin ? [{
      id: 'actions',
      header: t('common.actions'),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(row.original)}>
            <Pencil className="h-3.5 w-3.5 text-gold" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(row.original.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">{t('inventory.title')}</h1>
          <div className="gold-divider mt-2" />
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCSVImport}
              className="hidden"
            />
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 text-gold" />
              {t('inventory.importCsv')}
            </Button>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t('inventory.addProduct')}
            </Button>
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-3">
        <Label className="text-muted text-xs uppercase tracking-widest">{t('inventory.category')}</Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('inventory.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inventory.allCategories')}</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={productsData}
        isLoading={isLoading}
        searchPlaceholder={t('inventory.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? t('inventory.editProduct') : t('inventory.addProductTitle')}</DialogTitle>
            <DialogDescription>
              {editingProduct ? t('inventory.updateDetails') : t('inventory.addToInventory')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.name')}</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.sku')}</Label>
                <Input {...register('sku')} />
                {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.barcode')}</Label>
                <Input {...register('barcode')} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.price')}</Label>
                <Input type="number" step="0.01" {...register('price')} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.stock')}</Label>
                <Input type="number" {...register('stock')} />
                {errors.stock && <p className="text-xs text-destructive">{errors.stock.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.categoryCol')}</Label>
                <Input {...register('category')} />
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.minStockAlert')}</Label>
                <Input type="number" {...register('min_stock')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProduct ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.deleteProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('inventory.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
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
