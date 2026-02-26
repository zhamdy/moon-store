import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Clock, Landmark } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import api from '../services/api';

const SESSION_KEY = 'moon-startup-dismissed';

export default function StartupPrompt() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState('');
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  const role = user?.role;
  const isEligible = role === 'Admin' || role === 'Cashier';

  const { data: shiftData, isLoading: shiftLoading } = useQuery({
    queryKey: ['shift-current'],
    queryFn: () => api.get('/api/v1/shifts/current').then((r) => r.data),
    enabled: isEligible && !dismissed,
    retry: false,
  });

  const { data: registerData, isLoading: registerLoading } = useQuery({
    queryKey: ['register-current'],
    queryFn: () => api.get('/api/v1/register/current').then((r) => r.data),
    enabled: isEligible && !dismissed,
    retry: false,
  });

  const clockInMutation = useMutation({
    mutationFn: () => api.post('/api/v1/shifts/clock-in'),
    onSuccess: () => {
      toast.success(t('startup.shiftStarted'));
      queryClient.invalidateQueries({ queryKey: ['shift-current'] });
    },
  });

  const openRegisterMutation = useMutation({
    mutationFn: (float: number) => api.post('/api/v1/register/open', { opening_float: float }),
    onSuccess: () => {
      toast.success(t('startup.registerOpened'));
      queryClient.invalidateQueries({ queryKey: ['register-current'] });
    },
  });

  if (!isEligible || dismissed) return null;
  if (shiftLoading || registerLoading) return null;

  const hasShift = !!shiftData?.data;
  const hasRegister = !!registerData?.data;

  if (hasShift && hasRegister) return null;

  const needsShift = !hasShift;
  const needsRegister = !hasRegister;

  const handleSkip = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  };

  const handleClockIn = () => {
    clockInMutation.mutate();
  };

  const handleOpenRegister = () => {
    const float = parseFloat(openingFloat) || 0;
    openRegisterMutation.mutate(float);
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">{t('startup.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('startup.title')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {needsShift && (
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground font-medium">{t('startup.shiftMessage')}</p>
                <Button
                  onClick={handleClockIn}
                  disabled={clockInMutation.isPending}
                  className="bg-gold hover:bg-gold-dark text-white"
                >
                  {t('startup.clockIn')}
                </Button>
              </div>
            </div>
          )}

          {!needsShift && needsRegister && (
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                <Landmark className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm text-foreground font-medium">
                  {t('startup.registerMessage')}
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-muted">{t('startup.openingFloat')}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="0.00"
                    className="font-data"
                  />
                </div>
                <Button
                  onClick={handleOpenRegister}
                  disabled={openRegisterMutation.isPending}
                  className="bg-gold hover:bg-gold-dark text-white"
                >
                  {t('startup.openRegister')}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleSkip}>
            {t('startup.skip')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
