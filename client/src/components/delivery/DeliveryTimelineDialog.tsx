import { History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import StatusBadge from '../StatusBadge';
import { formatDateTime } from '../../lib/utils';
import { useTranslation } from '../../i18n';

import type { StatusHistoryEntry } from '../../hooks/useDeliveryData';

interface DeliveryTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  history: StatusHistoryEntry[] | undefined;
}

export default function DeliveryTimelineDialog({
  open,
  onOpenChange,
  orderNumber,
  history,
}: DeliveryTimelineDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('deliveries.statusTimeline')} — {orderNumber}
          </DialogTitle>
          <DialogDescription>{t('deliveries.statusTimeline')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-0">
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
                          ? 'border-destructive bg-destructive'
                          : isLast
                            ? 'border-gold bg-gold'
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
                          by {entry.changed_by_name}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
