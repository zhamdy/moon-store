/**
 * What the cashier sees after a checkout the server refused on stock: which
 * line, how many were asked for, how many are left, and the one button that
 * makes the cart sellable.
 *
 * Rendered inside the drawer rather than as a toast on purpose. The cashier has
 * to read several numbers and then act on them, with a customer waiting; a
 * notification that disappears on its own is the wrong shape for that.
 */
import { Button } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../../shared/i18n/index';
import type { StockConflictRecovery } from '../../hooks/useStockConflictRecovery';

export default function StockConflictNotice({
  conflict,
}: {
  conflict: StockConflictRecovery;
}): React.JSX.Element | null {
  const { t } = useTranslation();

  if (conflict.isChecking) {
    return (
      <p className="shrink-0 text-xs text-muted-foreground">{t('cart.stockConflictChecking')}</p>
    );
  }

  if (conflict.shortfalls.length === 0) return null;

  return (
    <div
      role="alert"
      className="shrink-0 rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        {t('cart.stockConflictTitle')}
      </p>
      <ul className="space-y-1">
        {conflict.shortfalls.map((shortfall) => (
          <li
            key={`${shortfall.productId}:${shortfall.variantId ?? 0}`}
            className="text-xs text-foreground"
          >
            {t('cart.stockConflictLine', {
              name: shortfall.name,
              requested: shortfall.requested,
              available: shortfall.available,
            })}
          </li>
        ))}
      </ul>
      <Button size="sm" variant="flat" color="warning" onPress={conflict.resolve}>
        {t('cart.stockConflictAdjust')}
      </Button>
    </div>
  );
}
