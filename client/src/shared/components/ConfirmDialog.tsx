import type { ReactNode } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { useTranslation } from '../i18n/index';

interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'danger' | 'primary' | 'secondary' | 'success' | 'warning' | 'default';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  open,
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  confirmColor = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const modalOpen = isOpen !== undefined ? isOpen : (open ?? false);

  const handleClose = () => {
    if (onCancel) onCancel();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Modal
      isOpen={modalOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
        header: 'border-b border-border/50 pb-3',
        footer: 'border-t border-border/50 pt-3',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="text-base font-semibold">{title}</ModalHeader>
            {description && (
              <ModalBody className="text-sm text-muted-foreground py-4">{description}</ModalBody>
            )}
            <ModalFooter className="gap-2">
              <Button variant="flat" size="sm" isDisabled={isLoading} onClick={handleClose}>
                {cancelText || t('common.cancel')}
              </Button>
              <Button color={confirmColor} size="sm" isLoading={isLoading} onClick={handleConfirm}>
                {confirmText || t('common.confirm')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
