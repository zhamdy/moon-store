import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Vault,
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Clock,
  X,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
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
import type { ApiErrorResponse } from '@/types';

interface RegisterSession {
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

interface RegisterMovement {
  id: number;
  session_id: number;
  type: 'sale' | 'refund' | 'cash_in' | 'cash_out';
  amount: number;
  sale_id: number | null;
  note: string | null;
  created_at: string;
}

interface RegisterReport {
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

export default function RegisterPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNote, setMovementNote] = useState('');

  const [reportData, setReportData] = useState<RegisterReport | null>(null);

  // Current open session
  const { data: currentSession, isLoading } = useQuery<RegisterSession | null>({
    queryKey: ['register', 'current'],
    queryFn: () => api.get('/api/register/current').then((r) => r.data.data),
  });

  // Session history (admin)
  const { data: historyData } = useQuery<{
    data: RegisterSession[];
    meta: { total: number; page: number; limit: number };
  }>({
    queryKey: ['register', 'history'],
    queryFn: () =>
      api.get('/api/register/history').then((r) => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    enabled: historyDialogOpen,
  });

  // Open register
  const openMutation = useMutation({
    mutationFn: (data: { opening_float: number }) => api.post('/api/register/open', data),
    onSuccess: () => {
      toast.success(t('register.registerOpen'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
      setOpenDialogOpen(false);
      setOpeningFloat('');
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Close register
  const closeMutation = useMutation({
    mutationFn: (data: { counted_cash: number; notes?: string }) =>
      api.post('/api/register/close', data),
    onSuccess: () => {
      toast.success(t('register.registerClosed'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
      setCloseDialogOpen(false);
      setCountedCash('');
      setCloseNotes('');
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Cash movement
  const movementMutation = useMutation({
    mutationFn: (data: { type: string; amount: number; note?: string }) =>
      api.post('/api/register/movement', data),
    onSuccess: () => {
      toast.success(t('register.movementRecorded'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
      setMovementDialogOpen(false);
      setMovementAmount('');
      setMovementNote('');
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  // Force close (admin)
  const forceCloseMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/register/${id}/force-close`),
    onSuccess: () => {
      toast.success(t('register.registerClosed'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const loadReport = async (sessionId: number) => {
    try {
      const res = await api.get(`/api/register/${sessionId}/report`);
      setReportData(res.data.data);
      setReportDialogOpen(true);
    } catch {
      toast.error('Failed to load report');
    }
  };

  const variance = currentSession ? (Number(countedCash) || 0) - currentSession.expected_cash : 0;

  if (isLoading) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-surface rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('register.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)} className="gap-2">
            <Clock className="h-4 w-4" /> {t('register.history')}
          </Button>
          {!currentSession ? (
            <Button onClick={() => setOpenDialogOpen(true)} className="gap-2">
              <Vault className="h-4 w-4" /> {t('register.openRegister')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setCloseDialogOpen(true)}
              className="gap-2"
            >
              <X className="h-4 w-4" /> {t('register.closeRegister')}
            </Button>
          )}
        </div>
      </div>

      {/* No session state */}
      {!currentSession ? (
        <div className="text-center py-24">
          <Vault className="h-16 w-16 text-gold/40 mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">
            {t('register.noOpenSession')}
          </h2>
          <p className="text-muted text-sm mb-6">{t('register.mustOpenRegister')}</p>
          <Button onClick={() => setOpenDialogOpen(true)} className="gap-2">
            <Vault className="h-4 w-4" /> {t('register.openRegister')}
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted font-data uppercase tracking-wider">
                    {t('register.openingFloat')}
                  </span>
                  <DollarSign className="h-4 w-4 text-gold" />
                </div>
                <p className="text-2xl font-data font-bold">
                  {formatCurrency(currentSession.opening_float)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted font-data uppercase tracking-wider">
                    {t('register.expectedCash')}
                  </span>
                  <DollarSign className="h-4 w-4 text-gold" />
                </div>
                <p className="text-2xl font-data font-bold">
                  {formatCurrency(currentSession.expected_cash)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted font-data uppercase tracking-wider">
                    {t('register.saleCount')}
                  </span>
                  <FileText className="h-4 w-4 text-gold" />
                </div>
                <p className="text-2xl font-data font-bold">{currentSession.sale_count || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted font-data uppercase tracking-wider">
                    {t('register.openedAt')}
                  </span>
                  <Clock className="h-4 w-4 text-gold" />
                </div>
                <p className="text-lg font-data">
                  {new Date(currentSession.opened_at).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => {
                setMovementType('cash_in');
                setMovementDialogOpen(true);
              }}
            >
              <ArrowDownToLine className="h-6 w-6 text-emerald-500" />
              <span>{t('register.cashIn')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => {
                setMovementType('cash_out');
                setMovementDialogOpen(true);
              }}
            >
              <ArrowUpFromLine className="h-6 w-6 text-red-500" />
              <span>{t('register.cashOut')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => loadReport(currentSession.id)}
            >
              <FileText className="h-6 w-6 text-gold" />
              <span>{t('register.xReport')}</span>
            </Button>
          </div>

          {/* Cash summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">
                  {t('register.totalCashIn')}
                </h3>
                <p className="text-2xl font-data font-bold text-emerald-500">
                  +{formatCurrency(currentSession.total_in || 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">
                  {t('register.totalCashOut')}
                </h3>
                <p className="text-2xl font-data font-bold text-red-500">
                  -{formatCurrency(currentSession.total_out || 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Open Register Dialog */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('register.openRegister')}</DialogTitle>
            <DialogDescription>{t('register.openingFloatDesc')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openMutation.mutate({ opening_float: Number(openingFloat) || 0 });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('register.openingFloat')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={openMutation.isPending}>
              {openMutation.isPending ? t('common.loading') : t('register.openRegister')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('register.closeRegister')}</DialogTitle>
            <DialogDescription>
              {t('register.expectedCash')}: {formatCurrency(currentSession?.expected_cash || 0)}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              closeMutation.mutate({
                counted_cash: Number(countedCash) || 0,
                notes: closeNotes || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('register.countedCash')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                autoFocus
              />
            </div>
            {countedCash && (
              <div
                className={`p-3 rounded-md text-sm font-data ${
                  variance >= 0
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-red-500/10 text-red-600'
                }`}
              >
                {t('register.variance')}: {formatCurrency(Math.abs(variance))}{' '}
                {variance >= 0 ? t('register.over') : t('register.short')}
              </div>
            )}
            <div className="space-y-1">
              <Label>{t('register.notes')}</Label>
              <Input
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder={t('register.notePlaceholder')}
              />
            </div>
            <Button type="submit" className="w-full" disabled={closeMutation.isPending}>
              {closeMutation.isPending ? t('common.loading') : t('register.closeRegister')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cash Movement Dialog */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementType === 'cash_in' ? t('register.cashIn') : t('register.cashOut')}
            </DialogTitle>
            <DialogDescription>{t('register.notePlaceholder')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              movementMutation.mutate({
                type: movementType,
                amount: Number(movementAmount) || 0,
                note: movementNote || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('register.amount')}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('register.note')}</Label>
              <Input
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
                placeholder={t('register.notePlaceholder')}
              />
            </div>
            <Button type="submit" className="w-full" disabled={movementMutation.isPending}>
              {movementMutation.isPending ? t('common.loading') : t('common.confirm')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('register.report')}</DialogTitle>
            <DialogDescription>
              {reportData?.session.cashier_name} —{' '}
              {reportData && new Date(reportData.session.opened_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {reportData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-surface">
                  <span className="text-xs text-muted">{t('register.totalSales')}</span>
                  <p className="text-lg font-data font-bold">
                    {formatCurrency(reportData.summary.total_sales)}
                  </p>
                  <span className="text-xs text-muted">
                    {reportData.summary.sale_count} {t('register.saleCount').toLowerCase()}
                  </span>
                </div>
                <div className="p-3 rounded-md bg-surface">
                  <span className="text-xs text-muted">{t('register.totalRefunds')}</span>
                  <p className="text-lg font-data font-bold text-red-500">
                    {formatCurrency(reportData.summary.total_refunds)}
                  </p>
                  <span className="text-xs text-muted">
                    {reportData.summary.refund_count} refunds
                  </span>
                </div>
                <div className="p-3 rounded-md bg-surface">
                  <span className="text-xs text-muted">{t('register.totalCashIn')}</span>
                  <p className="text-lg font-data font-bold text-emerald-500">
                    {formatCurrency(reportData.summary.total_cash_in)}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-surface">
                  <span className="text-xs text-muted">{t('register.totalCashOut')}</span>
                  <p className="text-lg font-data font-bold text-red-500">
                    {formatCurrency(reportData.summary.total_cash_out)}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-md bg-gold/5 border border-gold/20">
                <div className="flex justify-between text-sm">
                  <span>{t('register.openingFloat')}</span>
                  <span className="font-data">
                    {formatCurrency(reportData.session.opening_float)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>{t('register.expectedCash')}</span>
                  <span className="font-data font-bold">
                    {formatCurrency(reportData.session.expected_cash)}
                  </span>
                </div>
                {reportData.session.counted_cash !== null && (
                  <>
                    <div className="flex justify-between text-sm mt-1">
                      <span>{t('register.countedCash')}</span>
                      <span className="font-data">
                        {formatCurrency(reportData.session.counted_cash)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 font-bold">
                      <span>{t('register.variance')}</span>
                      <span
                        className={`font-data ${
                          (reportData.session.variance || 0) >= 0
                            ? 'text-emerald-500'
                            : 'text-red-500'
                        }`}
                      >
                        {formatCurrency(Math.abs(reportData.session.variance || 0))}{' '}
                        {(reportData.session.variance || 0) >= 0
                          ? t('register.over')
                          : t('register.short')}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Movements list */}
              {reportData.movements.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('register.movements')}</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {reportData.movements.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-xs p-2 rounded bg-surface"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              m.type === 'sale' || m.type === 'cash_in' ? 'default' : 'destructive'
                            }
                            className="text-[10px]"
                          >
                            {m.type}
                          </Badge>
                          {m.note && <span className="text-muted">{m.note}</span>}
                        </div>
                        <span className="font-data font-medium">
                          {m.type === 'sale' || m.type === 'cash_in' ? '+' : '-'}
                          {formatCurrency(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('register.history')}</DialogTitle>
            <DialogDescription>
              {historyData?.meta.total || 0} {t('register.history').toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          {historyData && historyData.data.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-border sticky top-0">
                  <tr>
                    <th className="text-start p-2 font-medium text-muted">
                      {t('register.cashier')}
                    </th>
                    <th className="text-start p-2 font-medium text-muted">
                      {t('register.openedAt')}
                    </th>
                    <th className="text-start p-2 font-medium text-muted">
                      {t('register.closedAt')}
                    </th>
                    <th className="text-end p-2 font-medium text-muted">
                      {t('register.totalSales')}
                    </th>
                    <th className="text-end p-2 font-medium text-muted">
                      {t('register.variance')}
                    </th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.data.map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="p-2">{s.cashier_name}</td>
                      <td className="p-2 font-data text-xs">
                        {new Date(s.opened_at).toLocaleString()}
                      </td>
                      <td className="p-2 font-data text-xs">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString() : '—'}
                      </td>
                      <td className="p-2 text-end font-data">
                        {formatCurrency(s.total_sales || 0)}
                      </td>
                      <td className="p-2 text-end font-data">
                        {s.variance !== null ? (
                          <span className={s.variance >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {formatCurrency(Math.abs(s.variance))}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => loadReport(s.id)}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          {s.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive"
                              onClick={() => {
                                if (window.confirm(t('register.forceCloseConfirm'))) {
                                  forceCloseMutation.mutate(s.id);
                                }
                              }}
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-sm text-center py-8">{t('register.noOpenSession')}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
