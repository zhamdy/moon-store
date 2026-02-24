import { useState, useEffect } from 'react';
import { formatCurrency } from '../lib/utils';
import moonLogo from '../assets/moon-logo.svg';

interface DisplayItem {
  name: string;
  quantity: number;
  unit_price: number;
  memo?: string;
}

interface CartData {
  items: DisplayItem[];
  subtotal: number;
  discount: number;
  discountType: string;
  total: number;
  tip: number;
}

export default function CustomerDisplay() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const channel = new BroadcastChannel('moon-customer-display');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'cart-update') {
        setCart(data.cart);
        setCleared(false);
      } else if (data.type === 'cart-clear') {
        setCleared(true);
        setTimeout(() => {
          setCart(null);
          setCleared(false);
        }, 3000);
      }
    };
    return () => channel.close();
  }, []);

  const hasItems = cart && cart.items.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-[#c9a96e]/20">
        <img src={moonLogo} alt="MOON" className="h-10 invert brightness-200" />
        <p className="text-[#c9a96e] text-sm font-medium tracking-[0.3em] uppercase">
          Fashion & Style
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8">
        {cleared ? (
          <div className="text-center animate-fade-in">
            <p className="text-4xl font-display text-[#c9a96e] mb-4">Thank You!</p>
            <p className="text-lg text-white/60">Please visit again</p>
          </div>
        ) : !hasItems ? (
          <div className="text-center">
            <img
              src={moonLogo}
              alt=""
              className="h-24 mx-auto mb-6 invert brightness-200 opacity-30"
            />
            <p className="text-3xl font-display text-white/80 tracking-wider mb-2">
              Welcome to MOON
            </p>
            <p className="text-lg text-white/40 tracking-widest uppercase">Fashion & Style</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            {/* Items */}
            <div className="space-y-3 mb-8">
              {cart.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-white/10"
                >
                  <div>
                    <p className="text-xl font-medium">{item.name}</p>
                    {item.memo && <p className="text-sm text-[#c9a96e]/70 mt-0.5">{item.memo}</p>}
                    <p className="text-sm text-white/50 mt-0.5">
                      {formatCurrency(item.unit_price)} x {item.quantity}
                    </p>
                  </div>
                  <p className="text-xl font-semibold font-data text-[#c9a96e]">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-[#c9a96e]/30 pt-6 space-y-2">
              <div className="flex justify-between text-lg text-white/60">
                <span>Subtotal</span>
                <span className="font-data">{formatCurrency(cart.subtotal)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-lg text-red-400">
                  <span>
                    Discount{' '}
                    <span className="text-sm opacity-70">
                      (
                      {cart.discountType === 'percentage'
                        ? `${cart.discount}%`
                        : formatCurrency(cart.discount)}
                      )
                    </span>
                  </span>
                  <span className="font-data">
                    -
                    {formatCurrency(
                      cart.discountType === 'percentage'
                        ? (cart.subtotal * cart.discount) / 100
                        : cart.discount
                    )}
                  </span>
                </div>
              )}
              {cart.tip > 0 && (
                <div className="flex justify-between text-lg text-[#c9a96e]/70">
                  <span>Tip</span>
                  <span className="font-data">{formatCurrency(cart.tip)}</span>
                </div>
              )}
              <div className="flex justify-between text-3xl font-semibold pt-3 border-t border-[#c9a96e]/20">
                <span>Total</span>
                <span className="text-[#c9a96e] font-data">{formatCurrency(cart.total)}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-white/20 text-xs tracking-widest uppercase">
        MOON Fashion & Style
      </footer>
    </div>
  );
}
