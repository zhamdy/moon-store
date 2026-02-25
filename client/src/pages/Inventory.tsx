import { useState, useRef, useMemo, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus,
  Upload,
  AlertTriangle,
  X,
  PackageMinus,
  Package,
  Download,
  Percent,
  Layers,
  Archive,
  RotateCcw,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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
import ProductFormDialog, { type ProductFormData } from '../components/inventory/ProductFormDialog';
import BulkOperationDialogs from '../components/inventory/BulkOperationDialogs';
import VariantManagerDialog from '../components/inventory/VariantManagerDialog';
import { useInventoryData, type CsvProduct, type LowStockProduct } from '../hooks/useInventoryData';
import { useVariantManagement } from '../hooks/useVariantManagement';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation, t as tStandalone } from '../i18n';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import type { Product } from '@/types';

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

export default function Inventory() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [discontinueId, setDiscontinueId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('lowStock') === 'true');
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<{
    id: number;
    name: string;
    stock: number;
  } | null>(null);

  // Bulk state
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

  // Data & mutations
  const {
    currentData,
    isLoading,
    categories,
    distributors,
    createMutation,
    updateMutation,
    discontinueMutation,
    statusMutation,
    importMutation,
    bulkDeleteMutation,
    bulkUpdateMutation,
    queryClient,
  } = useInventoryData({
    categoryFilter,
    statusFilter,
    lowStockFilter,
    onCreateSuccess: () => setDialogOpen(false),
    onUpdateSuccess: () => {
      setDialogOpen(false);
      setEditingProduct(null);
    },
    onBulkDeleteSuccess: () => {
      setRowSelection({});
      setBulkDeleteOpen(false);
    },
    onBulkUpdateSuccess: () => {
      setRowSelection({});
      setBulkCategoryOpen(false);
      setBulkDistributorOpen(false);
      setBulkPriceOpen(false);
    },
    onDiscontinueSuccess: () => setDiscontinueId(null),
    onReactivateSuccess: () => setReactivateId(null),
  });

  // Variant management
  const vm = useVariantManagement();

  // Derived state
  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((k) => rowSelection[k])
        .map((id) => Number(id)),
    [rowSelection]
  );
  const selectedCount = selectedIds.length;

  const toggleLowStock = (on: boolean) => {
    setLowStockFilter(on);
    if (on) {
      setSearchParams({ lowStock: 'true' });
    } else {
      setSearchParams({});
    }
  };

  // Handlers
  const handleImageUpload = async (productId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      await api.post(`/api/v1/products/${productId}/image`, formData, {
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
      await api.delete(`/api/v1/products/${productId}/image`);
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
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setDialogOpen(true);
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

  // Column definitions
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={isDiscontinued}
                      onClick={() => vm.openVariantsDialog(row.original)}
                    >
                      <Layers className="h-4 w-4 me-2 text-purple-400" />
                      {t('variants.manageVariants')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
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
                      <PackageMinus className="h-4 w-4 me-2 text-blue-400" />
                      {t('inventory.adjustStock')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isDiscontinued}
                      onClick={() => openEditDialog(row.original)}
                    >
                      <Pencil className="h-4 w-4 me-2 text-gold" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isDiscontinued ? (
                      <DropdownMenuItem onClick={() => setReactivateId(row.original.id)}>
                        <RotateCcw className="h-4 w-4 me-2 text-emerald-400" />
                        {t('inventory.reactivateProduct')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDiscontinueId(row.original.id)}
                      >
                        <Archive className="h-4 w-4 me-2" />
                        {t('inventory.discontinueProduct')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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

      {/* Product Add/Edit Dialog */}
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingProduct={editingProduct}
        categories={categories}
        distributors={distributors}
        onSubmit={onSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        getProductSchema={getProductSchema}
        onImageUpload={handleImageUpload}
        onImageRemove={handleRemoveImage}
      />

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

      {/* Bulk Operation Dialogs */}
      <BulkOperationDialogs
        selectedCount={selectedCount}
        selectedIds={selectedIds}
        categories={categories}
        distributors={distributors}
        bulkDeleteOpen={bulkDeleteOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        onBulkDelete={(ids) => bulkDeleteMutation.mutate(ids)}
        bulkCategoryOpen={bulkCategoryOpen}
        setBulkCategoryOpen={setBulkCategoryOpen}
        bulkCategory={bulkCategory}
        setBulkCategory={setBulkCategory}
        onBulkCategoryUpdate={(ids, categoryId) =>
          bulkUpdateMutation.mutate({ ids, updates: { category_id: categoryId } })
        }
        bulkUpdatePending={bulkUpdateMutation.isPending}
        bulkDistributorOpen={bulkDistributorOpen}
        setBulkDistributorOpen={setBulkDistributorOpen}
        bulkDistributor={bulkDistributor}
        setBulkDistributor={setBulkDistributor}
        onBulkDistributorUpdate={(ids, distributorId) =>
          bulkUpdateMutation.mutate({ ids, updates: { distributor_id: distributorId } })
        }
        bulkPriceOpen={bulkPriceOpen}
        setBulkPriceOpen={setBulkPriceOpen}
        bulkPricePercent={bulkPricePercent}
        setBulkPricePercent={setBulkPricePercent}
        onBulkPriceUpdate={(ids, pricePercent) =>
          bulkUpdateMutation.mutate({ ids, updates: { price_percent: pricePercent } })
        }
        bulkStatusOpen={bulkStatusOpen}
        setBulkStatusOpen={setBulkStatusOpen}
        bulkStatusValue={bulkStatusValue}
        setBulkStatusValue={setBulkStatusValue}
        onBulkStatusUpdate={(ids, status) =>
          bulkUpdateMutation.mutate({ ids, updates: { status } })
        }
      />

      {/* Variant Manager Dialog */}
      <VariantManagerDialog
        variantsDialogOpen={vm.variantsDialogOpen}
        onDialogOpenChange={(open) => {
          if (!open) vm.closeVariantsDialog();
          else vm.setVariantsDialogOpen(open);
        }}
        variantsProduct={vm.variantsProduct}
        variants={vm.variants}
        variantsLoading={vm.variantsLoading}
        variantFormOpen={vm.variantFormOpen}
        setVariantFormOpen={vm.setVariantFormOpen}
        editingVariant={vm.editingVariant}
        variantDeleteId={vm.variantDeleteId}
        setVariantDeleteId={vm.setVariantDeleteId}
        variantAttrs={vm.variantAttrs}
        setVariantAttrs={vm.setVariantAttrs}
        variantSku={vm.variantSku}
        setVariantSku={vm.setVariantSku}
        variantBarcode={vm.variantBarcode}
        setVariantBarcode={vm.setVariantBarcode}
        variantPrice={vm.variantPrice}
        setVariantPrice={vm.setVariantPrice}
        variantCostPrice={vm.variantCostPrice}
        setVariantCostPrice={vm.setVariantCostPrice}
        variantStock={vm.variantStock}
        setVariantStock={vm.setVariantStock}
        onOpenEditVariant={vm.openEditVariant}
        onVariantSubmit={vm.handleVariantSubmit}
        onResetVariantForm={vm.resetVariantForm}
        onDeleteVariant={(data) => vm.deleteVariantMutation.mutate(data)}
        createVariantPending={vm.createVariantMutation.isPending}
        updateVariantPending={vm.updateVariantMutation.isPending}
      />
    </div>
  );
}
