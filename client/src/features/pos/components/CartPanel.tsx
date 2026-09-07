/**
 * The cart panel: the cashier's view of what is being sold, and the entry
 * point to checkout.
 *
 * This component coordinates focused units rather than containing their rules
 * (issue #51). Specifically:
 *
 * - `useCheckoutPricing` is the ONE authority for every checkout figure —
 *   totals, the split allocation, the loyalty cap and the redemption state.
 *   Nothing here re-derives a money value.
 * - `useCheckoutSubmission` owns keying, posting, the receipt and the offline
 *   fallback.
 * - `useCustomerSelection` and `useCouponApplication` own their own flows.
 * - `useCustomerDisplayBroadcast` mirrors the same totals to the second screen.
 * - The rendering lives in `components/checkout/*`, which is presentation only.
 */
import { useState, useEffect, type MutableRefObject } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { ShoppingBag, Pause, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react';
import { useCartStore } from '../store/cartStore';
import { useHeldCartsStore } from '../store/heldCartsStore';
import { useTranslation } from '../../../shared/i18n/index';
import ReceiptDialog from '../../../shared/components/ReceiptDialog';
import HeldCartsDialog from './HeldCartsDialog';
import CartFooter from './checkout/CartFooter';
import CartLineItem from './checkout/CartLineItem';
import CheckoutDrawer from './checkout/CheckoutDrawer';
import { useCheckoutPricing } from '../hooks/useCheckoutPricing';
import { useCheckoutSubmission } from '../hooks/useCheckoutSubmission';
import { useCouponApplication } from '../hooks/useCouponApplication';
import { useCustomerDisplayBroadcast } from '../hooks/useCustomerDisplayBroadcast';
import { useCustomerSelection } from '../hooks/useCustomerSelection';
import { lineKey } from '../lib/cartLines';
import type { SaleComposition } from '../lib/salePayload';
import type { PaymentEntry, PaymentMethod } from '../types';

interface CartPanelProps {
  checkoutTriggerRef?: MutableRefObject<(() => void) | null>;
}

export default function CartPanel({ checkoutTriggerRef }: CartPanelProps = {}): React.JSX.Element {
  const {
    items,
    discount,
    discountType,
    notes,
    tip,
    couponCode,
    couponDiscount,
    removeItem,
    updateQuantity,
    setItemMemo,
    setDiscount,
    setDiscountType,
    setNotes,
    setTip,
    clearCart,
    needsReview,
    acknowledgeReview,
  } = useCartStore();
  const { carts: heldCarts, holdCart } = useHeldCartsStore();
  const { t, isRtl } = useTranslation();
  const [animateParent] = useAutoAnimate();

  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [heldCartsOpen, setHeldCartsOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [splitPayment, setSplitPayment] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [editingMemo, setEditingMemo] = useState<string | null>(null);

  // Customer search/selection/creation -- UI state only; the sale carries the
  // selected customer's id, and their loyalty balance is fetched by
  // useCheckoutPricing below.
  const customer = useCustomerSelection({ searchEnabled: checkoutOpen });

  // ONE authoritative owner of every checkout figure.
  const pricing = useCheckoutPricing({ customerId: customer.selected?.id ?? null, payments });
  const { tax, totals, resetRedemption } = pricing;

  const coupon = useCouponApplication({
    subtotal: totals.subtotal,
    productIds: items.map((i) => i.product_id),
    customerId: customer.selected?.id ?? null,
  });

  useCustomerDisplayBroadcast({ items, discount, discountType, couponCode, tax, totals });

  useEffect(() => {
    if (checkoutTriggerRef) {
      checkoutTriggerRef.current = () => setCheckoutOpen(true);
    }
    return () => {
      if (checkoutTriggerRef) checkoutTriggerRef.current = null;
    };
  }, [checkoutTriggerRef]);

  /**
   * The single description of "what the cashier is about to sell", from which
   * BOTH the online body and the reduced offline-queue body are composed. One
   * source, so the two can never drift apart the way two inline literals could.
   */
  const composition: SaleComposition = {
    items,
    discount,
    discountType,
    notes,
    tip,
    couponCode,
    paymentMethod,
    splitPayment,
    payments,
    customerId: customer.selected?.id ?? null,
    pointsToRedeem: pricing.redeemPoints ? pricing.pointsToRedeem : 0,
  };

  // Submission lifecycle: keying, posting, the receipt, and the offline
  // fallback. `onCheckoutSettled` is the surrounding UI's reset, run once the
  // sale is committed or queued -- never after a failure the cashier retries.
  const { submit, isPending, stockConflict, receiptOpen, setReceiptOpen, receiptData } =
    useCheckoutSubmission({
      tax,
      customerName: customer.selected?.name,
      onCheckoutSettled: () => {
        setCheckoutOpen(false);
        customer.reset();
        resetRedemption();
      },
    });

  const handleCheckout = (): void => {
    // A recovered/restored cart is not fully trusted for checkout until the
    // cashier explicitly acknowledges its review banner (Unit 6's
    // `needsReview`/`acknowledgeReview`) -- enforced here too, not just via
    // the disabled footer button, since a keyboard shortcut can open the
    // checkout drawer directly.
    if (items.length === 0 || needsReview) return;

    submit(composition);
  };

  const handleHoldCart = () => {
    if (items.length === 0) return;
    const name = `Cart #${heldCarts.length + 1}`;
    // couponDiscount is deliberately NOT passed through -- a held cart never
    // stores a cached discount amount; it must be revalidated on retrieval
    // (see heldCartsStore.ts / cartStore.restoreFromHeld).
    holdCart(name, items, discount, discountType, { notes, tip, couponCode });
    clearCart();
    toast.success(t('cart.holdSuccess'));
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-300px)] bg-card border border-border rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <h2 className="font-semibold text-base tracking-tight flex items-center gap-2 text-foreground">
          <ShoppingBag className="h-4 w-4 text-primary" />
          {t('cart.title')} ({items.length})
        </h2>
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="h-8 w-8"
            onPress={handleHoldCart}
            isDisabled={items.length === 0}
            title={t('cart.hold')}
            aria-label={t('cart.hold')}
          >
            <Pause className="h-4 w-4 text-primary" />
          </Button>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="h-8 w-8 relative"
            onPress={() => setHeldCartsOpen(true)}
            title={t('cart.heldCarts')}
            aria-label={t('cart.heldCarts')}
          >
            <Archive className="h-4 w-4 text-primary" />
            {heldCarts.length > 0 && (
              <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                {heldCarts.length}
              </span>
            )}
          </Button>
          {items.length > 0 && (
            <Button
              variant="light"
              color="danger"
              size="sm"
              className="h-8 text-xs ms-1"
              onPress={clearCart}
            >
              {t('cart.clearAll')}
            </Button>
          )}
        </div>
      </div>

      {/* Recovered/restored cart review banner (Unit 6 cart-schema migration --
          see cartStore.ts's `needsReview`). Distinct from POS.tsx's
          time-based `isRecoveredCart()` banner: this one is set explicitly by
          a v0->v1 migration or a held-cart restore, and is cleared only by
          the cashier acknowledging it. */}
      {needsReview && (
        <div className="mx-4 mt-3 p-3 rounded-lg border border-warning/40 bg-warning/10 flex items-start gap-2">
          <p className="text-xs text-foreground flex-1">{t('cart.needsReviewWarning')}</p>
          <Button size="sm" variant="flat" color="warning" onPress={acknowledgeReview}>
            {t('cart.needsReviewAcknowledge')}
          </Button>
        </div>
      )}

      {/* Items */}
      <div ref={animateParent} className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{t('cart.empty')}</p>
          </div>
        ) : (
          items.map((item) => (
            <CartLineItem
              key={lineKey(item)}
              item={item}
              isEditingMemo={editingMemo === lineKey(item)}
              onStartEditingMemo={() => setEditingMemo(lineKey(item))}
              onCommitMemo={(memo) => {
                setItemMemo(item.product_id, memo, item.variant_id);
                setEditingMemo(null);
              }}
              onQuantityChange={(quantity) =>
                updateQuantity(item.product_id, quantity, item.variant_id)
              }
              onRemove={() => removeItem(item.product_id, item.variant_id)}
            />
          ))
        )}
      </div>

      <CartFooter
        discount={discount}
        discountType={discountType}
        setDiscount={setDiscount}
        setDiscountType={setDiscountType}
        tax={tax}
        totals={totals}
        checkoutDisabled={items.length === 0 || needsReview}
        onCheckout={() => setCheckoutOpen(true)}
      />

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />
      <HeldCartsDialog open={heldCartsOpen} onOpenChange={setHeldCartsOpen} />

      <CheckoutDrawer
        isOpen={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        isRtl={isRtl}
        items={items}
        discount={discount}
        discountType={discountType}
        setDiscount={setDiscount}
        setDiscountType={setDiscountType}
        notes={notes}
        setNotes={setNotes}
        tip={tip}
        setTip={setTip}
        couponCode={couponCode}
        couponDiscount={couponDiscount}
        coupon={coupon}
        pricing={pricing}
        customer={customer}
        onRemoveCustomer={() => {
          customer.clear();
          resetRedemption();
        }}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        splitPayment={splitPayment}
        setSplitPayment={setSplitPayment}
        payments={payments}
        setPayments={setPayments}
        onConfirm={handleCheckout}
        isPending={isPending}
        needsReview={needsReview}
        stockConflict={stockConflict}
      />
    </div>
  );
}
