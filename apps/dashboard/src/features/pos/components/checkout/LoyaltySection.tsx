/**
 * Spending loyalty points on this sale.
 *
 * The cap (`maxPoints`) and the resulting discount are computed by
 * `useCheckoutPricing`; this control only reads them and clamps the cashier's
 * typing to the cap. Extracted from CartPanel (issue #51); markup unchanged.
 */
import { Input } from '@heroui/react';
import { Star } from 'lucide-react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Totals } from '../../../../shared/lib/checkout';
import type { LoyaltyState } from '../../hooks/useCheckoutPricing';

export default function LoyaltySection({
  loyalty,
  totals,
  maxPoints,
  redeemPoints,
  pointsToRedeem,
  setRedeemPoints,
  setPointsToRedeem,
}: {
  loyalty: LoyaltyState;
  totals: Totals;
  maxPoints: number;
  redeemPoints: boolean;
  pointsToRedeem: number;
  setRedeemPoints: (on: boolean) => void;
  setPointsToRedeem: (points: number) => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 text-primary" />
        {t('loyalty.redeemPoints')}
      </h3>
      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/50">
        <div>
          <p className="text-sm font-medium text-foreground">{t('loyalty.points')}</p>
          <p className="text-base font-bold text-primary font-data">{loyalty.customerPoints}</p>
        </div>
        {loyalty.customerPoints > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="redeem-toggle" className="text-xs text-muted-foreground cursor-pointer">
              {t('loyalty.redeemToggle')}
            </label>
            <input
              id="redeem-toggle"
              type="checkbox"
              checked={redeemPoints}
              onChange={(e) => {
                setRedeemPoints(e.target.checked);
                if (!e.target.checked) setPointsToRedeem(0);
              }}
              className="accent-primary h-4 w-4 rounded"
            />
          </div>
        )}
      </div>
      {redeemPoints && loyalty.customerPoints > 0 && (
        <div className="space-y-2">
          <Input
            type="number"
            label={t('loyalty.pointsToRedeem')}
            min="0"
            size="sm"
            variant="bordered"
            max={maxPoints}
            value={pointsToRedeem ? String(pointsToRedeem) : ''}
            onValueChange={(val) => {
              const v = Math.min(Math.max(0, parseInt(val) || 0), maxPoints);
              setPointsToRedeem(v);
            }}
            className="font-data w-36"
          />
          {totals.pointsDiscount > 0 && (
            <p className="text-xs text-primary font-data font-semibold">
              = -{formatCurrency(totals.pointsDiscount)} {t('loyalty.pointsDiscount')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
