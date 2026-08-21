import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@heroui/react';
import { useTranslation } from '../../../../shared/i18n/index';

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (type: 'cash_in' | 'cash_out', amount: number, note?: string) => void;
  isSubmitting: boolean;
  movementType: 'cash_in' | 'cash_out';
}

export default function CashMovementDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  movementType,
}: CashMovementDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAmount('');
      setNote('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={handleOpenChange}
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(movementType, Number(amount) || 0, note || undefined);
            }}
          >
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">
                  {movementType === 'cash_in' ? t('register.cashIn') : t('register.cashOut')}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('register.notePlaceholder')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4 space-y-4">
              <Input
                type="number"
                label={t('register.amount')}
                size="sm"
                variant="bordered"
                min="0.01"
                step="0.01"
                value={amount}
                onValueChange={setAmount}
                autoFocus
                isRequired
              />
              <Input
                label={t('register.note')}
                size="sm"
                variant="bordered"
                value={note}
                onValueChange={setNote}
                placeholder={t('register.notePlaceholder')}
              />
            </ModalBody>
            <ModalFooter className="border-t border-border/50">
              <Button variant="flat" size="sm" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" color="primary" size="sm" isLoading={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('common.confirm')}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
