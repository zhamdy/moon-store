import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTranslation } from '../i18n';

import type { AxiosError, AxiosResponse } from 'axios';
import type { ApiErrorResponse, Product } from '@/types';

export type DeliveryStatus = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface ShippingCompany {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  created_at: string;
}

export interface DeliveryOrder {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string | null;
  status: DeliveryStatus;
  shipping_company_id: number | null;
  shipping_company_name: string | null;
  tracking_number: string | null;
  shipping_cost: number;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
}

export interface StatusHistoryEntry {
  id: number;
  order_id: number;
  status: string;
  notes: string | null;
  changed_by_name: string | null;
  created_at: string;
}

export interface PerformanceData {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Array<{
    id: number;
    name: string;
    total_orders: number;
    delivered: number;
    cancelled: number;
    avg_days: number | null;
  }>;
}

export interface DeliveryPayload {
  customer_id: number | null;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string;
  estimated_delivery: string | null;
  shipping_company_id: number | null;
  tracking_number: string | null;
  shipping_cost: number | null;
  items: Array<{ product_id: number; quantity: number }>;
}

interface UseDeliveryDataParams {
  statusFilter: string;
  customerSearch: string;
  dialogOpen: boolean;
  timelineOrderId: number | null;
  timelineDialogOpen: boolean;
  isAdmin: boolean;
  onCreateSuccess: () => void;
  onUpdateSuccess: () => void;
  onCompanyFormClose: () => void;
}

export function useDeliveryData({
  statusFilter,
  customerSearch,
  dialogOpen,
  timelineOrderId,
  timelineDialogOpen,
  isAdmin,
  onCreateSuccess,
  onUpdateSuccess,
  onCompanyFormClose,
}: UseDeliveryDataParams) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // --- Queries ---

  const { data: orders, isLoading } = useQuery<DeliveryOrder[]>({
    queryKey: ['deliveries', { status: statusFilter }],
    queryFn: () =>
      api
        .get('/api/v1/delivery', {
          params: { limit: 100, status: statusFilter === 'All' ? undefined : statusFilter },
        })
        .then((r) => r.data.data),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => api.get('/api/v1/products', { params: { limit: 200 } }).then((r) => r.data.data),
  });

  const { data: shippingCompanies } = useQuery<ShippingCompany[]>({
    queryKey: ['shipping-companies'],
    queryFn: () => api.get('/api/v1/shipping-companies').then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () =>
      api
        .get('/api/v1/customers', { params: { search: customerSearch || undefined } })
        .then((r) => r.data.data),
    enabled: isAdmin && dialogOpen,
  });

  const { data: performance } = useQuery<PerformanceData>({
    queryKey: ['delivery-performance'],
    queryFn: () => api.get('/api/v1/delivery/analytics/performance').then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: statusHistory } = useQuery<StatusHistoryEntry[]>({
    queryKey: ['delivery-history', timelineOrderId],
    queryFn: () => api.get(`/api/v1/delivery/${timelineOrderId}/history`).then((r) => r.data.data),
    enabled: !!timelineOrderId && timelineDialogOpen,
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: DeliveryPayload) => api.post('/api/v1/delivery', data),
    onSuccess: () => {
      toast.success(t('deliveries.orderCreated'));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-performance'] });
      onCreateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DeliveryPayload }) =>
      api.put(`/api/v1/delivery/${id}`, data),
    onSuccess: () => {
      toast.success(t('deliveries.orderUpdated'));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-performance'] });
      onUpdateSuccess();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.updateFailed')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/v1/delivery/${id}/status`, { status }),
    onSuccess: (res: AxiosResponse<{ data: { status: string } }>) => {
      const status = res.data.data.status;
      toast.success(t('deliveries.statusUpdated', { status }));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-performance'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-history'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.statusFailed')),
  });

  const companyCreateMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string; website?: string }) =>
      api.post('/api/v1/shipping-companies', data),
    onSuccess: () => {
      toast.success(t('deliveries.companySaved'));
      queryClient.invalidateQueries({ queryKey: ['shipping-companies'] });
      onCompanyFormClose();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.createFailed')),
  });

  const companyUpdateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; phone?: string; website?: string };
    }) => api.put(`/api/v1/shipping-companies/${id}`, data),
    onSuccess: () => {
      toast.success(t('deliveries.companySaved'));
      queryClient.invalidateQueries({ queryKey: ['shipping-companies'] });
      onCompanyFormClose();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.updateFailed')),
  });

  const companyDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/shipping-companies/${id}`),
    onSuccess: () => {
      toast.success(t('deliveries.companyDeleted'));
      queryClient.invalidateQueries({ queryKey: ['shipping-companies'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.companyDeleteFailed')),
  });

  return {
    // Query results
    orders,
    isLoading,
    products,
    shippingCompanies,
    customers,
    performance,
    statusHistory,
    // Mutations
    createMutation,
    updateMutation,
    statusMutation,
    companyCreateMutation,
    companyUpdateMutation,
    companyDeleteMutation,
  };
}
