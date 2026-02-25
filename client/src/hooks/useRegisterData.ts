import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import api from '../services/api';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';

export interface RegisterSession {
  id: number;
  cashier_id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  sale_count?: number;
  total_in?: number;
  total_out?: number;
  total_sales?: number;
}

export interface RegisterMovement {
  id: number;
  session_id: number;
  type: 'sale' | 'refund' | 'cash_in' | 'cash_out';
  amount: number;
  sale_id: number | null;
  note: string | null;
  created_at: string;
}

export interface RegisterReportData {
  session: RegisterSession;
  movements: RegisterMovement[];
  summary: {
    total_sales: number;
    total_refunds: number;
    total_cash_in: number;
    total_cash_out: number;
    sale_count: number;
    refund_count: number;
  };
}

export function useRegisterData(historyEnabled: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Current open session
  const currentSessionQuery = useQuery<RegisterSession | null>({
    queryKey: ['register', 'current'],
    queryFn: () => api.get('/api/v1/register/current').then((r) => r.data.data),
  });

  // Session history (admin)
  const historyQuery = useQuery<{
    data: RegisterSession[];
    meta: { total: number; page: number; limit: number };
  }>({
    queryKey: ['register', 'history'],
    queryFn: () =>
      api.get('/api/v1/register/history').then((r) => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    enabled: historyEnabled,
  });

  // Open register
  const openMutation = useMutation({
    mutationFn: (data: { opening_float: number }) => api.post('/api/v1/register/open', data),
    onSuccess: () => {
      toast.success(t('register.registerOpen'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Close register
  const closeMutation = useMutation({
    mutationFn: (data: { counted_cash: number; notes?: string }) =>
      api.post('/api/v1/register/close', data),
    onSuccess: () => {
      toast.success(t('register.registerClosed'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Cash movement
  const movementMutation = useMutation({
    mutationFn: (data: { type: string; amount: number; note?: string }) =>
      api.post('/api/v1/register/movement', data),
    onSuccess: () => {
      toast.success(t('register.movementRecorded'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Force close (admin)
  const forceCloseMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/v1/register/${id}/force-close`),
    onSuccess: () => {
      toast.success(t('register.registerClosed'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Load report for a session
  const loadReport = async (sessionId: number): Promise<RegisterReportData | null> => {
    try {
      const res = await api.get(`/api/v1/register/${sessionId}/report`);
      return res.data.data as RegisterReportData;
    } catch {
      toast.error('Failed to load report');
      return null;
    }
  };

  return {
    currentSession: currentSessionQuery.data,
    isLoading: currentSessionQuery.isLoading,
    historyData: historyQuery.data,
    openMutation,
    closeMutation,
    movementMutation,
    forceCloseMutation,
    loadReport,
  };
}
