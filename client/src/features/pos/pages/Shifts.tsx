import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, Coffee, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, CardBody, Tabs, Tab, Pagination } from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { useAuthStore } from '../../auth';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport/index';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import type { Shift } from '../types';

const shifts = resource<Shift>('shifts');

function useShiftAction(path: string, message: string) {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => transport.request({ method: 'POST', path }),
    onSuccess: () => {
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Error'),
  });
}

export default function ShiftsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [historyPage, setHistoryPage] = useState(1);

  const isAdmin = user?.role === 'Admin';

  const { data: currentShift } = shifts.useRead<Shift | null>('current');
  const { data: activeShifts } = useApiQuery<Shift[]>(
    ['shifts', 'active'],
    'shifts',
    { page: 1, pageSize: 25, status: 'open', sortBy: 'clockIn', sortOrder: 'desc' },
    { enabled: isAdmin && tab === 'active' }
  );
  const { data: history, meta: historyMeta } = useApiQuery<Shift[]>(
    ['shifts', 'history'],
    'shifts',
    {
      page: historyPage,
      pageSize: 25,
      status: 'completed',
      sortBy: 'clockIn',
      sortOrder: 'desc',
    },
    { enabled: isAdmin && tab === 'history' }
  );

  const clockIn = useShiftAction('shifts/clock-in', t('shifts.clockedIn'));
  const clockOut = useShiftAction('shifts/clock-out', t('shifts.clockedOut'));
  const startBreak = useShiftAction('shifts/break/start', t('shifts.onBreak'));
  const endBreak = useShiftAction('shifts/break/end', t('shifts.breakEnded'));

  const formatHours = (h: number | null) => {
    if (h === null || h === undefined) return '—';
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('shifts.title')} />

      {/* My shift status */}
      <Card className="border border-border bg-card shadow-sm">
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">{user?.name}</h3>
              {currentShift ? (
                <div className="flex items-center gap-2">
                  <Badge
                    size="sm"
                    variant={currentShift.status === 'on_break' ? 'warning' : 'success'}
                  >
                    {currentShift.status === 'on_break'
                      ? t('shifts.onBreak')
                      : t('shifts.clockedIn')}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-data">
                    {new Date(currentShift.clock_in).toLocaleTimeString()}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">{t('shifts.noShifts')}</span>
              )}
            </div>
            <div className="flex gap-2">
              {!currentShift ? (
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => clockIn.mutate()}
                  isLoading={clockIn.isPending}
                  startContent={<LogIn className="h-4 w-4" />}
                >
                  {t('shifts.clockIn')}
                </Button>
              ) : (
                <>
                  {currentShift.status === 'active' ? (
                    <Button
                      variant="bordered"
                      size="sm"
                      onClick={() => startBreak.mutate()}
                      isLoading={startBreak.isPending}
                      startContent={<Coffee className="h-4 w-4" />}
                    >
                      {t('shifts.startBreak')}
                    </Button>
                  ) : (
                    <Button
                      variant="bordered"
                      size="sm"
                      onClick={() => endBreak.mutate()}
                      isLoading={endBreak.isPending}
                      startContent={<Play className="h-4 w-4" />}
                    >
                      {t('shifts.endBreak')}
                    </Button>
                  )}
                  <Button
                    color="danger"
                    size="sm"
                    onClick={() => clockOut.mutate()}
                    isLoading={clockOut.isPending}
                    startContent={<LogOut className="h-4 w-4" />}
                  >
                    {t('shifts.clockOut')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tabs (admin only) */}
      {isAdmin && (
        <Tabs
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k as 'active' | 'history')}
          color="primary"
          variant="bordered"
          aria-label="Shift management tabs"
        >
          <Tab key="active" title={t('shifts.activeNow')}>
            <div className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {!activeShifts?.length ? (
                  <p className="col-span-full text-center py-12 text-muted-foreground">
                    {t('shifts.noShifts')}
                  </p>
                ) : (
                  activeShifts.map((s) => (
                    <Card key={s.id} className="border border-border bg-card shadow-sm">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-foreground">{s.user_name}</span>
                          <Badge
                            size="sm"
                            variant={s.status === 'on_break' ? 'warning' : 'success'}
                          >
                            {s.status === 'on_break' ? t('shifts.onBreak') : t('shifts.clockedIn')}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground font-data">{s.role}</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('shifts.clockIn')}: {new Date(s.clock_in).toLocaleTimeString()}
                        </p>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </Tab>

          <Tab key="history" title={t('shifts.history')}>
            <div className="pt-4">
              <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="text-start p-3 font-medium">{t('common.name')}</th>
                      <th className="text-start p-3 font-medium">{t('shifts.clockIn')}</th>
                      <th className="text-start p-3 font-medium">{t('shifts.clockOut')}</th>
                      <th className="text-end p-3 font-medium">{t('shifts.hoursWorked')}</th>
                      <th className="text-end p-3 font-medium">{t('shifts.breakDuration')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {history?.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-foreground font-medium">{s.user_name}</td>
                        <td className="p-3 font-data text-xs text-muted-foreground">
                          {new Date(s.clock_in).toLocaleString()}
                        </td>
                        <td className="p-3 font-data text-xs text-muted-foreground">
                          {s.clock_out ? new Date(s.clock_out).toLocaleString() : '—'}
                        </td>
                        <td className="p-3 text-end font-data text-foreground">
                          {formatHours(s.total_hours)}
                        </td>
                        <td className="p-3 text-end font-data text-muted-foreground">
                          {s.break_minutes}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(historyMeta?.pagination?.totalPages ?? 0) > 1 && (
                <div className="flex justify-center pt-4">
                  <Pagination
                    total={historyMeta!.pagination!.totalPages}
                    page={historyPage}
                    onChange={setHistoryPage}
                    size="sm"
                    variant="flat"
                  />
                </div>
              )}
            </div>
          </Tab>
        </Tabs>
      )}
    </div>
  );
}
