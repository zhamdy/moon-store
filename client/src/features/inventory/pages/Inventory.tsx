import { useState, useRef, useMemo, useEffect, type ChangeEvent } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Select,
  SelectItem,
  Checkbox,
} from '@heroui/react';
import { Badge, ConfirmDialog, DataTable, PageHeader } from '../../../shared';
import AdjustStockDialog from '../components/AdjustStockDialog';
import ProductFormDialog from '../components/inventory/ProductFormDialog';
import BulkOperationDialogs from '../components/inventory/BulkOperationDialogs';
import VariantManagerDialog from '../components/inventory/VariantManagerDialog';
import { useVariantManagement } from '../hooks/useVariantManagement';
import { formatCurrency } from '../../../shared/lib/utils';
import { exportToExcel } from '../../../shared/lib/exportUtils';
import { resource } from '../../../shared/lib/resource';
import { useTransport, type TransportMethod } from '../../../shared/lib/transport/index';
import { useAuthStore } from '../../auth';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import type {
  ColumnDef,
  RowSelectionState,
  PaginationState,
  SortingState,
} from '@tanstack/react-table';
import { ApiError, type PaginationMeta } from '../../../shared/lib/transport/types';
import type { Category, Distributor, Product } from '../../../shared/types/index';
import type {
  BulkDiscontinueResult,
  CsvProduct,
  LowStockProduct,
  ProductFormData,
  ProductImportResult,
} from '../types';

const products = resource<Product>('products');
const distributors = resource<Distributor>('distributors');

/** Where the server serves uploaded product images from. */
const assetBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Bulk update, bulk discontinue and CSV import address the whole collection, not
 * one record, so `products.useAction` — which always builds `products/{id}/{action}` —
 * cannot express them. They go through the transport directly instead of the
 * `resource` module growing a second shape of action. That also lets each toast
 * quote the count the server reports back, which a fixed `message` cannot.
 */
function useCollectionAction<Body, Result>(
  action: string,
  method: TransportMethod,
  onDone: (result: Result) => void,
  fallbackMessage: string
) {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Body) =>
      transport.request<Result>({ method, path: `products/${action}`, body }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onDone(data);
    },
    onError: (error: Error) => toast.error(error.message || fallbackMessage),
  });
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

export default function Inventory() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const { t } = useTranslation();
  const navigate = useNavigate({ from: '/inventory' });
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const page = typeof rawSearch.page === 'number' && rawSearch.page > 0 ? rawSearch.page : 1;
  const pageSize = [10, 25, 50, 100].includes(Number(rawSearch.pageSize))
    ? Number(rawSearch.pageSize)
    : 25;
  const searchTerm = typeof rawSearch.search === 'string' ? rawSearch.search : '';
  const sortBy = typeof rawSearch.sortBy === 'string' ? rawSearch.sortBy : 'name';
  const sortOrder = rawSearch.sortOrder === 'desc' ? 'desc' : 'asc';
  const categoryId = typeof rawSearch.categoryId === 'number' ? rawSearch.categoryId : undefined;
  const status = typeof rawSearch.status === 'string' ? rawSearch.status : 'all';
  const lowStockFilter = rawSearch.lowStock === true || rawSearch.lowStock === 'true';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchDraft, setSearchDraft] = useState(searchTerm);

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [discontinueId, setDiscontinueId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);
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

  // The URL is the authoritative list state; the server owns every collection operation.
  const list = products.useList({
    page,
    pageSize,
    search: searchTerm || undefined,
    sortBy,
    sortOrder,
    categoryId,
    status,
    lowStock: lowStockFilter || undefined,
  });
  const { data: categories } = products.useRead<Category[]>('categories');
  const { data: distributorRows } = distributors.useList();

  const currentData: Product[] = list.data ?? [];
  const paginationMeta = (list.meta as { pagination?: PaginationMeta } | undefined)?.pagination;
  const listError = list.error instanceof ApiError ? list.error : null;
  const validationDetails = listError?.details ?? [];

  useEffect(() => setSearchDraft(searchTerm), [searchTerm]);

  useEffect(() => {
    if (searchDraft === searchTerm) return;
    const timer = window.setTimeout(() => {
      navigate({
        replace: true,
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          search: searchDraft.trim() || undefined,
          page: 1,
        }),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, searchDraft, searchTerm]);

  useEffect(() => {
    const lastPage = Math.max(1, paginationMeta?.totalPages ?? 1);
    if (paginationMeta && page > lastPage) {
      navigate({
        replace: true,
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          page: lastPage,
        }),
      });
    }
  }, [navigate, page, paginationMeta]);

  useEffect(
    () => setRowSelection({}),
    [page, pageSize, searchTerm, sortBy, sortOrder, categoryId, status, lowStockFilter]
  );

  // Writes. One save covers create and update: an id in the draft is what makes
  // it an update, so the page does not branch on which mutation to reach for.
  const saver = products.useSave({
    message: editingProduct ? t('inventory.productUpdated') : t('inventory.productCreated'),
    fallbackMessage: editingProduct
      ? t('inventory.failedToUpdateProduct')
      : t('inventory.failedToCreateProduct'),
    onDone: () => {
      setDialogOpen(false);
      setEditingProduct(null);
    },
  });

  const discontinuer = products.useRemove({
    message: t('inventory.productDiscontinued'),
    fallbackMessage: t('bulk.deleteFailed'),
    onDone: () => setDiscontinueId(null),
  });

  const statusChanger = products.useAction('status', {
    method: 'PUT',
    message: t('inventory.statusChanged'),
    fallbackMessage: t('bulk.updateFailed'),
    onDone: () => setReactivateId(null),
  });

  const imageRemover = products.useAction('image', {
    method: 'DELETE',
    message: t('inventory.imageRemoved'),
    fallbackMessage: t('inventory.imageRemoveFailed'),
  });

  const importer = useCollectionAction<{ products: CsvProduct[] }, ProductImportResult>(
    'import',
    'POST',
    ({ imported, errors }) => {
      toast.success(`${imported} ${t('inventory.productsImported')}`);
      if (errors.length > 0) {
        toast.error(`${errors.length} ${t('inventory.rowsHadErrors')}`);
      }
    },
    t('inventory.importFailed')
  );

  const bulkDiscontinuer = useCollectionAction<{ ids: number[] }, BulkDiscontinueResult>(
    'bulk-delete',
    'POST',
    ({ deleted }) => {
      toast.success(t('bulk.discontinueSuccess', { count: String(deleted) }));
      setRowSelection({});
      setBulkDeleteOpen(false);
    },
    t('bulk.deleteFailed')
  );

  const bulkUpdater = useCollectionAction<
    { ids: number[]; updates: Record<string, unknown> },
    unknown
  >(
    'bulk-update',
    'PUT',
    () => {
      toast.success(t('bulk.updateSuccess'));
      setRowSelection({});
      setBulkCategoryOpen(false);
      setBulkDistributorOpen(false);
      setBulkPriceOpen(false);
    },
    t('bulk.updateFailed')
  );

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
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        lowStock: on || undefined,
        status: on ? 'active' : prev.status,
        page: 1,
      }),
    });
  };

  const updateSearch = (changes: Record<string, unknown>, replace = false) =>
    navigate({
      replace,
      search: (previous: Record<string, unknown>) => ({ ...previous, ...changes }),
    });

  const tablePagination: PaginationState = { pageIndex: page - 1, pageSize };
  const tableSorting: SortingState = [{ id: sortBy, desc: sortOrder === 'desc' }];

  const queryClient = useQueryClient();
  const transport = useTransport();

  const handleImageUpload = async (productId: number, file: File) => {
    try {
      const form = new FormData();
      form.append('image', file);
      await transport.request({ method: 'POST', path: `products/${productId}/image`, body: form });
      toast.success(t('inventory.imageUploaded'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch {
      toast.error(t('inventory.imageUploadFailed'));
    }
  };

  const handleRemoveImage = (productId: number) => imageRemover.run({ id: productId });

  const onSubmit = (data: ProductFormData) =>
    saver.save({ id: editingProduct?.id ?? null, ...data });

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
    const exportData = selected.map((p) => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      price: p.price,
      cost_price: p.cost_price,
      stock: p.stock,
      category: p.category || '',
      min_stock: p.min_stock,
    }));
    exportToExcel(
      `products-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      exportData as unknown as Record<string, unknown>[],
      [
        { key: 'name', label: 'Name' },
        { key: 'sku', label: 'SKU' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'price', label: 'Price' },
        { key: 'cost_price', label: 'Cost Price' },
        { key: 'stock', label: 'Stock' },
        { key: 'category', label: 'Category' },
        { key: 'min_stock', label: 'Min Stock' },
      ]
    );
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

      const parsed: CsvProduct[] = lines.slice(1).map((line) => {
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

      importer.mutate({ products: parsed });
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
                isSelected={table.getIsAllPageRowsSelected()}
                isIndeterminate={table.getIsSomePageRowsSelected()}
                onValueChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                size="sm"
                aria-label="Select all"
              />
            ),
            cell: ({ row }: { row: import('@tanstack/react-table').Row<Product> }) => (
              <Checkbox
                isSelected={row.getIsSelected()}
                onValueChange={(value) => row.toggleSelected(!!value)}
                size="sm"
                aria-label="Select row"
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
              src={`${assetBase}${row.original.image_url}`}
              alt={row.original.name}
              className="h-8 w-8 rounded-lg object-cover shrink-0 border border-border"
              loading="lazy"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 border border-border">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <span className="font-medium text-foreground">{row.original.name}</span>
          {row.original.stock === 0 ? (
            <Badge size="sm" variant="danger">
              {t('inventory.critical')}
            </Badge>
          ) : row.original.stock <= row.original.min_stock ? (
            <Badge size="sm" variant="warning">
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
        <span className="font-data text-foreground">{formatCurrency(Number(getValue()))}</span>
      ),
    },
    {
      id: 'margin',
      header: t('inventory.margin'),
      cell: ({ row }) => {
        const price = Number(row.original.price);
        const cost = row.original.cost_price || 0;
        if (price <= 0 || cost <= 0) return <span className="text-muted-foreground">-</span>;
        const margin = ((price - cost) / price) * 100;
        const color = margin >= 50 ? 'text-success' : margin >= 20 ? 'text-warning' : 'text-danger';
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
              ? 'text-danger'
              : row.original.stock <= row.original.min_stock
                ? 'text-warning'
                : 'text-foreground'
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
              <span className="font-data text-muted-foreground">{getValue() as number}</span>
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
                  className={`font-data font-semibold ${deficit > 0 ? 'text-danger' : 'text-warning'}`}
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
        <Badge size="sm" variant="default">
          {row.original.category_name || row.original.category || t('inventory.na')}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: t('inventory.status'),
      cell: ({ row }) => {
        const s = row.original.status || 'active';
        const variant = s === 'active' ? 'success' : s === 'inactive' ? 'warning' : 'default';
        const label =
          s === 'active'
            ? t('inventory.active')
            : s === 'inactive'
              ? t('inventory.inactive')
              : t('inventory.discontinued');
        return (
          <Badge size="sm" variant={variant}>
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
        if (!p.has_variants || p.variant_count === 0)
          return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-1">
            <Badge size="sm" variant="primary">
              <Layers className="h-2.5 w-2.5 inline-block me-0.5" />
              {p.variant_count}
            </Badge>
            <span className="text-xs text-muted-foreground font-data">({p.variant_stock})</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'distributor_name',
      header: t('inventory.distributor'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground text-sm">{(getValue() as string) || '-'}</span>
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
                <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label={t('common.actions')}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Product actions">
                    <DropdownSection showDivider>
                      <DropdownItem
                        key="variants"
                        isDisabled={isDiscontinued}
                        startContent={<Layers className="h-4 w-4 text-purple-400" />}
                        onPress={() => vm.openVariantsDialog(row.original)}
                      >
                        {t('variants.manageVariants')}
                      </DropdownItem>
                      <DropdownItem
                        key="adjust"
                        isDisabled={isDiscontinued}
                        startContent={<PackageMinus className="h-4 w-4 text-blue-400" />}
                        onPress={() => {
                          setAdjustProduct({
                            id: row.original.id,
                            name: row.original.name,
                            stock: row.original.stock,
                          });
                          setAdjustStockOpen(true);
                        }}
                      >
                        {t('inventory.adjustStock')}
                      </DropdownItem>
                      <DropdownItem
                        key="edit"
                        isDisabled={isDiscontinued}
                        startContent={<Pencil className="h-4 w-4 text-primary" />}
                        onPress={() => openEditDialog(row.original)}
                      >
                        {t('common.edit')}
                      </DropdownItem>
                    </DropdownSection>
                    {isDiscontinued ? (
                      <DropdownItem
                        key="reactivate"
                        startContent={<RotateCcw className="h-4 w-4 text-success" />}
                        onPress={() => setReactivateId(row.original.id)}
                      >
                        {t('inventory.reactivateProduct')}
                      </DropdownItem>
                    ) : (
                      <DropdownItem
                        key="discontinue"
                        className="text-danger"
                        color="danger"
                        startContent={<Archive className="h-4 w-4" />}
                        onPress={() => setDiscontinueId(row.original.id)}
                      >
                        {t('inventory.discontinueProduct')}
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </Dropdown>
              );
            },
          } as ColumnDef<Product>,
        ]
      : []),
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('inventory.title')}
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleCSVImport}
                className="hidden"
              />
              <Button
                variant="bordered"
                size="sm"
                startContent={<Upload className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('inventory.importCsv')}
              </Button>
              <Button
                color="primary"
                size="sm"
                startContent={<Plus className="h-4 w-4" />}
                onClick={openCreateDialog}
              >
                {t('inventory.addProduct')}
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {!lowStockFilter && (
          <>
            <Select
              size="sm"
              variant="bordered"
              className="w-48"
              selectedKeys={[categoryId ? String(categoryId) : 'all']}
              onChange={(e) =>
                updateSearch({
                  categoryId: e.target.value === 'all' ? undefined : Number(e.target.value),
                  page: 1,
                })
              }
              aria-label={t('inventory.category')}
              errorMessage={
                validationDetails.find((detail) => detail.field === 'categoryId')?.message
              }
              isInvalid={validationDetails.some((detail) => detail.field === 'categoryId')}
            >
              {[
                <SelectItem key="all" textValue={t('inventory.allCategories')}>
                  {t('inventory.allCategories')}
                </SelectItem>,
                ...(categories ?? []).map((cat) => (
                  <SelectItem key={String(cat.id)} textValue={cat.name}>
                    {cat.name}
                  </SelectItem>
                )),
              ]}
            </Select>

            <Select
              size="sm"
              variant="bordered"
              className="w-44"
              selectedKeys={[status]}
              onChange={(e) => updateSearch({ status: e.target.value || 'all', page: 1 })}
              aria-label={t('inventory.statusFilter')}
              errorMessage={validationDetails.find((detail) => detail.field === 'status')?.message}
              isInvalid={validationDetails.some((detail) => detail.field === 'status')}
            >
              <SelectItem key="all" textValue={t('inventory.allStatuses')}>
                {t('inventory.allStatuses')}
              </SelectItem>
              <SelectItem key="active" textValue={t('inventory.active')}>
                {t('inventory.active')}
              </SelectItem>
              <SelectItem key="inactive" textValue={t('inventory.inactive')}>
                {t('inventory.inactive')}
              </SelectItem>
              <SelectItem key="discontinued" textValue={t('inventory.discontinued')}>
                {t('inventory.discontinued')}
              </SelectItem>
            </Select>
          </>
        )}
        {isAdmin && (
          <Button
            size="sm"
            variant={lowStockFilter ? 'solid' : 'bordered'}
            color={lowStockFilter ? 'warning' : 'default'}
            startContent={<AlertTriangle className="h-3.5 w-3.5" />}
            onClick={() => toggleLowStock(!lowStockFilter)}
          >
            {t('inventory.lowStockFilter')}
          </Button>
        )}
      </div>

      {/* Low-stock info banner */}
      {lowStockFilter && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 text-sm text-warning font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t('inventory.showingLowStock')}</span>
          </div>
          <Button
            size="sm"
            variant="light"
            endContent={<X className="h-3.5 w-3.5" />}
            onClick={() => toggleLowStock(false)}
          >
            {t('inventory.viewAll')}
          </Button>
        </div>
      )}

      {listError?.status === 403 ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-sm text-danger"
        >
          <h2 className="font-semibold">Permission required</h2>
          <p className="mt-1">{listError.message}</p>
        </div>
      ) : (
        <DataTable
          mode="server"
          columns={columns}
          data={currentData}
          isLoading={list.isLoading && currentData.length === 0}
          isFetching={list.isFetching && !list.isLoading}
          error={listError ? listError.message || t('common.error') : undefined}
          onRetry={listError && listError.status !== 403 ? () => list.refetch() : undefined}
          searchPlaceholder={t('inventory.searchPlaceholder')}
          searchError={validationDetails.find((detail) => detail.field === 'search')?.message}
          isFiltered={!!(searchTerm || categoryId || status !== 'all' || lowStockFilter)}
          search={searchDraft}
          onSearchChange={setSearchDraft}
          pagination={tablePagination}
          pageCount={paginationMeta?.totalPages ?? 0}
          totalRows={paginationMeta?.totalItems ?? currentData.length}
          onPaginationChange={(updater) => {
            const next = typeof updater === 'function' ? updater(tablePagination) : updater;
            updateSearch({
              page: next.pageIndex + 1,
              pageSize: next.pageSize,
              ...(next.pageSize !== pageSize ? { page: 1 } : {}),
            });
          }}
          sorting={tableSorting}
          onSortingChange={(updater) => {
            const next = typeof updater === 'function' ? updater(tableSorting) : updater;
            const requested = next[0];
            const allowed = new Set(['name', 'price', 'stock', 'category']);
            if (requested && allowed.has(requested.id))
              updateSearch({
                sortBy: requested.id,
                sortOrder: requested.desc ? 'desc' : 'asc',
                page: 1,
              });
          }}
          emptyTitle="No products yet"
          emptyDescription="Add a product to start building inventory."
          filteredEmptyTitle="No matching products"
          filteredEmptyDescription="Try changing the search or filters."
          enableRowSelection={isAdmin}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={(row: Product) => String(row.id)}
          bulkActions={(_selected, clearSelection) => (
            <>
              <Button variant="bordered" size="sm" onClick={() => setBulkCategoryOpen(true)}>
                {t('bulk.changeCategory')}
              </Button>
              <Button variant="bordered" size="sm" onClick={() => setBulkDistributorOpen(true)}>
                {t('bulk.changeDistributor')}
              </Button>
              <Button
                variant="bordered"
                size="sm"
                startContent={<Percent className="h-3.5 w-3.5" />}
                onClick={() => setBulkPriceOpen(true)}
              >
                {t('bulk.adjustPrice')}
              </Button>
              <Button variant="bordered" size="sm" onClick={() => setBulkStatusOpen(true)}>
                {t('bulk.changeStatus')}
              </Button>
              <Button
                variant="bordered"
                size="sm"
                startContent={<Download className="h-3.5 w-3.5" />}
                onClick={handleBulkExport}
              >
                {t('bulk.export')}
              </Button>
              <Button
                variant="flat"
                color="danger"
                size="sm"
                startContent={<Archive className="h-3.5 w-3.5" />}
                onClick={() => setBulkDeleteOpen(true)}
              >
                {t('bulk.discontinueSelected')}
              </Button>
              <Button variant="light" size="sm" onClick={clearSelection}>
                {t('bulk.clearSelection')}
              </Button>
            </>
          )}
        />
      )}

      {/* Product Add/Edit Dialog */}
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingProduct={editingProduct}
        categories={categories}
        distributors={distributorRows}
        onSubmit={onSubmit}
        isSubmitting={saver.isSaving}
        getProductSchema={getProductSchema}
        onImageUpload={handleImageUpload}
        onImageRemove={handleRemoveImage}
      />

      {/* Discontinue confirmation */}
      <ConfirmDialog
        open={!!discontinueId}
        onOpenChange={(open) => {
          if (!open) setDiscontinueId(null);
        }}
        title={t('inventory.discontinueProduct')}
        description={t('inventory.discontinueConfirm')}
        confirmText={t('common.confirm')}
        confirmColor="danger"
        isLoading={discontinuer.isRemoving}
        onConfirm={() => {
          if (discontinueId) discontinuer.remove(discontinueId);
        }}
      />

      {/* Reactivate confirmation */}
      <ConfirmDialog
        open={!!reactivateId}
        onOpenChange={(open) => {
          if (!open) setReactivateId(null);
        }}
        title={t('inventory.reactivateProduct')}
        description={t('inventory.reactivateConfirm')}
        confirmText={t('common.confirm')}
        confirmColor="primary"
        isLoading={statusChanger.isRunning}
        onConfirm={() => {
          if (reactivateId) statusChanger.run({ id: reactivateId, body: { status: 'active' } });
        }}
      />

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
        distributors={distributorRows}
        bulkDeleteOpen={bulkDeleteOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        onBulkDelete={(ids) => bulkDiscontinuer.mutate({ ids })}
        bulkCategoryOpen={bulkCategoryOpen}
        setBulkCategoryOpen={setBulkCategoryOpen}
        bulkCategory={bulkCategory}
        setBulkCategory={setBulkCategory}
        onBulkCategoryUpdate={(ids, categoryId) =>
          bulkUpdater.mutate({ ids, updates: { category_id: categoryId } })
        }
        bulkUpdatePending={bulkUpdater.isPending}
        bulkDistributorOpen={bulkDistributorOpen}
        setBulkDistributorOpen={setBulkDistributorOpen}
        bulkDistributor={bulkDistributor}
        setBulkDistributor={setBulkDistributor}
        onBulkDistributorUpdate={(ids, distributorId) =>
          bulkUpdater.mutate({ ids, updates: { distributor_id: distributorId } })
        }
        bulkPriceOpen={bulkPriceOpen}
        setBulkPriceOpen={setBulkPriceOpen}
        bulkPricePercent={bulkPricePercent}
        setBulkPricePercent={setBulkPricePercent}
        onBulkPriceUpdate={(ids, pricePercent) =>
          bulkUpdater.mutate({ ids, updates: { price_percent: pricePercent } })
        }
        bulkStatusOpen={bulkStatusOpen}
        setBulkStatusOpen={setBulkStatusOpen}
        bulkStatusValue={bulkStatusValue}
        setBulkStatusValue={setBulkStatusValue}
        onBulkStatusUpdate={(ids, status) => bulkUpdater.mutate({ ids, updates: { status } })}
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
        onDeleteVariant={vm.deleteVariant}
        createVariantPending={vm.createVariantPending}
        updateVariantPending={vm.updateVariantPending}
      />
    </div>
  );
}
