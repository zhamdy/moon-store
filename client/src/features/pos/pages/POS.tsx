import { useState, useCallback, useRef, useMemo, useEffect, type ChangeEvent } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
  Search,
  Camera,
  Package,
  Keyboard,
  Layers,
  Star,
  AlertCircle,
  Gift,
  Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Input, Button, Card, CardBody, Skeleton } from '@heroui/react';
import { Badge, PageHeader } from '../../../shared';
import CartPanel from '../components/CartPanel';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import VariantPickerDialog from '../components/pos/VariantPickerDialog';
import { useCartStore } from '../store/cartStore';
import { useHeldCartsStore } from '../store/heldCartsStore';
import { formatCurrency } from '../../../shared/lib/utils';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { usePosShortcuts } from '../hooks/usePosShortcuts';
import { usePosData, type PosBundle } from '../hooks/usePosData';
import { useTransport } from '../../../shared/lib/transport/index';
import { useTranslation } from '../../../shared/i18n/index';
import type { Product, ProductVariant } from '../../../shared/types/index';
import { assetUrl } from '../../../shared/lib/apiBase';

/**
 * Where uploaded product images are served from. The transport owns request
 * paths, not `<img src>`, so this reads the same env var the HTTP client does.
 */

export default function POS() {
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const checkoutTriggerRef = useRef<() => void>(null);
  const {
    addItem,
    addBundle,
    items,
    updateQuantity,
    removeItem,
    clearCart,
    discount,
    discountType,
    notes,
    tip,
    couponCode,
  } = useCartStore();
  const { holdCart, carts: heldCarts } = useHeldCartsStore();
  const { t } = useTranslation();
  const transport = useTransport();
  const [animateGrid] = useAutoAnimate();

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Extracted data hook
  const {
    favorites,
    toggleFavorite,
    categories,
    products,
    favoriteProducts,
    isLoadingProducts,
    hasMoreProducts,
    loadMoreProducts,
    isLoadingMoreProducts,
    bundles,
    variants,
    variantProduct,
    setVariantProduct,
    variantDialogOpen,
    setVariantDialogOpen,
  } = usePosData({ debouncedSearch, selectedCategory });

  // Cart recovery banner
  const isRecovered = items.length > 0 && useCartStore.getState().isRecoveredCart();
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  useEffect(() => {
    if (isRecovered) setShowRecoveryBanner(true);
  }, []);

  // Customer-display broadcasting now lives entirely in CartPanel (Unit 5):
  // it owns the corrected tax/coupon/loyalty-aware total projection, so it
  // is the only place that should post to the `moon-customer-display`
  // channel -- a second, partial broadcast here would race it and could
  // show the customer display a different figure than the cart footer.

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
          holdCart(name, items, discount, discountType, { notes, tip, couponCode });
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
    [
      items,
      updateQuantity,
      removeItem,
      clearCart,
      holdCart,
      heldCarts,
      discount,
      discountType,
      notes,
      tip,
      couponCode,
      t,
    ]
  );

  usePosShortcuts(shortcutActions);

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      try {
        const { data: product } = await transport.request<Product>({
          method: 'GET',
          path: `products/barcode/${barcode}`,
        });
        if (product) {
          addItem(product);
          setShowScanner(false);
          toast.success(t('pos.productFound', { name: product.name }));
        }
      } catch {
        toast.error(t('pos.barcodeNotFound'));
      }
    },
    [addItem, t, transport]
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

  const getStockColor = (product: Product): 'danger' | 'warning' | 'success' => {
    const stock = getEffectiveStock(product);
    if (stock === 0) return 'danger';
    if (stock <= product.min_stock) return 'warning';
    return 'success';
  };

  const isBundleInStock = (bundle: PosBundle) =>
    bundle.items.every((item) => {
      const product = products?.find((p) => p.id === item.product_id);
      return product && product.stock >= item.quantity;
    });

  const handleBundleClick = (bundle: PosBundle) => {
    if (!isBundleInStock(bundle)) return;
    const itemsWithStock = bundle.items.map((item) => {
      const product = products?.find((p) => p.id === item.product_id);
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: item.product_price,
        quantity: item.quantity,
        stock: product?.stock ?? 0,
      };
    });
    addBundle({ name: bundle.name, price: bundle.price, items: itemsWithStock });
    toast.success(t('pos.productFound', { name: bundle.name }));
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('pos.title')} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel - Products */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Input
                ref={searchInputRef}
                size="sm"
                variant="bordered"
                placeholder={t('pos.searchPlaceholder')}
                value={searchInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                startContent={<Search className="h-4 w-4 text-primary" />}
              />
            </div>
            <Button
              variant={showScanner ? 'solid' : 'bordered'}
              color={showScanner ? 'primary' : 'default'}
              size="sm"
              onPress={() => setShowScanner(!showScanner)}
              startContent={<Camera className="h-4 w-4" />}
            >
              {t('pos.scan')}
            </Button>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => setShowShortcuts(true)}
              title={t('pos.shortcuts')}
              aria-label={t('pos.shortcuts')}
              className="hidden lg:flex"
            >
              <Keyboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Category filter chips */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto pb-1 scrollbar-thin">
              <Button
                size="sm"
                variant={selectedCategory === null ? 'solid' : 'bordered'}
                color={selectedCategory === null ? 'primary' : 'default'}
                className="rounded-full text-xs h-7 px-3 min-w-0"
                onPress={() => setSelectedCategory(null)}
              >
                {t('pos.allCategories')}
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? 'solid' : 'bordered'}
                  color={selectedCategory === cat.id ? 'primary' : 'default'}
                  className="rounded-full text-xs h-7 px-3 min-w-0"
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          )}

          {/* Cart recovery banner */}
          {showRecoveryBanner && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
              <AlertCircle className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm text-foreground flex-1">{t('cart.recoveredCart')}</p>
              <Button size="sm" variant="bordered" onPress={() => setShowRecoveryBanner(false)}>
                {t('cart.keepCart')}
              </Button>
              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={() => {
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-primary" /> {t('pos.favorites')}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {favorites.map((favId) => {
                  const product = favoriteProducts.find((p) => p.id === favId);
                  if (!product) return null;
                  return (
                    <button
                      key={favId}
                      type="button"
                      onClick={() => handleProductClick(product)}
                      className="shrink-0 px-3.5 py-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-start"
                    >
                      <p className="text-sm font-medium text-foreground truncate max-w-32">
                        {product.name}
                      </p>
                      <p className="text-xs text-primary font-data font-semibold">
                        {formatCurrency(Number(product.price))}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bundles section */}
          {bundles && bundles.length > 0 && products && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-primary" /> {t('pos.bundles')}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {bundles.map((bundle) => {
                  const inStock = isBundleInStock(bundle);
                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => handleBundleClick(bundle)}
                      disabled={!inStock}
                      className={`shrink-0 px-3.5 py-2 rounded-xl border transition-colors text-start ${
                        inStock
                          ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
                          : 'border-border opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground truncate max-w-40">
                        {bundle.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground line-through font-data">
                          {formatCurrency(bundle.original_price)}
                        </span>
                        <span className="text-xs text-primary font-data font-bold">
                          {formatCurrency(bundle.price)}
                        </span>
                        {bundle.savings_percent > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-success font-semibold">
                            <Percent className="h-2.5 w-2.5" />
                            {bundle.savings_percent}%
                          </span>
                        )}
                      </div>
                      {!inStock && (
                        <span className="text-[10px] text-danger">{t('bundles.outOfStock')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showScanner && (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <BarcodeScanner onDetected={handleBarcodeDetected} />
            </div>
          )}

          {/* Product grid */}
          {isLoadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : (
            <div ref={animateGrid} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products?.map((product) => (
                /**
                 * The favourite toggle is a SIBLING of the card, not a child of it (#54).
                 * `isPressable` renders the card as a `<button>`, so a button inside it
                 * was a nested interactive control: invalid HTML, and axe's
                 * `nested-interactive`. A screen reader could not reach the star as its
                 * own control, and the card's accessible name swallowed it. Positioning
                 * it over the card keeps the appearance and makes it a real, separately
                 * focusable button.
                 */
                <div key={product.id} className="relative">
                  <Card
                    /* E2E: the card's accessible name concatenates stock badge, category,
                     name and SKU, so an exact role+name query is not usable. */
                    data-testid={`product-card-${product.sku}`}
                    isPressable={getEffectiveStock(product) > 0}
                    className={`relative transition-all border border-border bg-card shadow-sm ${
                      getEffectiveStock(product) === 0
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:border-primary/50'
                    }`}
                    onPress={() => handleProductClick(product)}
                  >
                    {getEffectiveStock(product) === 0 && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
                        <span className="text-xs font-semibold text-danger uppercase tracking-wider">
                          {t('pos.outOfStock')}
                        </span>
                      </div>
                    )}
                    <CardBody className="p-3.5">
                      <div className="flex items-start justify-between mb-2">
                        {product.image_url ? (
                          <img
                            src={assetUrl(product.image_url)}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover border border-border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center border border-border">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          {product.has_variants > 0 && (
                            <Badge size="sm" variant="primary">
                              <Layers className="h-2.5 w-2.5 inline-block me-0.5" />
                              {product.variant_count}
                            </Badge>
                          )}
                          <Badge size="sm" variant={getStockColor(product)}>
                            {getEffectiveStock(product)} {t('pos.inStock')}
                          </Badge>
                        </div>
                      </div>
                      {(product.category_name || product.category) && (
                        <Badge size="sm" variant="default" className="mb-1">
                          {product.category_name || product.category}
                        </Badge>
                      )}
                      <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground truncate font-data">
                        {t('pos.sku')}: {product.sku}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-base font-bold text-primary font-data">
                          {formatCurrency(Number(product.price))}
                        </p>
                        {/* The favourite button sits here visually; see the sibling below. */}
                        <span className="h-6 w-6" aria-hidden="true" />
                      </div>
                    </CardBody>
                  </Card>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute bottom-3 end-3 z-20 p-1 rounded hover:bg-muted/40 transition-colors"
                    aria-label={
                      favorites?.includes(product.id)
                        ? `${product.name}: ${t('pos.removeFavorite')}`
                        : `${product.name}: ${t('pos.addFavorite')}`
                    }
                    aria-pressed={favorites?.includes(product.id) ?? false}
                  >
                    <Star
                      className={`h-4 w-4 ${favorites?.includes(product.id) ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                    />
                  </button>
                </div>
              ))}
              {hasMoreProducts && (
                <div className="col-span-full flex justify-center pt-2">
                  <Button
                    variant="bordered"
                    onPress={loadMoreProducts}
                    isLoading={isLoadingMoreProducts}
                    aria-label="Load more products"
                  >
                    Load more
                  </Button>
                </div>
              )}
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
