import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, X, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../store/offlineStore';
import { formatCurrency } from '../lib/utils';
import { useTranslation } from '../i18n';
import api from '../services/api';
import type { AxiosError } from 'axios';

type PaymentMethod = 'Cash' | 'Card' | 'Other';

interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface SaleData {
  items: SaleItem[];
  discount: number;
  discount_type: string;
  payment_method: PaymentMethod;
}

interface ApiErrorResponse {
  error?: string;
}

export default function CartPanel(): React.JSX.Element {
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
  const queryClient = useQueryClient();
  const { t, isRtl } = useTranslation();

  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');

  const checkoutMutation = useMutation({
    mutationFn: (saleData: SaleData) => api.post('/api/sales', saleData),
    onSuccess: () => {
      toast.success(t('cart.saleSuccess'));
      clearCart();
      setCheckoutOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) => {
      if (!navigator.onLine) {
        const saleData: SaleData = {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          discount,
          discount_type: discountType,
          payment_method: paymentMethod,
        };
        addToQueue({ type: 'sale', payload: saleData as unknown as Record<string, unknown> });
        toast.success(t('cart.savedOffline'));
        clearCart();
        setCheckoutOpen(false);
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
    };

    checkoutMutation.mutate(saleData);
  };

  const handlePrint = (): void => {
    window.print();
  };

  const paymentLabels: Record<PaymentMethod, string> = {
    Cash: t('cart.cash'),
    Card: t('cart.card'),
    Other: t('cart.other'),
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-md">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg tracking-wider flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-gold" />
          {t('cart.title')} ({items.length})
        </h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-center text-muted text-sm py-8">{t('cart.empty')}</p>
        ) : (
          items.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center gap-3 p-3 bg-surface rounded-md border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted font-data">{formatCurrency(item.unit_price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3 text-gold" />
                </Button>
                <span className="w-8 text-center text-sm font-data">{item.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  disabled={item.quantity >= item.stock}
                >
                  <Plus className="h-3 w-3 text-gold" />
                </Button>
              </div>
              <p className="text-sm font-semibold font-data w-20 text-end">
                {formatCurrency(item.unit_price * item.quantity)}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeItem(item.product_id)}
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
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            placeholder={t('cart.discount')}
            value={discount || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDiscount(parseFloat(e.target.value) || 0)
            }
            className="w-24 h-8 text-sm"
          />
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              className={`px-2 py-1 text-xs font-data ${discountType === 'fixed' ? 'bg-gold text-primary-foreground' : 'text-muted'}`}
              onClick={() => setDiscountType('fixed')}
            >
              $
            </button>
            <button
              className={`px-2 py-1 text-xs font-data ${discountType === 'percentage' ? 'bg-gold text-primary-foreground' : 'text-muted'}`}
              onClick={() => setDiscountType('percentage')}
            >
              %
            </button>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted font-data">
            <span>{t('cart.subtotal')}</span>
            <span>{formatCurrency(getSubtotal())}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-blush font-data">
              <span>{t('cart.discount')}</span>
              <span>
                -{discountType === 'percentage' ? `${discount}%` : formatCurrency(discount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold font-data text-foreground">
            <span>{t('cart.total')}</span>
            <span className="text-gold">{formatCurrency(getTotal())}</span>
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

      {/* Checkout Sheet */}
      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent side={isRtl ? 'left' : 'right'}>
          <SheetHeader>
            <SheetTitle>{t('cart.completeSale')}</SheetTitle>
            <SheetDescription>{t('cart.reviewSale')}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Order summary */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted font-body">
                {t('cart.orderSummary')}
              </h3>
              {items.map((item) => (
                <div key={item.product_id} className="flex justify-between text-sm font-data">
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-semibold font-data">
                <span>{t('cart.total')}</span>
                <span className="text-gold">{formatCurrency(getTotal())}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted font-body">
                {t('cart.paymentMethod')}
              </h3>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val: string) => setPaymentMethod(val as PaymentMethod)}
              >
                {(['Cash', 'Card', 'Other'] as const).map((method) => (
                  <div key={method} className="flex items-center gap-2">
                    <RadioGroupItem value={method} id={method} />
                    <Label htmlFor={method} className="cursor-pointer">
                      {paymentLabels[method]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? t('cart.processing') : t('cart.confirmSale')}
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                {t('common.print')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
