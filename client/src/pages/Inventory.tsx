import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Upload, Pencil, Trash2, AlertTriangle, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import DataTable from '../components/DataTable';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation, t as tStandalone } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError, AxiosResponse } from 'axios';

interface Category {
  id: number;
  name: string;
  code: string;
}

interface Distributor {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: string | number;
  stock: number;
  category: string;
  category_id: number | null;
  category_name: string | null;
  category_code: string | null;
  distributor_id: number | null;
  distributor_name: string | null;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

interface ImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

interface ApiErrorResponse {
  error: string;
}

const getProductSchema = () =>
  z.object({
    name: z.string().min(1, tStandalone('validation.nameReq')),
    sku: z.string().min(1, tStandalone('validation.skuRequired')),
    barcode: z.string().optional(),
    price: z.coerce.number().positive(tStandalone('validation.pricePositive')),
    stock: z.coerce.number().int().min(0, tStandalone('validation.stockNonNeg')),
    category_id: z.coerce.number().int().positive().optional().nullable(),
    distributor_id: z.coerce.number().int().positive().optional().nullable(),
    min_stock: z.coerce.number().int().min(0).default(5),
  });

type ProductFormData = z.infer<ReturnType<typeof getProductSchema>>;

interface CsvProduct {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  stock: number;
  category: string;
  min_stock: number;
}

interface LowStockProduct extends Product {
  deficit: number;
}

export default function Inventory() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('lowStock') === 'true');

  const toggleLowStock = (on: boolean) => {
    setLowStockFilter(on);
    if (on) {
      setSearchParams({ lowStock: 'true' });
    } else {
      setSearchParams({});
    }
  };

  const { data: productsData, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products', { category_id: categoryFilter === 'all' ? undefined : categoryFilter }],
    queryFn: () =>
      api
        .get('/api/products', {
          params: {
            limit: 200,
            category_id: categoryFilter === 'all' ? undefined : categoryFilter,
          },
        })
        .then((r) => r.data.data),
    enabled: !lowStockFilter,
  });

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery<LowStockProduct[]>({
    queryKey: ['products-low-stock'],
    queryFn: () => api.get('/api/products/low-stock').then((r) => r.data.data),
    enabled: lowStockFilter,
  });

  const isLoading = lowStockFilter ? lowStockLoading : productsLoading;

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/api/products/categories').then((r) => r.data.data),
  });

  const { data: distributors } = useQuery<Distributor[]>({
    queryKey: ['distributors'],
    queryFn: () => api.get('/api/distributors').then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(getProductSchema()),
  });

  const watchCategoryId = watch('category_id');

  // Auto-generate SKU when category changes (only for new products)
  useEffect(() => {
    if (!editingProduct && watchCategoryId && dialogOpen) {
      api
        .get(`/api/products/generate-sku/${watchCategoryId}`)
        .then((r) => {
          setValue('sku', r.data.data.sku);
        })
        .catch(() => {});
    }
  }, [watchCategoryId, editingProduct, dialogOpen, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/api/products', data),
    onSuccess: () => {
      toast.success(t('inventory.productCreated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('inventory.failedToCreateProduct')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductFormData }) =>
      api.put(`/api/products/${id}`, data),
    onSuccess: () => {
      toast.success(t('inventory.productUpdated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setDialogOpen(false);
      setEditingProduct(null);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('inventory.failedToUpdateProduct')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      toast.success(t('inventory.productDeleted'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('inventory.failedToDeleteProduct')),
  });

  const importMutation = useMutation({
    mutationFn: (products: CsvProduct[]) => api.post('/api/products/import', { products }),
    onSuccess: (res: AxiosResponse<{ data: ImportResult }>) => {
      const { imported, errors } = res.data.data;
      toast.success(`${imported} ${t('inventory.productsImported')}`);
      if (errors.length > 0) {
        toast.error(`${errors.length} ${t('inventory.rowsHadErrors')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('inventory.importFailed')),
  });

  const onSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    reset({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      price: Number(product.price),
      stock: product.stock,
      category_id: product.category_id,
      distributor_id: product.distributor_id,
      min_stock: product.min_stock,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    reset({
      name: '',
      sku: '',
      barcode: '',
      price: 0,
      stock: 0,
      category_id: null,
      distributor_id: null,
      min_stock: 5,
    });
    setDialogOpen(true);

    // Auto-generate barcode for new products
    api
      .get('/api/products/generate-barcode')
      .then((r) => {
        setValue('barcode', r.data.data.barcode);
      })
      .catch(() => {});
  };

  const handleCSVImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const products: CsvProduct[] = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const obj: Record<string, string> = {};
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

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: t('inventory.productName'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.name}</span>
          {row.original.stock === 0 ? (
            <Badge variant="destructive" className="text-[10px]">
              {t('inventory.critical')}
            </Badge>
          ) : row.original.stock <= row.original.min_stock ? (
            <Badge variant="warning" className="text-[10px]">
              {t('inventory.lowStock')}
            </Badge>
          ) : null}
        </div>
      ),
    },
    { accessorKey: 'sku', header: t('inventory.sku') },
    {
      accessorKey: 'price',
      header: t('inventory.price'),
      cell: ({ getValue }) => (
        <span className="font-data">{formatCurrency(Number(getValue()))}</span>
      ),
    },
    {
      accessorKey: 'stock',
      header: t('inventory.stock'),
      cell: ({ row }) => (
        <span
          className={`font-data font-semibold ${
            row.original.stock === 0
              ? 'text-destructive'
              : row.original.stock <= row.original.min_stock
                ? 'text-amber-400'
                : ''
          }`}
        >
          {row.original.stock}
        </span>
      ),
    },
    ...(lowStockFilter
      ? [
          {
            accessorKey: 'min_stock' as const,
            header: t('inventory.minStock'),
            cell: ({ getValue }: { getValue: () => unknown }) => (
              <span className="font-data text-muted">{getValue() as number}</span>
            ),
          } as ColumnDef<Product>,
          {
            id: 'deficit',
            header: t('inventory.deficit'),
            accessorFn: (row: Product) =>
              (row as LowStockProduct).deficit ?? row.min_stock - row.stock,
            cell: ({ getValue }: { getValue: () => unknown }) => {
              const deficit = getValue() as number;
              return (
                <span
                  className={`font-data font-semibold ${deficit > 0 ? 'text-destructive' : 'text-amber-400'}`}
                >
                  {deficit > 0 ? `−${deficit}` : `${deficit}`}
                </span>
              );
            },
          } as ColumnDef<Product>,
        ]
      : []),
    {
      accessorKey: 'category',
      header: t('inventory.categoryCol'),
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.category_name || row.original.category || t('inventory.na')}
        </Badge>
      ),
    },
    {
      accessorKey: 'distributor_name',
      header: t('inventory.distributor'),
      cell: ({ getValue }) => (
        <span className="text-muted text-sm">{(getValue() as string) || '-'}</span>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: 'actions',
            header: t('common.actions'),
            enableSorting: false,
            cell: ({ row }: { row: { original: Product } }) => (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditDialog(row.original)}
                >
                  <Pencil className="h-3.5 w-3.5 text-gold" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDeleteId(row.original.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ),
          } as ColumnDef<Product>,
        ]
      : []),
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('inventory.title')}
          </h1>
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
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {!lowStockFilter && (
          <>
            <Label className="text-muted text-xs uppercase tracking-widest">
              {t('inventory.category')}
            </Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('inventory.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('inventory.allCategories')}</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {isAdmin && (
          <button
            onClick={() => toggleLowStock(!lowStockFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              lowStockFilter
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-surface text-muted border border-border hover:border-amber-500/40 hover:text-amber-400'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            {t('inventory.lowStockFilter')}
          </button>
        )}
      </div>

      {/* Low-stock info banner */}
      {lowStockFilter && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t('inventory.showingLowStock')}</span>
          </div>
          <button
            onClick={() => toggleLowStock(false)}
            className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            {t('inventory.viewAll')}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={(lowStockFilter ? lowStockData : productsData) ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('inventory.searchPlaceholder')}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? t('inventory.editProduct') : t('inventory.addProductTitle')}
            </DialogTitle>
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
                <Label>{t('inventory.categoryCol')}</Label>
                <Controller
                  name="category_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('inventory.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {/* SKU & Barcode: read-only display for edit, hidden for create (auto-generated) */}
              {editingProduct ? (
                <div className="space-y-2">
                  <Label>{t('inventory.sku')}</Label>
                  <Input
                    value={editingProduct.sku}
                    readOnly
                    className="bg-muted/20 cursor-default"
                  />
                </div>
              ) : null}
              {editingProduct ? (
                <div className="space-y-2">
                  <Label>{t('inventory.barcode')}</Label>
                  <Input
                    value={editingProduct.barcode || '-'}
                    readOnly
                    className="bg-muted/20 cursor-default"
                  />
                </div>
              ) : null}
              <input type="hidden" {...register('sku')} />
              <input type="hidden" {...register('barcode')} />
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
                <Label>{t('inventory.distributor')}</Label>
                <Controller
                  name="distributor_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : 'none'}
                      onValueChange={(val) => field.onChange(val === 'none' ? null : Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('inventory.selectDistributor')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('inventory.noDistributor')}</SelectItem>
                        {distributors?.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
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
            <AlertDialogDescription>{t('inventory.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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
