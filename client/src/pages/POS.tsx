import { useState, useCallback, useRef, useMemo, useEffect, type ChangeEvent } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Search, Camera, Package, Keyboard, Layers, Star, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import CartPanel from '../components/CartPanel';
import BarcodeScanner from '../components/BarcodeScanner';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import VariantPickerDialog from '../components/pos/VariantPickerDialog';
import { useCartStore } from '../store/cartStore';
import { useHeldCartsStore } from '../store/heldCartsStore';
import { formatCurrency } from '../lib/utils';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePosShortcuts } from '../hooks/usePosShortcuts';
import { usePosData } from '../hooks/usePosData';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { Product, ProductVariant } from '@/types';

export default function POS() {
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const checkoutTriggerRef = useRef<() => void>(null);
  const { addItem, items, updateQuantity, removeItem, clearCart, discount, discountType } =
    useCartStore();
  const { holdCart, carts: heldCarts } = useHeldCartsStore();
  const { t } = useTranslation();
  const [animateGrid] = useAutoAnimate();

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Extracted data hook
  const {
    favorites,
    toggleFavorite,
    categories,
    collections,
    products,
    isLoadingProducts,
    variants,
    variantProduct,
    setVariantProduct,
    variantDialogOpen,
    setVariantDialogOpen,
  } = usePosData({ debouncedSearch, selectedCategory, selectedCollection });

  // Cart recovery banner
  const isRecovered = items.length > 0 && useCartStore.getState().isRecoveredCart();
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  useEffect(() => {
    if (isRecovered) setShowRecoveryBanner(true);
  }, []);

  // BroadcastChannel for customer display
  useEffect(() => {
    const channel = new BroadcastChannel('moon-customer-display');
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const total = useCartStore.getState().getTotal();
    if (items.length > 0) {
      channel.postMessage({
        type: 'cart-update',
        cart: {
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            memo: i.memo,
          })),
          subtotal,
          discount: useCartStore.getState().discount,
          discountType: useCartStore.getState().discountType,
          total,
          tip: useCartStore.getState().tip,
        },
      });
    } else {
      channel.postMessage({ type: 'cart-clear' });
    }
    channel.close();
  }, [items]);

  // Keyboard shortcuts
  const shortcutActions = useMemo(
    () => ({
      focusSearch: () => searchInputRef.current?.focus(),
      toggleScanner: () => setShowScanner((prev) => !prev),
      openCheckout: () => {
        if (items.length > 0 && checkoutTriggerRef.current) {
          checkoutTriggerRef.current();
        }
      },
      clearCart: () => {
        if (items.length > 0) clearCart();
      },
      holdCart: () => {
        if (items.length > 0) {
          const name = `Cart #${heldCarts.length + 1}`;
          holdCart(name, items, discount, discountType);
          clearCart();
          toast.success(t('cart.holdSuccess'));
        }
      },
      incrementLastItem: () => {
        const last = items[items.length - 1];
        if (last && last.quantity < last.stock) {
          updateQuantity(last.product_id, last.quantity + 1);
        }
      },
      decrementLastItem: () => {
        const last = items[items.length - 1];
        if (last && last.quantity > 1) {
          updateQuantity(last.product_id, last.quantity - 1);
        }
      },
      removeLastItem: () => {
        const last = items[items.length - 1];
        if (last) removeItem(last.product_id);
      },
      showHelp: () => setShowShortcuts(true),
    }),
    [items, updateQuantity, removeItem, clearCart, holdCart, heldCarts, discount, discountType, t]
  );

  usePosShortcuts(shortcutActions);

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      try {
        const response = await api.get(`/api/v1/products/barcode/${barcode}`);
        const product = response.data.data as Product;
        if (product) {
          addItem(product);
          setShowScanner(false);
          toast.success(t('pos.productFound', { name: product.name }));
        }
      } catch {
        toast.error(t('pos.barcodeNotFound'));
      }
    },
    [addItem, t]
  );

  const handleProductClick = (product: Product) => {
    if (product.has_variants && product.variant_count > 0) {
      setVariantProduct(product);
      setVariantDialogOpen(true);
      return;
    }
    if (product.stock === 0) return;
    addItem(product);
  };

  const handleVariantSelect = (variant: ProductVariant) => {
    if (!variantProduct || variant.stock === 0) return;
    addItem({
      id: variantProduct.id,
      name: variantProduct.name,
      price: variant.price || variantProduct.price,
      stock: variant.stock,
      variant_id: variant.id,
      variant_attributes: variant.attributes,
    });
    setVariantDialogOpen(false);
    setVariantProduct(null);
  };

  const getEffectiveStock = (product: Product) => {
    if (product.has_variants && product.variant_count > 0) return product.variant_stock;
    return product.stock;
  };

  const getStockVariant = (product: Product) => {
    const stock = getEffectiveStock(product);
    if (stock === 0) return 'destructive' as const;
    if (stock <= product.min_stock) return 'warning' as const;
    return 'success' as const;
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">{t('pos.title')}</h1>
        <div className="gold-divider mt-2" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel - Products */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
              <Input
                ref={searchInputRef}
                placeholder={t('pos.searchPlaceholder')}
                value={searchInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                className="ps-9"
              />
            </div>
            <Button
              variant={showScanner ? 'default' : 'outline'}
              onClick={() => setShowScanner(!showScanner)}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              {t('pos.scan')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowShortcuts(true)}
              title={t('pos.shortcuts')}
              className="hidden lg:flex"
            >
              <Keyboard className="h-4 w-4 text-gold" />
            </Button>
          </div>

          {/* Category filter chips */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-gold text-primary-foreground'
                    : 'bg-surface text-muted border border-border hover:border-gold/50'
                }`}
              >
                {t('pos.allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-gold text-primary-foreground'
                      : 'bg-surface text-muted border border-border hover:border-gold/50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Collection filter chips */}
          {collections && collections.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto pb-1 scrollbar-thin">
              <Layers className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => {
                    setSelectedCollection(selectedCollection === col.id ? null : col.id);
                    if (selectedCollection !== col.id) setSelectedCategory(null);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCollection === col.id
                      ? 'bg-gold text-primary-foreground'
                      : 'bg-surface text-muted border border-border hover:border-gold/50'
                  }`}
                >
                  {col.name} ({col.product_count})
                </button>
              ))}
            </div>
          )}

          {/* Cart recovery banner */}
          {showRecoveryBanner && (
            <div className="flex items-center gap-3 p-3 rounded-md border border-gold/50 bg-gold/5">
              <AlertCircle className="h-5 w-5 text-gold shrink-0" />
              <p className="text-sm flex-1">{t('cart.recoveredCart')}</p>
              <Button size="sm" variant="outline" onClick={() => setShowRecoveryBanner(false)}>
                {t('cart.keepCart')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  clearCart();
                  setShowRecoveryBanner(false);
                }}
              >
                {t('cart.discardCart')}
              </Button>
            </div>
          )}

          {/* Favorites grid */}
          {favorites && favorites.length > 0 && products && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted flex items-center gap-1.5">
                <Star className="h-3 w-3 text-gold" /> {t('pos.favorites')}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {favorites.map((favId) => {
                  const product = products.find((p) => p.id === favId);
                  if (!product) return null;
                  return (
                    <button
                      key={favId}
                      onClick={() => handleProductClick(product)}
                      className="shrink-0 px-4 py-2 rounded-md border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-colors"
                    >
                      <p className="text-sm font-medium truncate max-w-32">{product.name}</p>
                      <p className="text-xs text-gold font-data">
                        {formatCurrency(Number(product.price))}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showScanner && (
            <div className="rounded-md border border-border overflow-hidden">
              <BarcodeScanner onDetected={handleBarcodeDetected} />
            </div>
          )}

          {/* Product grid */}
          {isLoadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-md" />
              ))}
            </div>
          ) : (
            <div ref={animateGrid} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  className={`relative transition-all ${
                    getEffectiveStock(product) === 0
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer hover:border-gold/50 hover:shadow-md'
                  }`}
                  onClick={() => handleProductClick(product)}
                >
                  {getEffectiveStock(product) === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                      <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                        {t('pos.outOfStock')}
                      </span>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      {product.image_url ? (
                        <img
                          src={`${api.defaults.baseURL}${product.image_url}`}
                          alt={product.name}
                          className="h-10 w-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-gold" />
                      )}
                      <div className="flex items-center gap-1">
                        {product.has_variants > 0 && (
                          <Badge variant="gold" className="text-[10px] gap-0.5">
                            <Layers className="h-2.5 w-2.5" />
                            {product.variant_count}
                          </Badge>
                        )}
                        <Badge variant={getStockVariant(product)} className="text-[10px]">
                          {getEffectiveStock(product)} {t('pos.inStock')}
                        </Badge>
                      </div>
                    </div>
                    {(product.category_name || product.category) && (
                      <Badge variant="gold" className="text-[10px] mb-1">
                        {product.category_name || product.category}
                      </Badge>
                    )}
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-[11px] text-muted truncate font-data">
                      {t('pos.sku')}: {product.sku}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-lg font-semibold text-gold font-data">
                        {formatCurrency(Number(product.price))}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        className="p-1 rounded hover:bg-surface transition-colors"
                      >
                        <Star
                          className={`h-4 w-4 ${favorites?.includes(product.id) ? 'fill-gold text-gold' : 'text-muted'}`}
                        />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right panel - Cart */}
        <div className="lg:w-96 lg:min-h-[calc(100vh-300px)]">
          <CartPanel checkoutTriggerRef={checkoutTriggerRef} />
        </div>
      </div>

      {/* Variant Selector Dialog */}
      <VariantPickerDialog
        open={variantDialogOpen}
        onOpenChange={(open) => {
          setVariantDialogOpen(open);
          if (!open) setVariantProduct(null);
        }}
        product={variantProduct}
        variants={variants}
        onSelectVariant={handleVariantSelect}
      />

      <KeyboardShortcutsHelp open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}
