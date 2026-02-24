import { useState, useRef, useEffect, useMemo, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  PackageMinus,
  ImagePlus,
  Package,
  Download,
  Percent,
  Layers,
  Archive,
  RotateCcw,
} from 'lucide-react';
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
import { Checkbox } from '../components/ui/checkbox';
import DataTable from '../components/DataTable';
import AdjustStockDialog from '../components/AdjustStockDialog';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation, t as tStandalone } from '../i18n';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
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
  cost_price: number;
  stock: number;
  category: string;
  category_id: number | null;
  category_name: string | null;
  category_code: string | null;
  distributor_id: number | null;
  distributor_name: string | null;
  min_stock: number;
  image_url: string | null;
  has_variants: number;
  variant_count: number;
  variant_stock: number;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at: string;
}

interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  barcode: string | null;
  price: number | null;
  cost_price: number;
  stock: number;
  attributes: Record<string, string>;
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
    cost_price: z.coerce.number().min(0).default(0),
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
  cost_price: number;
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
  const [discontinueId, setDiscontinueId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('lowStock') === 'true');
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<{
    id: number;
    name: string;
    stock: number;
  } | null>(null);

  // Bulk operations state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkDistributorOpen, setBulkDistributorOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkDistributor, setBulkDistributor] = useState('');
  const [bulkPricePercent, setBulkPricePercent] = useState('');
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');

  // Variant management state
  const [variantsDialogOpen, setVariantsDialogOpen] = useState(false);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantDeleteId, setVariantDeleteId] = useState<number | null>(null);
  const [variantAttrs, setVariantAttrs] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  const [variantSku, setVariantSku] = useState('');
  const [variantBarcode, setVariantBarcode] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantCostPrice, setVariantCostPrice] = useState('');
  const [variantStock, setVariantStock] = useState('0');

  const { data: productsData, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: [
      'products',
      { category_id: categoryFilter === 'all' ? undefined : categoryFilter, status: statusFilter },
    ],
    queryFn: () =>
      api
        .get('/api/products', {
          params: {
            limit: 200,
            category_id: categoryFilter === 'all' ? undefined : categoryFilter,
            status: statusFilter,
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
  const currentData = (lowStockFilter ? lowStockData : productsData) ?? [];
  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((id) => Number(id));
  }, [rowSelection]);
  const selectedCount = selectedIds.length;

  const toggleLowStock = (on: boolean) => {
    setLowStockFilter(on);
    if (on) {
      setSearchParams({ lowStock: 'true' });
    } else {
      setSearchParams({});
    }
  };

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

  const discontinueMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      toast.success(t('inventory.productDiscontinued'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      setDiscontinueId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.deleteFailed')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/products/${id}/status`, { status }),
    onSuccess: () => {
      toast.success(t('inventory.statusChanged'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      setReactivateId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.updateFailed')),
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post('/api/products/bulk-delete', { ids }),
    onSuccess: (res: AxiosResponse<{ data: { deleted: number } }>) => {
      toast.success(t('bulk.discontinueSuccess', { count: String(res.data.data.deleted) }));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      setRowSelection({});
      setBulkDeleteOpen(false);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.deleteFailed')),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { ids: number[]; updates: Record<string, unknown> }) =>
      api.put('/api/products/bulk-update', data),
    onSuccess: () => {
      toast.success(t('bulk.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      setRowSelection({});
      setBulkCategoryOpen(false);
      setBulkDistributorOpen(false);
      setBulkPriceOpen(false);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.updateFailed')),
  });

  // Variant queries & mutations
  const { data: variants, isLoading: variantsLoading } = useQuery<ProductVariant[]>({
    queryKey: ['product-variants', variantsProduct?.id],
    queryFn: () =>
      api.get(`/api/products/${variantsProduct!.id}/variants`).then((r) => r.data.data),
    enabled: !!variantsProduct && variantsDialogOpen,
  });

  const createVariantMutation = useMutation({
    mutationFn: (data: { productId: number; variant: Record<string, unknown> }) =>
      api.post(`/api/products/${data.productId}/variants`, data.variant),
    onSuccess: () => {
      toast.success(t('variants.created'));
      queryClient.invalidateQueries({ queryKey: ['product-variants', variantsProduct?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetVariantForm();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('variants.createFailed')),
  });

  const updateVariantMutation = useMutation({
    mutationFn: (data: {
      productId: number;
      variantId: number;
      variant: Record<string, unknown>;
    }) => api.put(`/api/products/${data.productId}/variants/${data.variantId}`, data.variant),
    onSuccess: () => {
      toast.success(t('variants.updated'));
      queryClient.invalidateQueries({ queryKey: ['product-variants', variantsProduct?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetVariantForm();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('variants.updateFailed')),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (data: { productId: number; variantId: number }) =>
      api.delete(`/api/products/${data.productId}/variants/${data.variantId}`),
    onSuccess: () => {
      toast.success(t('variants.deleted'));
      queryClient.invalidateQueries({ queryKey: ['product-variants', variantsProduct?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setVariantDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('variants.deleteFailed')),
  });

  const resetVariantForm = () => {
    setVariantFormOpen(false);
    setEditingVariant(null);
    setVariantAttrs([{ key: '', value: '' }]);
    setVariantSku('');
    setVariantBarcode('');
    setVariantPrice('');
    setVariantCostPrice('');
    setVariantStock('0');
  };

  const openEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantSku(variant.sku);
    setVariantBarcode(variant.barcode || '');
    setVariantPrice(variant.price != null ? String(variant.price) : '');
    setVariantCostPrice(variant.cost_price ? String(variant.cost_price) : '');
    setVariantStock(String(variant.stock));
    setVariantAttrs(Object.entries(variant.attributes).map(([key, value]) => ({ key, value })));
    setVariantFormOpen(true);
  };

  const handleVariantSubmit = () => {
    const attributes: Record<string, string> = {};
    for (const attr of variantAttrs) {
      if (attr.key.trim() && attr.value.trim()) {
        attributes[attr.key.trim()] = attr.value.trim();
      }
    }
    if (Object.keys(attributes).length === 0) {
      toast.error(t('variants.attributes') + ' required');
      return;
    }
    const payload = {
      sku: variantSku,
      barcode: variantBarcode || null,
      price: variantPrice ? Number(variantPrice) : null,
      cost_price: variantCostPrice ? Number(variantCostPrice) : 0,
      stock: Number(variantStock) || 0,
      attributes,
    };
    if (editingVariant && variantsProduct) {
      updateVariantMutation.mutate({
        productId: variantsProduct.id,
        variantId: editingVariant.id,
        variant: payload,
      });
    } else if (variantsProduct) {
      createVariantMutation.mutate({ productId: variantsProduct.id, variant: payload });
    }
  };

  const handleBulkExport = () => {
    const selected = currentData.filter((p) => selectedIds.includes(p.id));
    const headers = [
      'name',
      'sku',
      'barcode',
      'price',
      'cost_price',
      'stock',
      'category',
      'min_stock',
    ];
    const csvRows = [
      headers.join(','),
      ...selected.map((p) =>
        [
          p.name,
          p.sku,
          p.barcode || '',
          p.price,
          p.cost_price,
          p.stock,
          p.category || '',
          p.min_stock,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('bulk.exportSuccess', { count: String(selected.length) }));
  };

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (productId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      await api.post(`/api/products/${productId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('inventory.imageUploaded'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch {
      toast.error(t('inventory.imageUploadFailed'));
    }
  };

  const handleRemoveImage = async (productId: number) => {
    try {
      await api.delete(`/api/products/${productId}/image`);
      toast.success(t('inventory.imageRemoved'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch {
      toast.error(t('inventory.imageRemoveFailed'));
    }
  };

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
      cost_price: product.cost_price || 0,
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
      cost_price: 0,
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
          cost_price: parseFloat(obj.cost_price) || 0,
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
    ...(isAdmin
      ? [
          {
            id: 'select',
            header: ({ table }: { table: import('@tanstack/react-table').Table<Product> }) => (
              <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              />
            ),
            cell: ({ row }: { row: import('@tanstack/react-table').Row<Product> }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
              />
            ),
            enableSorting: false,
          } as ColumnDef<Product>,
        ]
      : []),
    {
      accessorKey: 'name',
      header: t('inventory.productName'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.image_url ? (
            <img
              src={`${api.defaults.baseURL}${row.original.image_url}`}
              alt={row.original.name}
              className="h-8 w-8 rounded object-cover shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-muted/30 flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-muted" />
            </div>
          )}
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
      id: 'margin',
      header: t('inventory.margin'),
      cell: ({ row }) => {
        const price = Number(row.original.price);
        const cost = row.original.cost_price || 0;
        if (price <= 0 || cost <= 0) return <span className="text-muted">-</span>;
        const margin = ((price - cost) / price) * 100;
        const color =
          margin >= 50 ? 'text-emerald-500' : margin >= 20 ? 'text-amber-400' : 'text-destructive';
        return <span className={`font-data font-semibold ${color}`}>{margin.toFixed(0)}%</span>;
      },
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
      accessorKey: 'status',
      header: t('inventory.status'),
      cell: ({ row }) => {
        const s = row.original.status || 'active';
        const variant = s === 'active' ? 'success' : s === 'inactive' ? 'warning' : 'secondary';
        const label =
          s === 'active'
            ? t('inventory.active')
            : s === 'inactive'
              ? t('inventory.inactive')
              : t('inventory.discontinued');
        return (
          <Badge variant={variant} className="text-[10px]">
            {label}
          </Badge>
        );
      },
    },
    {
      id: 'variants',
      header: t('variants.title'),
      cell: ({ row }) => {
        const p = row.original;
        if (!p.has_variants || p.variant_count === 0) return <span className="text-muted">-</span>;
        return (
          <div className="flex items-center gap-1">
            <Badge variant="gold" className="text-[10px] gap-0.5">
              <Layers className="h-2.5 w-2.5" />
              {p.variant_count}
            </Badge>
            <span className="text-xs text-muted font-data">({p.variant_stock})</span>
          </div>
        );
      },
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
            cell: ({ row }: { row: { original: Product } }) => {
              const isDiscontinued = row.original.status === 'discontinued';
              return (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t('variants.manageVariants')}
                    disabled={isDiscontinued}
                    onClick={() => {
                      setVariantsProduct(row.original);
                      setVariantsDialogOpen(true);
                    }}
                  >
                    <Layers
                      className={`h-3.5 w-3.5 ${isDiscontinued ? 'text-muted' : 'text-purple-400'}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t('inventory.adjustStock')}
                    disabled={isDiscontinued}
                    onClick={() => {
                      setAdjustProduct({
                        id: row.original.id,
                        name: row.original.name,
                        stock: row.original.stock,
                      });
                      setAdjustStockOpen(true);
                    }}
                  >
                    <PackageMinus
                      className={`h-3.5 w-3.5 ${isDiscontinued ? 'text-muted' : 'text-blue-400'}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isDiscontinued}
                    onClick={() => openEditDialog(row.original)}
                  >
                    <Pencil
                      className={`h-3.5 w-3.5 ${isDiscontinued ? 'text-muted' : 'text-gold'}`}
                    />
                  </Button>
                  {isDiscontinued ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t('inventory.reactivateProduct')}
                      onClick={() => setReactivateId(row.original.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t('inventory.discontinueProduct')}
                      onClick={() => setDiscontinueId(row.original.id)}
                    >
                      <Archive className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            },
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
            <Label className="text-muted text-xs uppercase tracking-widest ms-2">
              {t('inventory.statusFilter')}
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t('inventory.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('inventory.allStatuses')}</SelectItem>
                <SelectItem value="active">{t('inventory.active')}</SelectItem>
                <SelectItem value="inactive">{t('inventory.inactive')}</SelectItem>
                <SelectItem value="discontinued">{t('inventory.discontinued')}</SelectItem>
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

      {/* Bulk action toolbar */}
      {isAdmin && selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-gold/30 bg-gold/5">
          <span className="text-sm font-medium text-gold">
            {t('bulk.selected', { count: String(selectedCount) })}
          </span>
          <div className="flex items-center gap-2 ms-auto">
            <Button variant="outline" size="sm" onClick={() => setBulkCategoryOpen(true)}>
              {t('bulk.changeCategory')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkDistributorOpen(true)}>
              {t('bulk.changeDistributor')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkPriceOpen(true)}>
              <Percent className="h-3.5 w-3.5 me-1" />
              {t('bulk.adjustPrice')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkStatusOpen(true)}>
              {t('bulk.changeStatus')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-3.5 w-3.5 me-1" />
              {t('bulk.export')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Archive className="h-3.5 w-3.5 me-1" />
              {t('bulk.discontinueSelected')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
              {t('bulk.clearSelection')}
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={currentData}
        isLoading={isLoading}
        searchPlaceholder={t('inventory.searchPlaceholder')}
        enableRowSelection={isAdmin}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row: Product) => String(row.id)}
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
                <Label>{t('inventory.costPrice')}</Label>
                <Input type="number" step="0.01" {...register('cost_price')} />
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

            {/* Image upload (only for existing products) */}
            {editingProduct && (
              <div className="space-y-2 border-t border-border pt-4">
                <Label>{t('inventory.productImage')}</Label>
                <div className="flex items-center gap-3">
                  {editingProduct.image_url ? (
                    <img
                      src={`${api.defaults.baseURL}${editingProduct.image_url}`}
                      alt={editingProduct.name}
                      className="h-16 w-16 rounded object-cover border border-border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted/30 flex items-center justify-center border border-dashed border-border">
                      <ImagePlus className="h-6 w-6 text-muted" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      ref={imageInputRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && editingProduct) {
                          handleImageUpload(editingProduct.id, file);
                        }
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5 me-1" />
                      {t('inventory.uploadImage')}
                    </Button>
                    {editingProduct.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRemoveImage(editingProduct.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 me-1" />
                        {t('inventory.removeImage')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProduct ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discontinue confirmation */}
      <AlertDialog open={!!discontinueId} onOpenChange={() => setDiscontinueId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.discontinueProduct')}</AlertDialogTitle>
            <AlertDialogDescription>{t('inventory.discontinueConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => discontinueId && discontinueMutation.mutate(discontinueId)}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate confirmation */}
      <AlertDialog open={!!reactivateId} onOpenChange={() => setReactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.reactivateProduct')}</AlertDialogTitle>
            <AlertDialogDescription>{t('inventory.reactivateConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reactivateId && statusMutation.mutate({ id: reactivateId, status: 'active' })
              }
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust Stock Dialog */}
      <AdjustStockDialog
        open={adjustStockOpen}
        onOpenChange={setAdjustStockOpen}
        productId={adjustProduct?.id ?? null}
        productName={adjustProduct?.name ?? ''}
        currentStock={adjustProduct?.stock ?? 0}
      />

      {/* Bulk Discontinue Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.discontinueProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulk.discontinueConfirm', { count: String(selectedCount) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Change Category */}
      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.changeCategoryTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.changeCategoryDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
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
          <DialogFooter>
            <Button
              disabled={!bulkCategory || bulkUpdateMutation.isPending}
              onClick={() =>
                bulkUpdateMutation.mutate({
                  ids: selectedIds,
                  updates: { category_id: Number(bulkCategory) },
                })
              }
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Distributor */}
      <Dialog open={bulkDistributorOpen} onOpenChange={setBulkDistributorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.changeDistributorTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.changeDistributorDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkDistributor} onValueChange={setBulkDistributor}>
            <SelectTrigger>
              <SelectValue placeholder={t('inventory.selectDistributor')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">{t('inventory.noDistributor')}</SelectItem>
              {distributors?.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!bulkDistributor || bulkUpdateMutation.isPending}
              onClick={() =>
                bulkUpdateMutation.mutate({
                  ids: selectedIds,
                  updates: {
                    distributor_id: bulkDistributor === 'null' ? null : Number(bulkDistributor),
                  },
                })
              }
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Price Adjust */}
      <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.adjustPriceTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.adjustPriceDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('bulk.pricePercent')}</Label>
            <Input
              type="number"
              step="0.1"
              value={bulkPricePercent}
              onChange={(e) => setBulkPricePercent(e.target.value)}
              placeholder="+10 or -15"
            />
            <p className="text-xs text-muted">{t('bulk.pricePercentHint')}</p>
          </div>
          <DialogFooter>
            <Button
              disabled={!bulkPricePercent || bulkUpdateMutation.isPending}
              onClick={() =>
                bulkUpdateMutation.mutate({
                  ids: selectedIds,
                  updates: { price_percent: Number(bulkPricePercent) },
                })
              }
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Status */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.changeStatusTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.changeStatusDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
            <SelectTrigger>
              <SelectValue placeholder={t('inventory.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('inventory.active')}</SelectItem>
              <SelectItem value="inactive">{t('inventory.inactive')}</SelectItem>
              <SelectItem value="discontinued">{t('inventory.discontinued')}</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!bulkStatusValue || bulkUpdateMutation.isPending}
              onClick={() => {
                bulkUpdateMutation.mutate({
                  ids: selectedIds,
                  updates: { status: bulkStatusValue },
                });
                setBulkStatusOpen(false);
              }}
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Variants Dialog */}
      <Dialog
        open={variantsDialogOpen}
        onOpenChange={(open) => {
          setVariantsDialogOpen(open);
          if (!open) {
            setVariantsProduct(null);
            resetVariantForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {variantsProduct?.name} — {t('variants.manageVariants')}
            </DialogTitle>
            <DialogDescription>
              {t('variants.variantCount', { count: String(variants?.length || 0) })}
              {variants && variants.length > 0 && (
                <>
                  {' '}
                  · {t('variants.totalStock')}: {variants.reduce((s, v) => s + v.stock, 0)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Variant list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {variantsLoading ? (
              <p className="text-sm text-muted text-center py-4">{t('common.loading')}...</p>
            ) : variants && variants.length > 0 ? (
              variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Object.entries(variant.attributes).map(([key, value]) => (
                        <Badge key={key} variant="gold" className="text-[10px]">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted font-data">
                      SKU: {variant.sku}
                      {variant.barcode && <> · {variant.barcode}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-end me-2">
                      <p className="text-sm font-semibold text-gold font-data">
                        {formatCurrency(Number(variant.price || variantsProduct?.price || 0))}
                      </p>
                      <Badge
                        variant={variant.stock === 0 ? 'destructive' : 'success'}
                        className="text-[10px]"
                      >
                        {variant.stock}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditVariant(variant)}
                    >
                      <Pencil className="h-3 w-3 text-gold" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setVariantDeleteId(variant.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted text-center py-4">
                {t('variants.title')} — {t('common.noResults')}
              </p>
            )}
          </div>

          {/* Add/Edit variant form */}
          {variantFormOpen ? (
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-semibold">
                {editingVariant ? t('variants.editVariant') : t('variants.addVariant')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.sku')}</Label>
                  <Input
                    value={variantSku}
                    onChange={(e) => setVariantSku(e.target.value)}
                    placeholder="SKU"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.barcode')}</Label>
                  <Input
                    value={variantBarcode}
                    onChange={(e) => setVariantBarcode(e.target.value)}
                    placeholder={t('variants.barcode')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.price')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantPrice}
                    onChange={(e) => setVariantPrice(e.target.value)}
                    placeholder={t('variants.price')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.costPrice')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantCostPrice}
                    onChange={(e) => setVariantCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.stock')}</Label>
                  <Input
                    type="number"
                    value={variantStock}
                    onChange={(e) => setVariantStock(e.target.value)}
                  />
                </div>
              </div>
              {/* Attributes */}
              <div className="space-y-2">
                <Label className="text-xs">{t('variants.attributes')}</Label>
                {variantAttrs.map((attr, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={t('variants.attributeName')}
                      value={attr.key}
                      onChange={(e) => {
                        const updated = [...variantAttrs];
                        updated[i] = { ...updated[i], key: e.target.value };
                        setVariantAttrs(updated);
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder={t('variants.attributeValue')}
                      value={attr.value}
                      onChange={(e) => {
                        const updated = [...variantAttrs];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setVariantAttrs(updated);
                      }}
                      className="flex-1"
                    />
                    {variantAttrs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setVariantAttrs(variantAttrs.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantAttrs([...variantAttrs, { key: '', value: '' }])}
                >
                  <Plus className="h-3 w-3 me-1" />
                  {t('variants.addAttribute')}
                </Button>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={resetVariantForm}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleVariantSubmit}
                  disabled={createVariantMutation.isPending || updateVariantMutation.isPending}
                >
                  {editingVariant ? t('common.update') : t('common.create')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setVariantFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t('variants.addVariant')}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Variant Confirmation */}
      <AlertDialog open={!!variantDeleteId} onOpenChange={() => setVariantDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('variants.deleteVariant')}</AlertDialogTitle>
            <AlertDialogDescription>{t('variants.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (variantDeleteId && variantsProduct) {
                  deleteVariantMutation.mutate({
                    productId: variantsProduct.id,
                    variantId: variantDeleteId,
                  });
                }
              }}
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
