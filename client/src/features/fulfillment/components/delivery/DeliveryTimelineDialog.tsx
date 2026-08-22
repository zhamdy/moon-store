import { History } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, Pagination } from '@heroui/react';
import StatusBadge from '../../../../shared/components/StatusBadge';
import { formatDateTime } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';

import type { DeliveryStatusHistoryEntry } from '../../types';

interface DeliveryTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  history: DeliveryStatusHistoryEntry[] | undefined;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function DeliveryTimelineDialog({
  open,
  onOpenChange,
  orderNumber,
  history,
  page,
  totalPages,
  onPageChange,
}: DeliveryTimelineDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  {t('deliveries.statusTimeline')} — {orderNumber}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('deliveries.statusTimeline')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-5">
              {history && history.length > 0 ? (
                <div className="relative ps-6">
                  <div className="absolute start-[11px] top-2 bottom-2 w-0.5 bg-border" />
                  {history.map((entry, idx) => {
                    const isLast = idx === history.length - 1;
                    const isCancelled = entry.status === 'Cancelled';
                    return (
                      <div key={entry.id} className="relative pb-6 last:pb-0">
                        <div
                          className={`absolute start-[-13px] top-1 h-3 w-3 rounded-full border-2 ${
                            isCancelled
                              ? 'border-danger bg-danger'
                              : isLast
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground bg-muted-foreground'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={entry.status} />
                            <span className="text-xs text-muted-foreground font-data">
                              {formatDateTime(entry.created_at)}
                            </span>
                          </div>
                          {entry.changed_by_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t('deliveries.byUser', { name: entry.changed_by_name })}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-sm mt-1 text-foreground/80">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('common.noResults')}
                </p>
              )}
              {totalPages > 1 && (
                <Pagination page={page} total={totalPages} onChange={onPageChange} showControls />
              )}
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
