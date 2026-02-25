import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useTranslation } from '../../i18n';

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            onSubmit(movementType, Number(amount) || 0, note || undefined);
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>{t('register.amount')}</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <Label>{t('register.note')}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('register.notePlaceholder')}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('common.confirm')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
