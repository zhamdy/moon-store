import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Clock, Landmark } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@heroui/react';
import { useAuthStore } from '../../auth';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport/index';
import type { RegisterSession, Shift } from '../types';

const SESSION_KEY = 'moon-startup-dismissed';

const shifts = resource<Shift>('shifts');
const register = resource<RegisterSession>('register');

export default function StartupPrompt() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const transport = useTransport();
  const [openingFloat, setOpeningFloat] = useState('');
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');

  const role = user?.role;
  const isEligible = role === 'Admin' || role === 'Cashier';

  const { data: currentShift, isLoading: shiftLoading } = shifts.useRead<Shift | null>(
    'current',
    undefined,
    isEligible && !dismissed
  );

  const { data: currentSession, isLoading: registerLoading } =
    register.useRead<RegisterSession | null>('current', undefined, isEligible && !dismissed);

  const clockInMutation = useMutation({
    mutationFn: () => transport.request({ method: 'POST', path: 'shifts/clock-in' }),
    onSuccess: () => {
      toast.success(t('startup.shiftStarted'));
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });

  const openRegisterMutation = useMutation({
    mutationFn: (float: number) =>
      transport.request({ method: 'POST', path: 'register/open', body: { opening_float: float } }),
    onSuccess: () => {
      toast.success(t('startup.registerOpened'));
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
  });

  if (!isEligible || dismissed) return null;
  if (shiftLoading || registerLoading) return null;

  const hasShift = !!currentShift;
  const hasRegister = !!currentSession;

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
    <Modal
      isOpen
      onOpenChange={() => {}}
      isDismissable={false}
      hideCloseButton
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <h3 className="text-base font-semibold">{t('startup.title')}</h3>
            </ModalHeader>

            <ModalBody className="space-y-6 py-4">
              {needsShift && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-foreground font-medium">
                      {t('startup.shiftMessage')}
                    </p>
                    <Button
                      color="primary"
                      size="sm"
                      onPress={handleClockIn}
                      isLoading={clockInMutation.isPending}
                    >
                      {t('startup.clockIn')}
                    </Button>
                  </div>
                </div>
              )}

              {!needsShift && needsRegister && (
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Landmark className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-foreground font-medium">
                      {t('startup.registerMessage')}
                    </p>
                    <Input
                      type="number"
                      label={t('startup.openingFloat')}
                      size="sm"
                      variant="bordered"
                      min="0"
                      step="0.01"
                      value={openingFloat}
                      onValueChange={setOpeningFloat}
                      placeholder="0.00"
                      className="font-data"
                    />
                    <Button
                      color="primary"
                      size="sm"
                      onPress={handleOpenRegister}
                      isLoading={openRegisterMutation.isPending}
                    >
                      {t('startup.openRegister')}
                    </Button>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="border-t border-border/50">
              <Button variant="light" size="sm" onPress={handleSkip}>
                {t('startup.skip')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
