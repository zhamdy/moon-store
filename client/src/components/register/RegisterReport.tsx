import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../lib/utils';
import type { RegisterReportData } from '../../hooks/useRegisterData';

interface RegisterReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportData: RegisterReportData | null;
}

export default function RegisterReport({ open, onOpenChange, reportData }: RegisterReportProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('register.report')}</DialogTitle>
          <DialogDescription>
            {reportData?.session.cashier_name} —{' '}
            {reportData && new Date(reportData.session.opened_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        {reportData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-surface">
                <span className="text-xs text-muted">{t('register.totalSales')}</span>
                <p className="text-lg font-data font-bold">
                  {formatCurrency(reportData.summary.total_sales)}
                </p>
                <span className="text-xs text-muted">
                  {reportData.summary.sale_count} {t('register.saleCount').toLowerCase()}
                </span>
              </div>
              <div className="p-3 rounded-md bg-surface">
                <span className="text-xs text-muted">{t('register.totalRefunds')}</span>
                <p className="text-lg font-data font-bold text-red-500">
                  {formatCurrency(reportData.summary.total_refunds)}
                </p>
                <span className="text-xs text-muted">
                  {reportData.summary.refund_count} refunds
                </span>
              </div>
              <div className="p-3 rounded-md bg-surface">
                <span className="text-xs text-muted">{t('register.totalCashIn')}</span>
                <p className="text-lg font-data font-bold text-emerald-500">
                  {formatCurrency(reportData.summary.total_cash_in)}
                </p>
              </div>
              <div className="p-3 rounded-md bg-surface">
                <span className="text-xs text-muted">{t('register.totalCashOut')}</span>
                <p className="text-lg font-data font-bold text-red-500">
                  {formatCurrency(reportData.summary.total_cash_out)}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-gold/5 border border-gold/20">
              <div className="flex justify-between text-sm">
                <span>{t('register.openingFloat')}</span>
                <span className="font-data">
                  {formatCurrency(reportData.session.opening_float)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>{t('register.expectedCash')}</span>
                <span className="font-data font-bold">
                  {formatCurrency(reportData.session.expected_cash)}
                </span>
              </div>
              {reportData.session.counted_cash !== null && (
                <>
                  <div className="flex justify-between text-sm mt-1">
                    <span>{t('register.countedCash')}</span>
                    <span className="font-data">
                      {formatCurrency(reportData.session.counted_cash)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 font-bold">
                    <span>{t('register.variance')}</span>
                    <span
                      className={`font-data ${
                        (reportData.session.variance || 0) >= 0
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(Math.abs(reportData.session.variance || 0))}{' '}
                      {(reportData.session.variance || 0) >= 0
                        ? t('register.over')
                        : t('register.short')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Movements list */}
            {reportData.movements.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('register.movements')}</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {reportData.movements.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs p-2 rounded bg-surface"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            m.type === 'sale' || m.type === 'cash_in' ? 'default' : 'destructive'
                          }
                          className="text-[10px]"
                        >
                          {m.type}
                        </Badge>
                        {m.note && <span className="text-muted">{m.note}</span>}
                      </div>
                      <span className="font-data font-medium">
                        {m.type === 'sale' || m.type === 'cash_in' ? '+' : '-'}
                        {formatCurrency(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
