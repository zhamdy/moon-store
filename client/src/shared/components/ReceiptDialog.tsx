import { Printer } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import Receipt from './Receipt';
import { useTranslation } from '../i18n/index';
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
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="sm"
      classNames={{
        base: 'bg-card text-card-foreground border border-border max-w-sm receipt-dialog',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="no-print border-b border-border/50 text-base font-semibold">
              {t('receipt.title')}
            </ModalHeader>
            <ModalBody className="max-h-[70vh] overflow-y-auto p-4">
              <Receipt data={data} />
            </ModalBody>
            <ModalFooter className="flex gap-2 justify-end no-print border-t border-border/50">
              <Button variant="flat" size="sm" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                startContent={<Printer className="h-4 w-4" />}
              >
                {t('common.print')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
