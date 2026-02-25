import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse, Product, Distributor } from '@/types';

export interface PurchaseOrder {
  id: number;
  po_number: string;
  distributor_id: number;
  distributor_name: string;
  status: string;
  total: number;
  notes: string | null;
  item_count: number;
  created_by_name: string;
  created_at: string;
}

export interface POItem {
  id: number;
  po_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  received_quantity: number;
  cost_price: number;
  product_name: string;
  product_sku: string;
  variant_sku: string | null;
  variant_attributes: Record<string, string> | null;
}

export interface PODetail extends PurchaseOrder {
  items: POItem[];
}

export interface LowStockSuggestion {
  product_id: number;
  name: string;
  sku: string;
  cost_price: number;
  stock: number;
  min_stock: number;
  distributor_id: number;
  distributor_name: string;
  suggested_qty: number;
}

export interface LineItem {
  product_id: number;
  product_name: string;
  quantity: number;
  cost_price: number;
}

interface UsePurchaseOrderDataParams {
  statusFilter: string;
  distributorFilter: string;
  detailId: number | null;
  detailOpen: boolean;
  createOpen: boolean;
  onCreateSuccess: () => void;
  onReceiveSuccess: () => void;
  onDeleteSuccess: () => void;
}

export function usePurchaseOrderData({
  statusFilter,
  distributorFilter,
  detailId,
  detailOpen,
  createOpen,
  onCreateSuccess,
  onReceiveSuccess,
  onDeleteSuccess,
}: UsePurchaseOrderDataParams) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Queries
  const { data: orders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: [
      'purchase-orders',
      {
        status: statusFilter,
        distributor_id: distributorFilter === 'all' ? undefined : distributorFilter,
      },
    ],
    queryFn: () =>
      api
        .get('/api/v1/purchase-orders', {
          params: {
            limit: 200,
            status: statusFilter === 'All' ? undefined : statusFilter,
            distributor_id: distributorFilter === 'all' ? undefined : distributorFilter,
          },
        })
        .then((r) => r.data.data),
  });

  const { data: detail } = useQuery<PODetail>({
    queryKey: ['purchase-order-detail', detailId],
    queryFn: () => api.get(`/api/v1/purchase-orders/${detailId}`).then((r) => r.data.data),
    enabled: !!detailId && detailOpen,
  });

  const { data: distributors } = useQuery<Distributor[]>({
    queryKey: ['distributors'],
    queryFn: () => api.get('/api/v1/distributors').then((r) => r.data.data),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-all'],
    queryFn: () => api.get('/api/v1/products', { params: { limit: 500 } }).then((r) => r.data.data),
    enabled: createOpen,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: {
      distributor_id: number;
      items: Array<{ product_id: number; quantity: number; cost_price: number }>;
      notes: string | null;
    }) => api.post('/api/v1/purchase-orders', data),
    onSuccess: () => {
      toast.success(t('po.created'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onCreateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('po.createFailed')),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { id: number; status: string }) =>
      api.put(`/api/v1/purchase-orders/${data.id}/status`, { status: data.status }),
    onSuccess: () => {
      toast.success(t('po.statusUpdated'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail'] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (data: { id: number; items: Array<{ item_id: number; quantity: number }> }) =>
      api.post(`/api/v1/purchase-orders/${data.id}/receive`, { items: data.items }),
    onSuccess: () => {
      toast.success(t('po.received_success'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onReceiveSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('po.receiveFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/purchase-orders/${id}`),
    onSuccess: () => {
      toast.success(t('po.deleted'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onDeleteSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('po.deleteFailed')),
  });

  return {
    orders,
    isLoading,
    detail,
    distributors,
    products,
    createMutation,
    statusMutation,
    receiveMutation,
    deleteMutation,
  };
}
