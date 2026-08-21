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
} from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { PageHeader, StatCard, CardSkeleton } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import CashMovementDialog from '../components/register/CashMovementDialog';
import RegisterReport from '../components/register/RegisterReport';
import type { RegisterReportData, RegisterSession } from '../types';

const register = resource<RegisterSession>('register');

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
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title={t('register.title')}
        actions={
          <div className="flex gap-2">
            <Button
              variant="bordered"
              size="sm"
              onClick={() => setHistoryDialogOpen(true)}
              startContent={<Clock className="h-4 w-4" />}
            >
              {t('register.history')}
            </Button>
            {!currentSession ? (
              <Button
                color="primary"
                size="sm"
                onClick={() => setOpenDialogOpen(true)}
                startContent={<Vault className="h-4 w-4" />}
              >
                {t('register.openRegister')}
              </Button>
            ) : (
              <Button
                variant="bordered"
                size="sm"
                onClick={() => setCloseDialogOpen(true)}
                startContent={<X className="h-4 w-4" />}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {t('register.closeRegister')}
              </Button>
            )}
          </div>
        }
      />

      {/* No session state */}
      {!currentSession ? (
        <div className="text-center py-24">
          <Vault className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('register.noOpenSession')}</h2>
          <p className="text-muted-foreground text-sm mb-6">{t('register.mustOpenRegister')}</p>
          <Button
            color="primary"
            size="sm"
            onClick={() => setOpenDialogOpen(true)}
            startContent={<Vault className="h-4 w-4" />}
          >
            {t('register.openRegister')}
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('register.openingFloat')}
              value={formatCurrency(currentSession.opening_float)}
              icon={DollarSign}
            />
            <StatCard
              title={t('register.expectedCash')}
              value={formatCurrency(currentSession.expected_cash)}
              icon={DollarSign}
            />
            <StatCard
              title={t('register.saleCount')}
              value={currentSession.sale_count || 0}
              icon={FileText}
            />
            <StatCard
              title={t('register.openedAt')}
              value={new Date(currentSession.opened_at).toLocaleTimeString()}
              icon={Clock}
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button
              variant="bordered"
              className="h-20 flex-col gap-2 rounded-xl"
              onClick={() => {
                setMovementType('cash_in');
                setMovementDialogOpen(true);
              }}
            >
              <ArrowDownToLine className="h-6 w-6 text-success" />
              <span className="text-sm font-medium">{t('register.cashIn')}</span>
            </Button>
            <Button
              variant="bordered"
              className="h-20 flex-col gap-2 rounded-xl"
              onClick={() => {
                setMovementType('cash_out');
                setMovementDialogOpen(true);
              }}
            >
              <ArrowUpFromLine className="h-6 w-6 text-danger" />
              <span className="text-sm font-medium">{t('register.cashOut')}</span>
            </Button>
            <Button
              variant="bordered"
              className="h-20 flex-col gap-2 rounded-xl"
              onClick={() => setReportSessionId(currentSession.id)}
            >
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{t('register.xReport')}</span>
            </Button>
          </div>

          {/* Cash summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title={t('register.totalCashIn')}
              value={`+${formatCurrency(currentSession.total_in || 0)}`}
              trend={{ direction: 'up', value: 'Cash in' }}
            />
            <StatCard
              title={t('register.totalCashOut')}
              value={`-${formatCurrency(currentSession.total_out || 0)}`}
              trend={{ direction: 'down', value: 'Cash out' }}
            />
          </div>
        </>
      )}

      {/* Open Register Dialog */}
      <Modal
        isOpen={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form onSubmit={handleOpenRegister}>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('register.openRegister')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('register.openingFloatDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  type="number"
                  label={t('register.openingFloat')}
                  size="sm"
                  variant="bordered"
                  min="0"
                  step="0.01"
                  value={openingFloat}
                  onValueChange={setOpeningFloat}
                  autoFocus
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setOpenDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={openRegister.isPending}>
                  {openRegister.isPending ? t('common.loading') : t('register.openRegister')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Close Register Dialog */}
      <Modal
        isOpen={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form onSubmit={handleCloseRegister}>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('register.closeRegister')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('register.expectedCash')}:{' '}
                    {formatCurrency(currentSession?.expected_cash || 0)}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  type="number"
                  label={t('register.countedCash')}
                  size="sm"
                  variant="bordered"
                  min="0"
                  step="0.01"
                  value={countedCash}
                  onValueChange={setCountedCash}
                  autoFocus
                />
                {countedCash && (
                  <div
                    className={`p-3 rounded-xl text-sm font-data font-semibold ${
                      variance >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {t('register.variance')}: {formatCurrency(Math.abs(variance))}{' '}
                    {variance >= 0 ? t('register.over') : t('register.short')}
                  </div>
                )}
                <Input
                  label={t('register.notes')}
                  size="sm"
                  variant="bordered"
                  value={closeNotes}
                  onValueChange={setCloseNotes}
                  placeholder={t('register.notePlaceholder')}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setCloseDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="danger" size="sm" isLoading={closeRegister.isPending}>
                  {closeRegister.isPending ? t('common.loading') : t('register.closeRegister')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

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
      <Modal
        isOpen={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        backdrop="blur"
        placement="center"
        size="2xl"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('register.history')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {Number(historyMeta?.total ?? 0)} {t('register.history').toLowerCase()}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                {historySessions && historySessions.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto border border-border rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold sticky top-0">
                        <tr>
                          <th className="text-start p-3">{t('register.cashier')}</th>
                          <th className="text-start p-3">{t('register.openedAt')}</th>
                          <th className="text-start p-3">{t('register.closedAt')}</th>
                          <th className="text-end p-3">{t('register.totalSales')}</th>
                          <th className="text-end p-3">{t('register.variance')}</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {historySessions.map((s) => (
                          <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-foreground font-medium">{s.cashier_name}</td>
                            <td className="p-3 font-data text-xs text-muted-foreground">
                              {new Date(s.opened_at).toLocaleString()}
                            </td>
                            <td className="p-3 font-data text-xs text-muted-foreground">
                              {s.closed_at ? new Date(s.closed_at).toLocaleString() : '—'}
                            </td>
                            <td className="p-3 text-end font-data text-foreground font-semibold">
                              {formatCurrency(s.total_sales || 0)}
                            </td>
                            <td className="p-3 text-end font-data">
                              {s.variance !== null ? (
                                <span
                                  className={`font-semibold ${s.variance >= 0 ? 'text-success' : 'text-danger'}`}
                                >
                                  {formatCurrency(Math.abs(s.variance))}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  isIconOnly
                                  variant="light"
                                  size="sm"
                                  className="h-7 w-7"
                                  onClick={() => setReportSessionId(s.id)}
                                  aria-label="View report"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                                {s.status === 'open' && (
                                  <Button
                                    isIconOnly
                                    variant="light"
                                    color="danger"
                                    size="sm"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      if (window.confirm(t('register.forceCloseConfirm'))) {
                                        forceClose.run({ id: s.id });
                                      }
                                    }}
                                    aria-label="Force close"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
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
                  <p className="text-muted-foreground text-sm text-center py-8">
                    {t('register.noOpenSession')}
                  </p>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
