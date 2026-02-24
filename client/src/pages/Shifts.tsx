import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, Coffee, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  error?: string;
}

interface Shift {
  id: number;
  user_id: number;
  user_name: string;
  role?: string;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'on_break' | 'completed';
  total_hours: number | null;
  break_minutes: number;
}

interface TimesheetEntry {
  id: number;
  name: string;
  role: string;
  shift_count: number;
  total_hours: number;
  total_break_minutes: number;
}

export default function ShiftsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'my' | 'active' | 'history' | 'timesheet'>('my');

  const isAdmin = user?.role === 'Admin';

  // Current shift
  const { data: currentShift } = useQuery<Shift | null>({
    queryKey: ['shifts', 'current'],
    queryFn: () => api.get('/api/shifts/current').then((r) => r.data.data),
  });

  // Active shifts (admin)
  const { data: activeShifts } = useQuery<Shift[]>({
    queryKey: ['shifts', 'active'],
    queryFn: () => api.get('/api/shifts/active').then((r) => r.data.data),
    enabled: isAdmin && tab === 'active',
  });

  // History (admin)
  const { data: historyData } = useQuery<{ data: Shift[]; meta: { total: number } }>({
    queryKey: ['shifts', 'history'],
    queryFn: () =>
      api
        .get('/api/shifts/history?limit=50')
        .then((r) => ({ data: r.data.data, meta: r.data.meta })),
    enabled: isAdmin && tab === 'history',
  });

  // Timesheet (admin)
  const { data: timesheet } = useQuery<TimesheetEntry[]>({
    queryKey: ['shifts', 'timesheet'],
    queryFn: () => api.get('/api/shifts/timesheet').then((r) => r.data.data),
    enabled: isAdmin && tab === 'timesheet',
  });

  const clockIn = useMutation({
    mutationFn: () => api.post('/api/shifts/clock-in'),
    onSuccess: () => {
      toast.success(t('shifts.clockedIn'));
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const clockOut = useMutation({
    mutationFn: () => api.post('/api/shifts/clock-out'),
    onSuccess: () => {
      toast.success(t('shifts.clockedOut'));
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const startBreak = useMutation({
    mutationFn: () => api.post('/api/shifts/start-break'),
    onSuccess: () => {
      toast.success(t('shifts.onBreak'));
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const endBreak = useMutation({
    mutationFn: () => api.post('/api/shifts/end-break'),
    onSuccess: () => {
      toast.success(t('shifts.breakEnded'));
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || 'Error'),
  });

  const formatHours = (h: number | null) => {
    if (h === null || h === undefined) return '—';
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('shifts.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
      </div>

      {/* My shift status */}
      <div className="mb-6">
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium mb-1">{user?.name}</h3>
                {currentShift ? (
                  <div className="flex items-center gap-2">
                    <Badge variant={currentShift.status === 'on_break' ? 'destructive' : 'default'}>
                      {currentShift.status === 'on_break'
                        ? t('shifts.onBreak')
                        : t('shifts.clockedIn')}
                    </Badge>
                    <span className="text-sm text-muted font-data">
                      {new Date(currentShift.clock_in).toLocaleTimeString()}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted">{t('shifts.noShifts')}</span>
                )}
              </div>
              <div className="flex gap-2">
                {!currentShift ? (
                  <Button
                    onClick={() => clockIn.mutate()}
                    disabled={clockIn.isPending}
                    className="gap-2"
                  >
                    <LogIn className="h-4 w-4" /> {t('shifts.clockIn')}
                  </Button>
                ) : (
                  <>
                    {currentShift.status === 'active' ? (
                      <Button
                        variant="outline"
                        onClick={() => startBreak.mutate()}
                        disabled={startBreak.isPending}
                        className="gap-2"
                      >
                        <Coffee className="h-4 w-4" /> {t('shifts.startBreak')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => endBreak.mutate()}
                        disabled={endBreak.isPending}
                        className="gap-2"
                      >
                        <Play className="h-4 w-4" /> {t('shifts.endBreak')}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => clockOut.mutate()}
                      disabled={clockOut.isPending}
                      className="gap-2"
                    >
                      <LogOut className="h-4 w-4" /> {t('shifts.clockOut')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs (admin only) */}
      {isAdmin && (
        <>
          <div className="flex gap-2 mb-4 border-b border-border">
            {(['active', 'history', 'timesheet'] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t2
                    ? 'border-gold text-gold'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {t2 === 'active'
                  ? t('shifts.activeNow')
                  : t2 === 'history'
                    ? t('shifts.history')
                    : t('shifts.timesheet')}
              </button>
            ))}
          </div>

          {tab === 'active' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {!activeShifts?.length ? (
                <p className="col-span-full text-center py-12 text-muted">{t('shifts.noShifts')}</p>
              ) : (
                activeShifts.map((s) => (
                  <Card key={s.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{s.user_name}</span>
                        <Badge
                          variant={s.status === 'on_break' ? 'destructive' : 'default'}
                          className="text-[10px]"
                        >
                          {s.status === 'on_break' ? t('shifts.onBreak') : t('shifts.clockedIn')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted font-data">{s.role}</span>
                      <p className="text-xs text-muted mt-1">
                        {t('shifts.clockIn')}: {new Date(s.clock_in).toLocaleTimeString()}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="text-start p-3 font-medium text-muted">{t('common.name')}</th>
                    <th className="text-start p-3 font-medium text-muted">{t('shifts.clockIn')}</th>
                    <th className="text-start p-3 font-medium text-muted">
                      {t('shifts.clockOut')}
                    </th>
                    <th className="text-end p-3 font-medium text-muted">
                      {t('shifts.hoursWorked')}
                    </th>
                    <th className="text-end p-3 font-medium text-muted">
                      {t('shifts.breakDuration')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyData?.data.map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="p-3">{s.user_name}</td>
                      <td className="p-3 font-data text-xs">
                        {new Date(s.clock_in).toLocaleString()}
                      </td>
                      <td className="p-3 font-data text-xs">
                        {s.clock_out ? new Date(s.clock_out).toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-end font-data">{formatHours(s.total_hours)}</td>
                      <td className="p-3 text-end font-data text-muted">{s.break_minutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'timesheet' && (
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="text-start p-3 font-medium text-muted">{t('common.name')}</th>
                    <th className="text-start p-3 font-medium text-muted">{t('common.role')}</th>
                    <th className="text-end p-3 font-medium text-muted"># {t('shifts.history')}</th>
                    <th className="text-end p-3 font-medium text-muted">
                      {t('shifts.totalHours')}
                    </th>
                    <th className="text-end p-3 font-medium text-muted">
                      {t('shifts.breakDuration')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {timesheet?.map((e) => (
                    <tr key={e.id} className="border-b border-border">
                      <td className="p-3 font-medium">{e.name}</td>
                      <td className="p-3">
                        <Badge variant="gold" className="text-[10px]">
                          {e.role}
                        </Badge>
                      </td>
                      <td className="p-3 text-end font-data">{e.shift_count}</td>
                      <td className="p-3 text-end font-data">{formatHours(e.total_hours)}</td>
                      <td className="p-3 text-end font-data text-muted">
                        {e.total_break_minutes}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
