import { useState, useEffect, useMemo, type MutableRefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../store/offlineStore';
import { useHeldCartsStore } from '../store/heldCartsStore';
import { formatCurrency } from '../lib/utils';
import { useTranslation } from '../i18n';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import ReceiptDialog from './ReceiptDialog';
import HeldCartsDialog from './HeldCartsDialog';
import api from '../services/api';
import type { AxiosError } from 'axios';
import type { ReceiptData } from './Receipt';

type PaymentMethod = 'Cash' | 'Card' | 'Other';

interface SaleItem {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
}

interface SaleData {
  items: SaleItem[];
  discount: number;
  discount_type: string;
  payment_method: PaymentMethod;
  customer_id?: number;
  tax_amount?: number;
  points_redeemed?: number;
}

interface AppSettings {
  tax_enabled: string;
  tax_rate: string;
  tax_mode: string;
  loyalty_enabled: string;
  loyalty_earn_rate: string;
  loyalty_redeem_value: string;
}

interface CustomerLoyalty {
  points: number;
}

interface ApiErrorResponse {
  error?: string;
}

interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  address: string | null;
}

interface CartPanelProps {
  checkoutTriggerRef?: MutableRefObject<(() => void) | null>;
}

export default function CartPanel({ checkoutTriggerRef }: CartPanelProps = {}): React.JSX.Element {
  const {
    items,
    discount,
    discountType,
    removeItem,
    updateQuantity,
    setDiscount,
    setDiscountType,
    getSubtotal,
    getTotal,
    clearCart,
  } = useCartStore();
  const { addToQueue } = useOfflineStore();
  const { carts: heldCarts, holdCart } = useHeldCartsStore();
  const queryClient = useQueryClient();
  const { t, isRtl } = useTranslation();

  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [heldCartsOpen, setHeldCartsOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);

  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // App settings (tax + loyalty)
  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  // Customer loyalty points
  const { data: customerLoyalty } = useQuery<CustomerLoyalty>({
    queryKey: ['customer-loyalty', selectedCustomer?.id],
    queryFn: () =>
      api.get(`/api/customers/${selectedCustomer!.id}/loyalty`).then((r) => r.data.data),
    enabled: !!selectedCustomer && appSettings?.loyalty_enabled === 'true',
    staleTime: 30 * 1000,
  });

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
    const mode = appSettings?.tax_mode || 'exclusive';
    if (!enabled || rate <= 0)
      return { enabled: false, rate: 0, mode, amount: 0, totalWithTax: getTotal() };

    const afterDiscount = getTotal();
    let taxAmount = 0;
    let totalWithTax = afterDiscount;

    if (mode === 'exclusive') {
      taxAmount = Math.round(afterDiscount * (rate / 100) * 100) / 100;
      totalWithTax = afterDiscount + taxAmount;
    } else {
      taxAmount = Math.round((afterDiscount - afterDiscount / (1 + rate / 100)) * 100) / 100;
      totalWithTax = afterDiscount;
    }

    return { enabled: true, rate, mode, amount: taxAmount, totalWithTax };
  }, [appSettings, getTotal]);

  const pointsDiscountAmount = useMemo(() => {
    if (!redeemPoints || pointsToRedeem <= 0 || !loyaltyInfo.enabled) return 0;
    return Math.round((pointsToRedeem / 100) * loyaltyInfo.redeemValue * 100) / 100;
  }, [redeemPoints, pointsToRedeem, loyaltyInfo]);

  // Expose checkout trigger for keyboard shortcuts
  useEffect(() => {
    if (checkoutTriggerRef) {
      checkoutTriggerRef.current = () => setCheckoutOpen(true);
    }
    return () => {
      if (checkoutTriggerRef) checkoutTriggerRef.current = null;
    };
  }, [checkoutTriggerRef]);

  const { data: customers } = useQuery<CustomerRecord[]>({
    queryKey: ['customers', { search: debouncedCustomerSearch }],
    queryFn: () =>
      api
        .get('/api/customers', { params: { search: debouncedCustomerSearch || undefined } })
        .then((r) => r.data.data),
    enabled: checkoutOpen && debouncedCustomerSearch.length > 0,
    staleTime: 30 * 1000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (saleData: SaleData) => api.post('/api/sales', saleData),
    onSuccess: (response) => {
      const sale = response.data.data;
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
    onError: (err: AxiosError<ApiErrorResponse>) => {
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
        toast.error(err.response?.data?.error || t('cart.saleFailed'));
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
      })),
      discount,
      discount_type: discountType,
      payment_method: paymentMethod,
      ...(selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
      ...(redeemPoints && pointsToRedeem > 0 ? { points_redeemed: pointsToRedeem } : {}),
    };

    checkoutMutation.mutate(saleData);
  };

  const handleSelectCustomer = (customer: CustomerRecord) => {
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
    <div className="flex flex-col min-h-[calc(100vh-300px)] bg-card border border-border rounded-md">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wider flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-gold" />
          {t('cart.title')} ({items.length})
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleHoldCart}
            disabled={items.length === 0}
            title={t('cart.hold')}
          >
            <Pause className="h-4 w-4 text-gold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            onClick={() => setHeldCartsOpen(true)}
            title={t('cart.heldCarts')}
          >
            <Archive className="h-4 w-4 text-gold" />
            {heldCarts.length > 0 && (
              <Badge className="absolute -top-1 -end-1 h-4 min-w-4 px-1 text-[10px] leading-none">
                {heldCarts.length}
              </Badge>
            )}
          </Button>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors ms-1"
            >
              {t('cart.clearAll')}
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-gold/40 mb-3" />
            <p className="text-sm text-muted">{t('cart.empty')}</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.product_id}-${item.variant_id || 0}`}
              className="flex items-center gap-3 p-3 bg-surface rounded-md border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-foreground truncate">{item.name}</p>
                <p className="text-sm text-muted font-data">{formatCurrency(item.unit_price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    updateQuantity(item.product_id, item.quantity - 1, item.variant_id)
                  }
                >
                  <Minus className="h-3.5 w-3.5 text-gold" />
                </Button>
                <span className="w-8 text-center text-base font-data">{item.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    updateQuantity(item.product_id, item.quantity + 1, item.variant_id)
                  }
                  disabled={item.quantity >= item.stock}
                >
                  <Plus className="h-3.5 w-3.5 text-gold" />
                </Button>
              </div>
              <p className="text-base font-semibold font-data w-20 text-end">
                {formatCurrency(item.unit_price * item.quantity)}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeItem(item.product_id, item.variant_id)}
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-3">
        {/* Discount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              {t('cart.discount')}
            </span>
            {discount > 0 && (
              <button
                onClick={() => setDiscount(0)}
                className="text-[10px] text-red-500 hover:text-red-500/80 transition-colors"
              >
                {t('cart.clearDiscount')}
              </button>
            )}
          </div>

          {/* Type toggle + input */}
          <div className="flex items-center gap-2">
            <div className="flex bg-surface border border-border rounded-md overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs font-data font-medium transition-colors ${
                  discountType === 'percentage'
                    ? 'bg-gold text-primary-foreground'
                    : 'text-muted hover:text-foreground'
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
                className={`px-3 py-1.5 text-xs font-data font-medium transition-colors ${
                  discountType === 'fixed'
                    ? 'bg-gold text-primary-foreground'
                    : 'text-muted hover:text-foreground'
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
              max={discountType === 'percentage' ? 100 : undefined}
              placeholder="0"
              value={discount || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDiscount(parseFloat(e.target.value) || 0)
              }
              className="flex-1 h-8 text-sm font-data"
            />
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5">
            {discountType === 'percentage'
              ? [5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscount(pct)}
                    className={`flex-1 py-1 rounded text-[11px] font-data font-medium transition-colors ${
                      discount === pct
                        ? 'bg-gold/20 text-gold border border-gold/40'
                        : 'bg-surface text-muted border border-border hover:border-gold/30 hover:text-foreground'
                    }`}
                  >
                    {pct}%
                  </button>
                ))
              : [5, 10, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDiscount(amt)}
                    className={`flex-1 py-1 rounded text-[11px] font-data font-medium transition-colors ${
                      discount === amt
                        ? 'bg-gold/20 text-gold border border-gold/40'
                        : 'bg-surface text-muted border border-border hover:border-gold/30 hover:text-foreground'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <div className="flex justify-between text-base text-muted font-data">
            <span>{t('cart.subtotal')}</span>
            <span>{formatCurrency(getSubtotal())}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-base text-red-500 font-data">
              <span>
                {t('cart.discount')}
                <span className="text-sm ms-1 opacity-70">
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
            <div className="flex justify-between text-base text-muted font-data">
              <span>
                {t('tax.vat')}
                <span className="text-sm ms-1 opacity-70">({taxInfo.rate}%)</span>
              </span>
              <span>{formatCurrency(taxInfo.amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-semibold font-data text-foreground">
            <span>{t('cart.total')}</span>
            <span className="text-gold">{formatCurrency(taxInfo.totalWithTax)}</span>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => setCheckoutOpen(true)}
          disabled={items.length === 0}
        >
          {t('cart.checkout')}
        </Button>
      </div>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />
      <HeldCartsDialog open={heldCartsOpen} onOpenChange={setHeldCartsOpen} />

      {/* Checkout Sheet */}
      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent side={isRtl ? 'left' : 'right'} className="flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>{t('cart.completeSale')}</SheetTitle>
            <SheetDescription>{t('cart.reviewSale')}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 flex-1 overflow-y-auto px-3">
            {/* Order summary */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted font-body">
                {t('cart.orderSummary')}
              </h3>
              {items.map((item) => (
                <div key={item.product_id} className="flex justify-between text-base font-data">
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-base text-muted font-data">
                <span>{t('cart.subtotal')}</span>
                <span>{formatCurrency(getSubtotal())}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-base text-red-500 font-data">
                  <span>
                    {t('cart.discount')}
                    <span className="text-sm ms-1 opacity-70">
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
                <div className="flex justify-between text-base text-muted font-data">
                  <span>
                    {t('tax.vat')} ({taxInfo.rate}%)
                  </span>
                  <span>{formatCurrency(taxInfo.amount)}</span>
                </div>
              )}
              {pointsDiscountAmount > 0 && (
                <div className="flex justify-between text-base text-gold font-data">
                  <span>{t('loyalty.pointsDiscount')}</span>
                  <span>-{formatCurrency(pointsDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold font-data">
                <span>{t('cart.total')}</span>
                <span className="text-gold">
                  {formatCurrency(Math.max(0, taxInfo.totalWithTax - pointsDiscountAmount))}
                </span>
              </div>
            </div>

            <Separator />

            {/* Customer selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted font-body">
                {t('cart.selectCustomer')}
              </h3>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-2 bg-surface rounded-md border border-border">
                  <UserRound className="h-4 w-4 text-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted">
                      {selectedCustomer.phone}
                      {loyaltyInfo.enabled && (
                        <span className="ms-2 text-gold">
                          <Star className="h-3 w-3 inline-block" />{' '}
                          {t('loyalty.pointsBalance', {
                            points: String(loyaltyInfo.customerPoints),
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setRedeemPoints(false);
                      setPointsToRedeem(0);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                  <Input
                    placeholder={t('cart.searchCustomer')}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="ps-9 h-9 text-sm"
                  />
                  {showCustomerDropdown && customerSearch.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {customers && customers.length > 0 ? (
                        customers.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-start px-3 py-2 text-sm hover:bg-surface transition-colors"
                            onClick={() => handleSelectCustomer(c)}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-muted text-xs ms-2">{c.phone}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-muted">{t('cart.noCustomer')}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Loyalty Points Redemption */}
            {loyaltyInfo.enabled && selectedCustomer && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium uppercase tracking-widest text-muted font-body flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-gold" />
                    {t('loyalty.redeemPoints')}
                  </h3>
                  <div className="flex items-center justify-between p-2 bg-surface rounded-md border border-border">
                    <div>
                      <p className="text-sm font-medium">{t('loyalty.points')}</p>
                      <p className="text-lg font-semibold text-gold font-data">
                        {loyaltyInfo.customerPoints}
                      </p>
                    </div>
                    {loyaltyInfo.customerPoints > 0 && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="redeem-toggle" className="text-xs text-muted">
                          {t('loyalty.redeemToggle')}
                        </Label>
                        <input
                          id="redeem-toggle"
                          type="checkbox"
                          checked={redeemPoints}
                          onChange={(e) => {
                            setRedeemPoints(e.target.checked);
                            if (!e.target.checked) setPointsToRedeem(0);
                          }}
                          className="accent-gold h-4 w-4"
                        />
                      </div>
                    )}
                  </div>
                  {redeemPoints && loyaltyInfo.customerPoints > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">{t('loyalty.pointsToRedeem')}</Label>
                      <Input
                        type="number"
                        min="0"
                        max={loyaltyInfo.customerPoints}
                        value={pointsToRedeem || ''}
                        onChange={(e) => {
                          const val = Math.min(
                            Math.max(0, parseInt(e.target.value) || 0),
                            loyaltyInfo.customerPoints
                          );
                          setPointsToRedeem(val);
                        }}
                        className="h-8 text-sm font-data w-32"
                      />
                      {pointsDiscountAmount > 0 && (
                        <p className="text-xs text-gold font-data">
                          = -{formatCurrency(pointsDiscountAmount)} {t('loyalty.pointsDiscount')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Payment method */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted font-body">
                {t('cart.paymentMethod')}
              </h3>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val: string) => setPaymentMethod(val as PaymentMethod)}
                className="space-y-1.5"
              >
                {(['Cash', 'Card', 'Other'] as const).map((method) => (
                  <div
                    key={method}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                      paymentMethod === method
                        ? 'border-gold/50 bg-gold/5'
                        : 'border-border hover:border-gold/30'
                    }`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    <RadioGroupItem value={method} id={method} />
                    <Label htmlFor={method} className="cursor-pointer text-sm font-medium flex-1">
                      {paymentLabels[method]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button
              className="w-full"
              onClick={handleCheckout}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? t('cart.processing') : t('cart.confirmSale')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
