import { useState, useEffect, useMemo, type MutableRefObject } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Minus,
  Plus,
  X,
  ShoppingBag,
  Search,
  UserRound,
  Tag,
  Pause,
  Archive,
  Star,
  StickyNote,
  Pencil,
  Ticket,
  Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  RadioGroup,
  Radio,
  Divider,
} from '@heroui/react';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../../../shared/store/offlineStore';
import { useHeldCartsStore } from '../store/heldCartsStore';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import ReceiptDialog from '../../../shared/components/ReceiptDialog';
import HeldCartsDialog from './HeldCartsDialog';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { calculateTotals, allocateSplit, type TaxMode } from '../../../shared/lib/checkout';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport/index';
import type { ReceiptData } from '../../../shared/components/Receipt';
import type { AppSettings, Customer } from '../../../shared/types/index';

const customers = resource<Customer>('customers');

type PaymentMethod = 'Cash' | 'Card' | 'Other';

/** Write payload for POST /api/v1/sales — not the read shape returned by GET /api/sales/:id */
interface SaleItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  memo?: string | null;
}

interface PaymentEntry {
  method: PaymentMethod | 'Gift Card';
  amount: number;
}

interface SaleData {
  items: SaleItemInput[];
  discount: number;
  discount_type: string;
  payment_method: PaymentMethod;
  payments?: PaymentEntry[];
  customer_id?: number;
  tax_amount?: number;
  points_redeemed?: number;
  notes?: string;
  tip?: number;
  coupon_code?: string;
}

interface CustomerLoyalty {
  points: number;
}

/** What POST /api/v1/sales hands back, as far as the receipt needs it. */
interface SaleResponse {
  id: number;
  items?: { product_name: string; quantity: number; unit_price: number }[];
  discount?: number;
  discount_type?: string;
  total: number;
  tax_amount?: number;
  payment_method: string;
  cashier_name?: string;
  created_at: string;
}

/** What POST /api/v1/coupons/validate hands back, as far as the cart needs it. */
interface CouponValidation {
  code: string;
  discount: number;
}

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
    setCoupon,
    clearCoupon,
    getSubtotal,
    getTotal,
    clearCart,
  } = useCartStore();
  const { addToQueue } = useOfflineStore();
  const { carts: heldCarts, holdCart } = useHeldCartsStore();
  const queryClient = useQueryClient();
  const transport = useTransport();
  const { t, isRtl } = useTranslation();
  const [animateParent] = useAutoAnimate();

  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [heldCartsOpen, setHeldCartsOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [splitPayment, setSplitPayment] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);

  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const { data: appSettings } = useApiQuery<AppSettings>(['settings'], 'settings', undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: customerLoyalty } = useApiQuery<CustomerLoyalty>(
    ['customer-loyalty', selectedCustomer?.id],
    `customers/${selectedCustomer?.id}/loyalty`,
    undefined,
    {
      enabled: !!selectedCustomer && appSettings?.loyalty_enabled === 'true',
      staleTime: 30 * 1000,
    }
  );

  const loyaltyInfo = useMemo(() => {
    const enabled = appSettings?.loyalty_enabled === 'true';
    const earnRate = parseFloat(appSettings?.loyalty_earn_rate || '1');
    const redeemValue = parseFloat(appSettings?.loyalty_redeem_value || '5');
    const customerPoints = customerLoyalty?.points || 0;
    return { enabled, earnRate, redeemValue, customerPoints };
  }, [appSettings, customerLoyalty]);

  const taxInfo = useMemo(() => {
    const enabled = appSettings?.tax_enabled === 'true';
    const rate = parseFloat(appSettings?.tax_rate || '0');
    const mode: TaxMode = appSettings?.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive';
    return { enabled: enabled && rate > 0, rate, mode };
  }, [appSettings]);

  const totals = useMemo(
    () =>
      calculateTotals({
        items,
        discount,
        discountType,
        couponDiscount,
        tax: taxInfo,
        pointsToRedeem: redeemPoints && loyaltyInfo.enabled ? pointsToRedeem : 0,
        redeemValue: loyaltyInfo.redeemValue,
        tip,
      }),
    [
      items,
      discount,
      discountType,
      couponDiscount,
      taxInfo,
      redeemPoints,
      pointsToRedeem,
      loyaltyInfo,
      tip,
    ]
  );

  const split = useMemo(() => allocateSplit(payments, totals.amountDue), [payments, totals]);

  useEffect(() => {
    if (checkoutTriggerRef) {
      checkoutTriggerRef.current = () => setCheckoutOpen(true);
    }
    return () => {
      if (checkoutTriggerRef) checkoutTriggerRef.current = null;
    };
  }, [checkoutTriggerRef]);

  const { data: customerMatches } = useApiQuery<Customer[]>(
    ['customers', { search: debouncedCustomerSearch }],
    'customers',
    { search: debouncedCustomerSearch || undefined },
    {
      enabled: checkoutOpen && debouncedCustomerSearch.length > 0,
      staleTime: 30 * 1000,
    }
  );

  const customerCreator = customers.useSave({
    message: t('cart.customerCreated'),
    fallbackMessage: t('cart.customerCreateError'),
  });

  const handleCreateCustomer = () => {
    customerCreator.save(
      { name: newCustomerName.trim(), phone: newCustomerPhone.trim() },
      {
        onSuccess: (result) => {
          setSelectedCustomer(result.data as Customer);
          setShowNewCustomer(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
        },
      }
    );
  };

  const checkoutMutation = useMutation({
    mutationFn: (saleData: SaleData) =>
      transport.request<SaleResponse>({ method: 'POST', path: 'sales', body: saleData }),
    onSuccess: (response) => {
      const sale = response.data;
      const receiptItems = (sale.items || []).map(
        (item: { product_name: string; quantity: number; unit_price: number }) => ({
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })
      );
      const subtotal = receiptItems.reduce(
        (sum: number, item: { unit_price: number; quantity: number }) =>
          sum + item.unit_price * item.quantity,
        0
      );

      const newReceipt: ReceiptData = {
        saleId: sale.id,
        items: receiptItems,
        subtotal,
        discount: sale.discount || 0,
        discountType: sale.discount_type || 'fixed',
        total: sale.total,
        taxAmount: sale.tax_amount || 0,
        taxRate: taxInfo.enabled ? taxInfo.rate : 0,
        paymentMethod: sale.payment_method,
        cashierName: sale.cashier_name || '',
        customerName: selectedCustomer?.name,
        date: sale.created_at,
      };

      toast.success(t('cart.saleSuccess'));
      clearCart();
      setCheckoutOpen(false);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setRedeemPoints(false);
      setPointsToRedeem(0);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty'] });

      setReceiptData(newReceipt);
      setReceiptOpen(true);
    },
    onError: (error: Error) => {
      if (!navigator.onLine) {
        const saleData: SaleData = {
          items: items.map((i) => ({
            product_id: i.product_id,
            ...(i.variant_id ? { variant_id: i.variant_id } : {}),
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          discount,
          discount_type: discountType,
          payment_method: paymentMethod,
          ...(selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
        };
        addToQueue({ type: 'sale', payload: saleData as unknown as Record<string, unknown> });
        toast.success(t('cart.savedOffline'));
        clearCart();
        setCheckoutOpen(false);
        setSelectedCustomer(null);
        setCustomerSearch('');
      } else {
        toast.error(error.message || t('cart.saleFailed'));
      }
    },
  });

  const handleCheckout = (): void => {
    if (items.length === 0) return;

    const saleData: SaleData = {
      items: items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        ...(i.variant_id ? { variant_id: i.variant_id } : {}),
        ...(i.memo ? { memo: i.memo } : {}),
      })),
      discount,
      discount_type: discountType,
      payment_method: splitPayment ? 'Cash' : paymentMethod,
      ...(splitPayment && payments.length > 0 ? { payments } : {}),
      ...(selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
      ...(redeemPoints && pointsToRedeem > 0 ? { points_redeemed: pointsToRedeem } : {}),
      ...(notes ? { notes } : {}),
      ...(tip > 0 ? { tip } : {}),
      ...(couponCode ? { coupon_code: couponCode } : {}),
    };

    checkoutMutation.mutate(saleData);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const { data } = await transport.request<CouponValidation>({
        method: 'POST',
        path: 'coupons/validate',
        body: {
          code: couponInput.trim(),
          subtotal: getSubtotal(),
          ...(selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
          item_product_ids: items.map((i) => i.product_id),
        },
      });
      setCoupon(data.code, data.discount);
      toast.success(t('cart.couponApplied'));
    } catch (err: unknown) {
      toast.error((err as Error).message || t('cart.couponInvalid'));
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const handleHoldCart = () => {
    if (items.length === 0) return;
    const name = `Cart #${heldCarts.length + 1}`;
    holdCart(name, items, discount, discountType);
    clearCart();
    toast.success(t('cart.holdSuccess'));
  };

  const paymentLabels: Record<PaymentMethod, string> = {
    Cash: t('cart.cash'),
    Card: t('cart.card'),
    Other: t('cart.other'),
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
            onClick={handleHoldCart}
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
            onClick={() => setHeldCartsOpen(true)}
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
              onClick={clearCart}
            >
              {t('cart.clearAll')}
            </Button>
          )}
        </div>
      </div>

      {/* Items */}
      <div ref={animateParent} className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{t('cart.empty')}</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.product_id}-${item.variant_id || 0}`}
              className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-muted/40 transition-colors rounded-lg border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <button
                    onClick={() => setEditingMemo(`${item.product_id}-${item.variant_id || 0}`)}
                    className="p-0.5 rounded hover:bg-background transition-colors"
                    title={t('cart.addMemo')}
                  >
                    <Pencil
                      className={`h-3 w-3 ${item.memo ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground font-data">
                  {formatCurrency(item.unit_price)}
                </p>
                {item.memo && <p className="text-xs text-primary/80 mt-0.5">{item.memo}</p>}
                {editingMemo === `${item.product_id}-${item.variant_id || 0}` && (
                  <Input
                    autoFocus
                    size="sm"
                    variant="bordered"
                    placeholder={t('cart.memoPlaceholder')}
                    defaultValue={item.memo || ''}
                    className="mt-1"
                    onBlur={(e) => {
                      setItemMemo(item.product_id, e.target.value, item.variant_id);
                      setEditingMemo(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setItemMemo(
                          item.product_id,
                          (e.target as HTMLInputElement).value,
                          item.variant_id
                        );
                        setEditingMemo(null);
                      }
                    }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className="h-7 w-7"
                  onClick={() =>
                    updateQuantity(item.product_id, item.quantity - 1, item.variant_id)
                  }
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5 text-primary" />
                </Button>
                <span className="w-7 text-center text-sm font-data font-medium text-foreground">
                  {item.quantity}
                </span>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className="h-7 w-7"
                  onClick={() =>
                    updateQuantity(item.product_id, item.quantity + 1, item.variant_id)
                  }
                  isDisabled={item.quantity >= item.stock}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </Button>
              </div>
              <p className="text-sm font-semibold font-data w-20 text-end text-foreground">
                {formatCurrency(item.unit_price * item.quantity)}
              </p>
              <Button
                isIconOnly
                variant="light"
                color="danger"
                size="sm"
                className="h-7 w-7"
                onClick={() => removeItem(item.product_id, item.variant_id)}
                aria-label="Remove item"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 p-4 space-y-3">
        {/* Discount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              {t('cart.discount')}
            </span>
            {discount > 0 && (
              <button
                onClick={() => setDiscount(0)}
                className="text-[10px] text-danger hover:underline transition-colors"
              >
                {t('cart.clearDiscount')}
              </button>
            )}
          </div>

          {/* Type toggle + input */}
          <div className="flex items-center gap-2">
            <div className="flex bg-muted/30 border border-border rounded-lg overflow-hidden p-0.5">
              <button
                className={`px-2.5 py-1 text-xs font-data font-medium rounded-md transition-colors ${
                  discountType === 'percentage'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (discountType === 'fixed' && discount > 0) {
                    const subtotal = getSubtotal();
                    setDiscount(
                      subtotal > 0 ? Math.round((discount / subtotal) * 100 * 100) / 100 : 0
                    );
                  }
                  setDiscountType('percentage');
                }}
              >
                %
              </button>
              <button
                className={`px-2.5 py-1 text-xs font-data font-medium rounded-md transition-colors ${
                  discountType === 'fixed'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (discountType === 'percentage' && discount > 0) {
                    const subtotal = getSubtotal();
                    setDiscount(Math.round(((subtotal * discount) / 100) * 100) / 100);
                  }
                  setDiscountType('fixed');
                }}
              >
                $
              </button>
            </div>
            <Input
              type="number"
              min="0"
              size="sm"
              variant="bordered"
              max={discountType === 'percentage' ? 100 : undefined}
              placeholder="0"
              value={discount ? String(discount) : ''}
              onValueChange={(val) => setDiscount(parseFloat(val) || 0)}
              className="flex-1 font-data"
            />
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5">
            {discountType === 'percentage'
              ? [5, 10, 15, 20].map((pct) => (
                  <Button
                    key={pct}
                    size="sm"
                    variant={discount === pct ? 'solid' : 'bordered'}
                    color={discount === pct ? 'primary' : 'default'}
                    className="flex-1 h-7 min-w-0 px-1 text-[11px] font-data font-medium"
                    onClick={() => setDiscount(pct)}
                  >
                    {pct}%
                  </Button>
                ))
              : [5, 10, 25, 50].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant={discount === amt ? 'solid' : 'bordered'}
                    color={discount === amt ? 'primary' : 'default'}
                    className="flex-1 h-7 min-w-0 px-1 text-[11px] font-data font-medium"
                    onClick={() => setDiscount(amt)}
                  >
                    ${amt}
                  </Button>
                ))}
          </div>
        </div>

        <Divider />

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm text-muted-foreground font-data">
            <span>{t('cart.subtotal')}</span>
            <span className="text-foreground">{formatCurrency(getSubtotal())}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-danger font-data">
              <span>
                {t('cart.discount')}
                <span className="text-xs ms-1 opacity-70">
                  ({discountType === 'percentage' ? `${discount}%` : formatCurrency(discount)})
                </span>
              </span>
              <span>
                -
                {formatCurrency(
                  discountType === 'percentage' ? (getSubtotal() * discount) / 100 : discount
                )}
              </span>
            </div>
          )}
          {taxInfo.enabled && (
            <div className="flex justify-between text-sm text-muted-foreground font-data">
              <span>
                {t('tax.vat')}
                <span className="text-xs ms-1 opacity-70">({taxInfo.rate}%)</span>
              </span>
              <span className="text-foreground">{formatCurrency(totals.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold font-data text-foreground">
            <span>{t('cart.total')}</span>
            <span className="text-primary font-bold">{formatCurrency(totals.totalWithTax)}</span>
          </div>
        </div>

        <Button
          color="primary"
          size="md"
          className="w-full font-semibold shadow-sm"
          onClick={() => setCheckoutOpen(true)}
          isDisabled={items.length === 0}
        >
          {t('cart.checkout')}
        </Button>
      </div>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />
      <HeldCartsDialog open={heldCartsOpen} onOpenChange={setHeldCartsOpen} />

      {/* Checkout Drawer */}
      <Drawer
        isOpen={checkoutOpen}
        onOpenChange={setCheckoutOpen}
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
                {/* Order summary */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('cart.orderSummary')}
                  </h3>
                  {items.map((item) => (
                    <div key={item.product_id} className="flex justify-between text-sm font-data">
                      <span className="text-foreground">
                        {item.name} x{item.quantity}
                      </span>
                      <span className="text-foreground font-medium">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <Divider className="my-2" />
                  <div className="flex justify-between text-sm text-muted-foreground font-data">
                    <span>{t('cart.subtotal')}</span>
                    <span className="text-foreground">{formatCurrency(getSubtotal())}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-danger font-data">
                      <span>
                        {t('cart.discount')}
                        <span className="text-xs ms-1 opacity-70">
                          (
                          {discountType === 'percentage'
                            ? `${discount}%`
                            : formatCurrency(discount)}
                          )
                        </span>
                      </span>
                      <span>
                        -
                        {formatCurrency(
                          discountType === 'percentage'
                            ? (getSubtotal() * discount) / 100
                            : discount
                        )}
                      </span>
                    </div>
                  )}
                  {taxInfo.enabled && (
                    <div className="flex justify-between text-sm text-muted-foreground font-data">
                      <span>
                        {t('tax.vat')} ({taxInfo.rate}%)
                      </span>
                      <span className="text-foreground">{formatCurrency(totals.taxAmount)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-primary font-data">
                      <span>
                        {t('cart.coupon')} ({couponCode})
                      </span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  {totals.pointsDiscount > 0 && (
                    <div className="flex justify-between text-sm text-primary font-data">
                      <span>{t('loyalty.pointsDiscount')}</span>
                      <span>-{formatCurrency(totals.pointsDiscount)}</span>
                    </div>
                  )}
                  {tip > 0 && (
                    <div className="flex justify-between text-sm text-primary font-data">
                      <span>{t('cart.quickDiscount')}</span>
                      <span>-{formatCurrency(tip)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold font-data text-foreground">
                    <span>{t('cart.total')}</span>
                    <span className="text-primary">{formatCurrency(totals.amountDue)}</span>
                  </div>
                </div>

                <Divider />

                {/* Customer selection */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('cart.selectCustomer')}
                  </h3>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-xl border border-border/50">
                      <UserRound className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {selectedCustomer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCustomer.phone}
                          {loyaltyInfo.enabled && (
                            <span className="ms-2 text-primary font-semibold">
                              <Star className="h-3 w-3 inline-block" />{' '}
                              {t('loyalty.pointsBalance', {
                                points: String(loyaltyInfo.customerPoints),
                              })}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        className="h-7 w-7 shrink-0"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setRedeemPoints(false);
                          setPointsToRedeem(0);
                        }}
                        aria-label="Remove selected customer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : showNewCustomer ? (
                    <div className="space-y-2.5 p-3 bg-muted/20 rounded-xl border border-border/50">
                      <Input
                        size="sm"
                        variant="bordered"
                        placeholder={t('cart.customerName')}
                        value={newCustomerName}
                        onValueChange={setNewCustomerName}
                      />
                      <Input
                        size="sm"
                        variant="bordered"
                        placeholder={t('cart.customerPhone')}
                        value={newCustomerPhone}
                        onValueChange={setNewCustomerPhone}
                      />
                      <div className="flex gap-2">
                        <Button
                          color="primary"
                          size="sm"
                          className="flex-1 text-xs"
                          isDisabled={
                            !newCustomerName.trim() ||
                            !newCustomerPhone.trim() ||
                            customerCreator.isSaving
                          }
                          isLoading={customerCreator.isSaving}
                          onClick={handleCreateCustomer}
                        >
                          {t('cart.saveCustomer')}
                        </Button>
                        <Button
                          variant="flat"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setShowNewCustomer(false);
                            setNewCustomerName('');
                            setNewCustomerPhone('');
                          }}
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          size="sm"
                          variant="bordered"
                          placeholder={t('cart.searchCustomer')}
                          value={customerSearch}
                          onValueChange={(val) => {
                            setCustomerSearch(val);
                            setShowCustomerDropdown(true);
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          startContent={<Search className="h-3.5 w-3.5 text-muted-foreground" />}
                        />
                        {showCustomerDropdown && customerSearch.length > 0 && (
                          <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-border/50">
                            {customerMatches && customerMatches.length > 0 ? (
                              customerMatches.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="w-full text-start px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                                  onClick={() => handleSelectCustomer(c)}
                                >
                                  <span className="font-medium text-foreground">{c.name}</span>
                                  <span className="text-muted-foreground text-xs ms-2">
                                    {c.phone}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                {t('cart.noCustomer')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="light"
                        color="primary"
                        size="sm"
                        className="w-full text-xs"
                        startContent={<Plus className="h-3 w-3" />}
                        onClick={() => setShowNewCustomer(true)}
                      >
                        {t('cart.addNewCustomer')}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Loyalty Points Redemption */}
                {loyaltyInfo.enabled && selectedCustomer && (
                  <>
                    <Divider />
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-primary" />
                        {t('loyalty.redeemPoints')}
                      </h3>
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t('loyalty.points')}
                          </p>
                          <p className="text-base font-bold text-primary font-data">
                            {loyaltyInfo.customerPoints}
                          </p>
                        </div>
                        {loyaltyInfo.customerPoints > 0 && (
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="redeem-toggle"
                              className="text-xs text-muted-foreground cursor-pointer"
                            >
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
                      {redeemPoints && loyaltyInfo.customerPoints > 0 && (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            label={t('loyalty.pointsToRedeem')}
                            min="0"
                            size="sm"
                            variant="bordered"
                            max={loyaltyInfo.customerPoints}
                            value={pointsToRedeem ? String(pointsToRedeem) : ''}
                            onValueChange={(val) => {
                              const v = Math.min(
                                Math.max(0, parseInt(val) || 0),
                                loyaltyInfo.customerPoints
                              );
                              setPointsToRedeem(v);
                            }}
                            className="font-data w-36"
                          />
                          {totals.pointsDiscount > 0 && (
                            <p className="text-xs text-primary font-data font-semibold">
                              = -{formatCurrency(totals.pointsDiscount)}{' '}
                              {t('loyalty.pointsDiscount')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
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
                        onClick={() => {
                          clearCoupon();
                          setCouponInput('');
                        }}
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
                        value={couponInput}
                        onValueChange={setCouponInput}
                        className="flex-1"
                      />
                      <Button variant="bordered" size="sm" onClick={handleApplyCoupon}>
                        {t('cart.applyCoupon')}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Quick Discount */}
                <Divider />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-primary" />
                    {t('cart.quickDiscount')}
                  </h3>
                  <div className="flex gap-1.5 items-center">
                    {[5, 10, 15].map((pct) => {
                      const discAmount = Math.round(((getTotal() * pct) / 100) * 100) / 100;
                      return (
                        <Button
                          key={pct}
                          size="sm"
                          variant={tip === discAmount ? 'solid' : 'bordered'}
                          color={tip === discAmount ? 'primary' : 'default'}
                          className="flex-1 h-7 min-w-0 text-[11px] font-data font-medium"
                          onClick={() => setTip(discAmount)}
                        >
                          {pct}%
                        </Button>
                      );
                    })}
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      size="sm"
                      variant="bordered"
                      placeholder={t('cart.customAmount')}
                      value={tip ? String(tip) : ''}
                      onValueChange={(val) => setTip(parseFloat(val) || 0)}
                      className="flex-1 font-data"
                    />
                  </div>
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

                {/* Payment method */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('cart.paymentMethod')}
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(e) => {
                          setSplitPayment(e.target.checked);
                          if (e.target.checked) {
                            setPayments([
                              { method: 'Cash', amount: 0 },
                              { method: 'Card', amount: 0 },
                            ]);
                          } else {
                            setPayments([]);
                          }
                        }}
                        className="accent-primary h-3.5 w-3.5 rounded"
                      />
                      {t('cart.splitPayment')}
                    </label>
                  </div>

                  {!splitPayment ? (
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(val: string) => setPaymentMethod(val as PaymentMethod)}
                      className="space-y-1.5"
                    >
                      {(['Cash', 'Card', 'Other'] as const).map((method) => (
                        <Radio
                          key={method}
                          value={method}
                          classNames={{
                            base: `flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors cursor-pointer max-w-full m-0 ${
                              paymentMethod === method
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`,
                            label: 'text-sm font-medium text-foreground cursor-pointer',
                          }}
                        >
                          {paymentLabels[method]}
                        </Radio>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((p, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            className="h-8 rounded-lg border border-border bg-card text-foreground px-2 text-xs"
                            value={p.method}
                            onChange={(e) => {
                              const next = [...payments];
                              next[idx] = { ...next[idx], method: e.target.value as PaymentMethod };
                              setPayments(next);
                            }}
                          >
                            <option value="Cash">{t('cart.cash')}</option>
                            <option value="Card">{t('cart.card')}</option>
                            <option value="Gift Card">{t('cart.giftCard')}</option>
                            <option value="Other">{t('cart.other')}</option>
                          </select>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            size="sm"
                            variant="bordered"
                            value={p.amount ? String(p.amount) : ''}
                            onValueChange={(val) => {
                              const next = [...payments];
                              next[idx] = { ...next[idx], amount: parseFloat(val) || 0 };
                              setPayments(next);
                            }}
                            className="flex-1 font-data"
                          />
                          {payments.length > 2 && (
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              className="h-7 w-7"
                              onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                              aria-label="Remove payment split"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <Button
                          variant="light"
                          size="sm"
                          startContent={<Plus className="h-3 w-3" />}
                          onClick={() => setPayments([...payments, { method: 'Cash', amount: 0 }])}
                        >
                          {t('cart.addPayment')}
                        </Button>
                        <span
                          className={`font-data font-semibold ${split.isBalanced ? 'text-success' : 'text-danger'}`}
                        >
                          {formatCurrency(split.allocated)} / {formatCurrency(totals.amountDue)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  color="primary"
                  size="md"
                  className="w-full font-semibold shadow-sm"
                  onClick={handleCheckout}
                  isDisabled={checkoutMutation.isPending || (splitPayment && !split.isBalanced)}
                  isLoading={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? t('cart.processing') : t('cart.confirmSale')}
                </Button>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
