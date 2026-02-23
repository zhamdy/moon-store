import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import Receipt from './Receipt';
import { useTranslation } from '../i18n';
import type { ReceiptData } from './Receipt';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

export default function ReceiptDialog({ open, onOpenChange, data }: ReceiptDialogProps) {
  const { t } = useTranslation();

  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm receipt-dialog">
        <DialogHeader className="no-print">
          <DialogTitle>{t('receipt.title')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <Receipt data={data} />
        </div>
        <div className="flex gap-2 justify-end no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            {t('common.print')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
