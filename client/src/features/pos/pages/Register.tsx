import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Card, CardContent } from '../../../shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui/dialog';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import CashMovementDialog from '../components/register/CashMovementDialog';
import RegisterReport from '../components/register/RegisterReport';
import type { RegisterReportData, RegisterSession } from '@/types';

const register = resource<RegisterSession>('register');

/**
 * `register/open`, `register/close` and `register/movement` act on the drawer
 * rather than on a session, and `resource` only knows actions that hang off a
 * record id. Three endpoints are not worth widening it for, so they reach the
 * transport directly and say what they refresh.
 */
function useRegisterWrite<Body>(path: string, message: string) {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Body) => transport.request({ method: 'POST', path, body }),
    onSuccess: () => {
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Error'),
  });
}

export default function RegisterPage() {
  const { t } = useTranslation();

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  // The session whose report is showing; null means the report is closed.
  const [reportSessionId, setReportSessionId] = useState<number | null>(null);

  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');

  const { data: currentSession, isLoading } = register.useRead<RegisterSession | null>('current');

  const { data: reportData } = register.useRead<RegisterReportData>(
    `${reportSessionId}/report`,
    undefined,
    reportSessionId !== null
  );

  // History carries its own pagination totals beside the rows, which is meta
  // rather than a resource list, and it waits for the dialog that shows it.
  const { data: historySessions, meta: historyMeta } = useApiQuery<RegisterSession[]>(
    ['register', 'history'],
    'register/history',
    undefined,
    { enabled: historyDialogOpen }
  );

  const openRegister = useRegisterWrite<{ opening_float: number }>(
    'register/open',
    t('register.registerOpen')
  );
  const closeRegister = useRegisterWrite<{ counted_cash: number; notes?: string }>(
    'register/close',
    t('register.registerClosed')
  );
  const recordMovement = useRegisterWrite<{ type: string; amount: number; note?: string }>(
    'register/movement',
    t('register.movementRecorded')
  );

  const forceClose = register.useAction('force-close', {
    message: t('register.registerClosed'),
  });

  const handleOpenRegister = (e: React.FormEvent) => {
    e.preventDefault();
    openRegister.mutate(
      { opening_float: Number(openingFloat) || 0 },
      {
        onSuccess: () => {
          setOpenDialogOpen(false);
          setOpeningFloat('');
        },
      }
    );
  };

  const handleCloseRegister = (e: React.FormEvent) => {
    e.preventDefault();
    closeRegister.mutate(
      {
        counted_cash: Number(countedCash) || 0,
        notes: closeNotes || undefined,
      },
      {
        onSuccess: () => {
          setCloseDialogOpen(false);
          setCountedCash('');
          setCloseNotes('');
        },
      }
    );
  };

  const handleMovement = (type: 'cash_in' | 'cash_out', amount: number, note?: string) => {
    recordMovement.mutate(
      { type, amount, note },
      {
        onSuccess: () => {
          setMovementDialogOpen(false);
        },
      }
    );
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
              onClick={() => setReportSessionId(currentSession.id)}
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
          <form onSubmit={handleOpenRegister} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={openRegister.isPending}>
              {openRegister.isPending ? t('common.loading') : t('register.openRegister')}
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
          <form onSubmit={handleCloseRegister} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={closeRegister.isPending}>
              {closeRegister.isPending ? t('common.loading') : t('register.closeRegister')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cash Movement Dialog */}
      <CashMovementDialog
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
        onSubmit={handleMovement}
        isSubmitting={recordMovement.isPending}
        movementType={movementType}
      />

      {/* Report Dialog */}
      <RegisterReport
        open={reportSessionId !== null}
        onOpenChange={(open) => {
          if (!open) setReportSessionId(null);
        }}
        reportData={reportData ?? null}
      />

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('register.history')}</DialogTitle>
            <DialogDescription>
              {Number(historyMeta?.total ?? 0)} {t('register.history').toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          {historySessions && historySessions.length > 0 ? (
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
                  {historySessions.map((s) => (
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
                            onClick={() => setReportSessionId(s.id)}
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
                                  forceClose.run({ id: s.id });
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
