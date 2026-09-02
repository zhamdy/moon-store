/**
 * The checkout drawer: review the sale, attach a customer, redeem points,
 * apply a coupon, adjust discount/tip/notes, choose how it is paid, confirm.
 *
 * It composes the focused sections around it and holds no financial state of
 * its own — `pricing` is the single authority for every figure shown here.
 * Extracted from CartPanel (issue #51); markup and ordering unchanged.
 */
import {
  Button,
  Input,
  Divider,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from '@heroui/react';
import { Percent, StickyNote, Ticket, X } from 'lucide-react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { DiscountType } from '../../../../shared/lib/checkout';
import type { CheckoutPricing } from '../../hooks/useCheckoutPricing';
import type { CouponApplication } from '../../hooks/useCouponApplication';
import type { CustomerSelection } from '../../hooks/useCustomerSelection';
import type { CartItem } from '../../store/cartStore';
import type { PaymentEntry, PaymentMethod } from '../../types';
import CheckoutSummary from './CheckoutSummary';
import CustomerSection from './CustomerSection';
import LoyaltySection from './LoyaltySection';
import PaymentSection from './PaymentSection';

const QUICK_DISCOUNT_PRESETS = [5, 10, 15];

export default function CheckoutDrawer({
  isOpen,
  onOpenChange,
  isRtl,
  items,
  discount,
  discountType,
  setDiscount,
  setDiscountType,
  notes,
  setNotes,
  tip,
  setTip,
  couponCode,
  couponDiscount,
  coupon,
  pricing,
  customer,
  onRemoveCustomer,
  paymentMethod,
  setPaymentMethod,
  splitPayment,
  setSplitPayment,
  payments,
  setPayments,
  onConfirm,
  isPending,
  needsReview,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isRtl: boolean;
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  setDiscount: (value: number) => void;
  setDiscountType: (type: DiscountType) => void;
  notes: string;
  setNotes: (notes: string) => void;
  tip: number;
  setTip: (tip: number) => void;
  couponCode: string;
  couponDiscount: number;
  coupon: CouponApplication;
  pricing: CheckoutPricing;
  customer: CustomerSelection;
  onRemoveCustomer: () => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  splitPayment: boolean;
  setSplitPayment: (on: boolean) => void;
  payments: PaymentEntry[];
  setPayments: (payments: PaymentEntry[]) => void;
  onConfirm: () => void;
  isPending: boolean;
  needsReview: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { tax, loyalty, totals, split, maxPoints } = pricing;

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement={isRtl ? 'left' : 'right'}
      backdrop="blur"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border-s border-border shadow-2xl',
      }}
    >
      <DrawerContent>
        {() => (
          <>
            <DrawerHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">{t('cart.completeSale')}</h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('cart.reviewSale')}
                </p>
              </div>
            </DrawerHeader>
            <DrawerBody className="py-6 space-y-6 overflow-y-auto">
              <CheckoutSummary
                items={items}
                discount={discount}
                discountType={discountType}
                couponCode={couponCode}
                tax={tax}
                totals={totals}
              />

              <Divider />

              <CustomerSection
                customer={customer}
                loyalty={loyalty}
                onRemoveSelected={onRemoveCustomer}
              />

              {loyalty.enabled && customer.selected && (
                <>
                  <Divider />
                  <LoyaltySection
                    loyalty={loyalty}
                    totals={totals}
                    maxPoints={maxPoints}
                    redeemPoints={pricing.redeemPoints}
                    pointsToRedeem={pricing.pointsToRedeem}
                    setRedeemPoints={pricing.setRedeemPoints}
                    setPointsToRedeem={pricing.setPointsToRedeem}
                  />
                </>
              )}

              {/* Coupon */}
              <Divider />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 text-primary" />
                  {t('cart.coupon')}
                </h3>
                {couponCode ? (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/30">
                    <div>
                      <p className="text-sm font-bold font-data text-foreground">{couponCode}</p>
                      <p className="text-xs text-primary font-data">
                        -{formatCurrency(couponDiscount)}
                      </p>
                    </div>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      className="h-7 w-7"
                      onClick={coupon.remove}
                      aria-label="Remove coupon"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      size="sm"
                      variant="bordered"
                      placeholder={t('cart.couponPlaceholder')}
                      value={coupon.input}
                      onValueChange={coupon.setInput}
                      className="flex-1"
                    />
                    <Button variant="bordered" size="sm" onClick={coupon.apply}>
                      {t('cart.applyCoupon')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick Discount -- writes ONLY into the manual discount/discount_type
                  state, never `tip`. This is the fix for the historical bug
                  where these buttons silently wrote a "discount" amount
                  into the tip field (see Unit 3/5 of
                  docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md). */}
              <Divider />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  {t('cart.quickDiscount')}
                </h3>
                <div className="flex gap-1.5 items-center">
                  {QUICK_DISCOUNT_PRESETS.map((pct) => (
                    <Button
                      key={pct}
                      size="sm"
                      variant={
                        discountType === 'percentage' && discount === pct ? 'solid' : 'bordered'
                      }
                      color={
                        discountType === 'percentage' && discount === pct ? 'primary' : 'default'
                      }
                      className="flex-1 h-7 min-w-0 text-[11px] font-data font-medium"
                      onClick={() => {
                        setDiscountType('percentage');
                        setDiscount(pct);
                      }}
                    >
                      {pct}%
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : undefined}
                    step="0.01"
                    size="sm"
                    variant="bordered"
                    placeholder={t('cart.customAmount')}
                    aria-label={t('cart.quickDiscount')}
                    value={discountType === 'percentage' && discount ? String(discount) : ''}
                    onValueChange={(val) => {
                      setDiscountType('percentage');
                      setDiscount(parseFloat(val) || 0);
                    }}
                    className="flex-1 font-data"
                  />
                </div>
              </div>

              {/* Tip -- its own, separately labeled, always-positive control.
                  Never written to by Quick Discount above. Rendered as an
                  added line (`+`) in the summary and in the receipt. */}
              <Divider />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5 text-primary" />
                  {t('cart.tip')}
                </h3>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  size="sm"
                  variant="bordered"
                  placeholder={t('cart.customTip')}
                  aria-label={t('cart.tip')}
                  value={tip ? String(tip) : ''}
                  onValueChange={(val) => setTip(Math.max(0, parseFloat(val) || 0))}
                  className="font-data"
                />
              </div>

              {/* Sale Notes */}
              <Divider />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5 text-primary" />
                  {t('cart.notes')}
                </h3>
                <textarea
                  placeholder={t('cart.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  maxLength={500}
                />
              </div>

              <Divider />

              <PaymentSection
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                splitPayment={splitPayment}
                setSplitPayment={setSplitPayment}
                payments={payments}
                setPayments={setPayments}
                split={split}
                totals={totals}
              />

              {/* `shrink-0` is load-bearing, not cosmetic. This button is the last child
                  of a flex-column DrawerBody, and once the drawer's content is taller
                  than the viewport the default `flex-shrink: 1` compresses it to zero
                  height — leaving a cashier unable to complete a sale on any screen
                  under roughly 1000px tall. Covered by checkout-cash.spec.ts. */}
              <Button
                color="primary"
                size="md"
                className="w-full shrink-0 font-semibold shadow-sm"
                onClick={onConfirm}
                isDisabled={isPending || needsReview || (splitPayment && !split.isBalanced)}
                isLoading={isPending}
              >
                {isPending ? t('cart.processing') : t('cart.confirmSale')}
              </Button>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
