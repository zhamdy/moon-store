import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { AxiosError, AxiosResponse } from 'axios';
import type { ApiErrorResponse, Product, Category, Distributor } from '@/types';

export interface ImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

export interface CsvProduct {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price: number;
  stock: number;
  category: string;
  min_stock: number;
}

export interface LowStockProduct extends Product {
  deficit: number;
}

export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost_price: number;
  stock: number;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
}

interface UseInventoryDataOptions {
  categoryFilter: string;
  statusFilter: string;
  lowStockFilter: boolean;
  onCreateSuccess: () => void;
  onUpdateSuccess: () => void;
  onBulkDeleteSuccess: () => void;
  onBulkUpdateSuccess: () => void;
  onDiscontinueSuccess: () => void;
  onReactivateSuccess: () => void;
}

export function useInventoryData({
  categoryFilter,
  statusFilter,
  lowStockFilter,
  onCreateSuccess,
  onUpdateSuccess,
  onBulkDeleteSuccess,
  onBulkUpdateSuccess,
  onDiscontinueSuccess,
  onReactivateSuccess,
}: UseInventoryDataOptions) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Products query (normal mode)
  const { data: productsData, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: [
      'products',
      { category_id: categoryFilter === 'all' ? undefined : categoryFilter, status: statusFilter },
    ],
    queryFn: () =>
      api
        .get('/api/v1/products', {
          params: {
            limit: 200,
            category_id: categoryFilter === 'all' ? undefined : categoryFilter,
            status: statusFilter,
          },
        })
        .then((r) => r.data.data),
    enabled: !lowStockFilter,
  });

  // Low stock query
  const { data: lowStockData, isLoading: lowStockLoading } = useQuery<LowStockProduct[]>({
    queryKey: ['products-low-stock'],
    queryFn: () => api.get('/api/v1/products/low-stock').then((r) => r.data.data),
    enabled: lowStockFilter,
  });

  // Categories query
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data.data),
  });

  // Distributors query
  const { data: distributors } = useQuery<Distributor[]>({
    queryKey: ['distributors'],
    queryFn: () => api.get('/api/v1/distributors').then((r) => r.data.data),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/api/v1/products', data),
    onSuccess: () => {
      toast.success(t('inventory.productCreated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      onCreateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('inventory.failedToCreateProduct')),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductFormData }) =>
      api.put(`/api/v1/products/${id}`, data),
    onSuccess: () => {
      toast.success(t('inventory.productUpdated'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      onUpdateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('inventory.failedToUpdateProduct')),
  });

  // Discontinue mutation
  const discontinueMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/products/${id}`),
    onSuccess: () => {
      toast.success(t('inventory.productDiscontinued'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      onDiscontinueSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.deleteFailed')),
  });

  // Status mutation (reactivate etc.)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/v1/products/${id}/status`, { status }),
    onSuccess: () => {
      toast.success(t('inventory.statusChanged'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      onReactivateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.updateFailed')),
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (products: CsvProduct[]) => api.post('/api/v1/products/import', { products }),
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

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post('/api/v1/products/bulk-delete', { ids }),
    onSuccess: (res: AxiosResponse<{ data: { deleted: number } }>) => {
      toast.success(t('bulk.discontinueSuccess', { count: String(res.data.data.deleted) }));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      onBulkDeleteSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.deleteFailed')),
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { ids: number[]; updates: Record<string, unknown> }) =>
      api.put('/api/v1/products/bulk-update', data),
    onSuccess: () => {
      toast.success(t('bulk.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      onBulkUpdateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('bulk.updateFailed')),
  });

  const isLoading = lowStockFilter ? lowStockLoading : productsLoading;
  const currentData = (lowStockFilter ? lowStockData : productsData) ?? [];

  return {
    // Data
    currentData,
    isLoading,
    categories,
    distributors,
    // Mutations
    createMutation,
    updateMutation,
    discontinueMutation,
    statusMutation,
    importMutation,
    bulkDeleteMutation,
    bulkUpdateMutation,
    // Query client for image operations
    queryClient,
  };
}
