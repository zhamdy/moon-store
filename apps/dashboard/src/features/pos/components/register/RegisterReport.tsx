import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Badge } from '../../../../shared';
import { useTranslation } from '../../../../shared/i18n/index';
import { formatCurrency } from '../../../../shared/lib/utils';
import type { RegisterReportData } from '../../types';

interface RegisterReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportData: RegisterReportData | null;
}

export default function RegisterReport({ open, onOpenChange, reportData }: RegisterReportProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="lg"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">{t('register.report')}</h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {reportData?.session.cashier_name} —{' '}
                  {reportData && new Date(reportData.session.opened_at).toLocaleString()}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4">
              {reportData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {t('register.totalSales')}
                      </span>
                      <p className="text-lg font-data font-bold text-foreground">
                        {formatCurrency(reportData.summary.total_sales)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {reportData.summary.sale_count} {t('register.saleCount').toLowerCase()}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {t('register.totalRefunds')}
                      </span>
                      <p className="text-lg font-data font-bold text-danger">
                        {formatCurrency(reportData.summary.total_refunds)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {reportData.summary.refund_count} refunds
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {t('register.totalCashIn')}
                      </span>
                      <p className="text-lg font-data font-bold text-success">
                        {formatCurrency(reportData.summary.total_cash_in)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {t('register.totalCashOut')}
                      </span>
                      <p className="text-lg font-data font-bold text-danger">
                        {formatCurrency(reportData.summary.total_cash_out)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('register.openingFloat')}</span>
                      <span className="font-data text-foreground">
                        {formatCurrency(reportData.session.opening_float)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">{t('register.expectedCash')}</span>
                      <span className="font-data font-bold text-foreground">
                        {formatCurrency(reportData.session.expected_cash)}
                      </span>
                    </div>
                    {reportData.session.counted_cash !== null && (
                      <>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">{t('register.countedCash')}</span>
                          <span className="font-data text-foreground">
                            {formatCurrency(reportData.session.counted_cash)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1 font-bold">
                          <span>{t('register.variance')}</span>
                          <span
                            className={`font-data ${
                              (reportData.session.variance || 0) >= 0
                                ? 'text-success'
                                : 'text-danger'
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
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {t('register.movements')}
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {reportData.movements.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-muted/20 border border-border/50"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                size="sm"
                                variant={
                                  m.type === 'sale' || m.type === 'cash_in' ? 'success' : 'danger'
                                }
                              >
                                {m.type}
                              </Badge>
                              {m.note && <span className="text-muted-foreground">{m.note}</span>}
                            </div>
                            <span className="font-data font-medium text-foreground">
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
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
