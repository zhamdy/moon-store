import { useState } from 'react';
import { Gift, Plus, Pencil, Trash2, Package, ArrowRight, X, Percent } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui/dialog';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import type { Bundle, BundleItem, Product } from '@/types';

const bundles = resource<Bundle>('bundles');

const emptyBundle = { name: '', description: '', price: '', status: 'active' };

const bundleToForm = (bundle: Bundle) => ({
  name: bundle.name,
  description: bundle.description || '',
  price: String(bundle.price),
  status: bundle.status,
});

export default function BundlesPage() {
  const { t } = useTranslation();
  const editor = useEditorDialog(emptyBundle, bundleToForm);
  const form = editor.values;
  // The lines being composed beside the form, not a field of it.
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const { data: rows } = bundles.useList();
  const { data: detail } = bundles.useOne(selectedBundle);

  const { data: allProducts } = useApiQuery<Product[]>(
    ['products-for-bundle', productSearch],
    'products',
    { search: productSearch, limit: 20 },
    { enabled: addProductOpen }
  );

  const saver = bundles.useSave({
    message: editor.isEditing ? t('bundles.updated') : t('bundles.created'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const remover = bundles.useRemove({
    message: t('bundles.deleted'),
    onDone: () => setSelectedBundle(null),
  });

  const originalPrice = bundleItems.reduce(
    (sum, item) => sum + item.product_price * item.quantity,
    0
  );
  const formPrice = parseFloat(form.price) || 0;
  const formSavings = originalPrice - formPrice;
  const formSavingsPercent =
    originalPrice > 0 ? Math.round((formSavings / originalPrice) * 100) : 0;

  const openCreateDialog = () => {
    editor.openNew();
    setBundleItems([]);
  };

  const openEditDialog = (bundle: Bundle) => {
    editor.openEdit(bundle);
    setBundleItems(
      bundle.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: item.product_price,
        quantity: item.quantity,
      }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saver.save({
      id: editor.editingId,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      status: form.status,
      items: bundleItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    });
  };

  const addProductToBundle = (product: Product) => {
    const existing = bundleItems.find((item) => item.product_id === product.id);
    if (existing) {
      setBundleItems(
        bundleItems.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setBundleItems([
        ...bundleItems,
        {
          product_id: product.id,
          product_name: product.name,
          product_price: Number(product.price),
          quantity: 1,
        },
      ]);
    }
  };

  const removeItemFromBundle = (productId: number) => {
    setBundleItems(bundleItems.filter((item) => item.product_id !== productId));
  };

  const updateItemQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setBundleItems(
      bundleItems.map((item) => (item.product_id === productId ? { ...item, quantity } : item))
    );
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-600',
    inactive: 'bg-gray-500/10 text-gray-600',
  };

  // Detail view
  if (selectedBundle && detail) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBundle(null)}>
            <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-display tracking-wider text-foreground">{detail.name}</h1>
            <div className="gold-divider mt-2" />
          </div>
          <Button size="sm" className="gap-2" onClick={() => openEditDialog(detail)}>
            <Pencil className="h-4 w-4" /> {t('common.edit')}
          </Button>
        </div>

        {detail.description && <p className="text-sm text-muted mb-4">{detail.description}</p>}

        <div className="flex flex-wrap gap-3 mb-6">
          <Badge className={`${statusColors[detail.status] || ''}`}>
            {t(`bundles.${detail.status}` as never)}
          </Badge>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t('bundles.originalPrice')}:</span>
            <span className="font-data line-through text-muted">
              {formatCurrency(detail.original_price)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t('bundles.bundlePrice')}:</span>
            <span className="font-data font-bold text-gold">{formatCurrency(detail.price)}</span>
          </div>
          {detail.savings_percent > 0 && (
            <Badge variant="gold" className="gap-1">
              <Percent className="h-3 w-3" />
              {t('bundles.savingsPercent', { percent: String(detail.savings_percent) })}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {!detail.items.length ? (
            <div className="col-span-full text-center py-16">
              <Package className="h-12 w-12 text-gold/40 mx-auto mb-3" />
              <p className="text-muted">{t('common.noResults')}</p>
            </div>
          ) : (
            detail.items.map((item) => (
              <div
                key={item.product_id}
                className="p-3 rounded-md border border-border bg-card hover:border-gold/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.product_name}</h4>
                    <p className="text-xs text-muted font-data">
                      {t('bundles.quantity')}: {item.quantity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-data font-bold text-sm">
                    {formatCurrency(item.product_price)}
                  </span>
                  <span className="text-xs text-muted font-data">
                    = {formatCurrency(item.product_price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('bundles.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" /> {t('bundles.create')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!rows?.length ? (
          <div className="col-span-full text-center py-16">
            <Gift className="h-12 w-12 text-gold/40 mx-auto mb-3" />
            <p className="text-muted">{t('bundles.noBundles')}</p>
          </div>
        ) : (
          rows.map((bundle) => (
            <div
              key={bundle.id}
              className="p-4 rounded-md border border-border bg-card hover:border-gold/50 transition-colors cursor-pointer"
              onClick={() => setSelectedBundle(bundle.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg">{bundle.name}</h3>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditDialog(bundle)}
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => remover.remove(bundle.id)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <Badge className={`text-[10px] ${statusColors[bundle.status] || ''}`}>
                  {t(`bundles.${bundle.status}` as never)}
                </Badge>
                {bundle.savings_percent > 0 && (
                  <Badge variant="gold" className="text-[10px] gap-0.5">
                    <Percent className="h-2.5 w-2.5" />
                    {t('bundles.savingsPercent', { percent: String(bundle.savings_percent) })}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted line-through font-data">
                  {formatCurrency(bundle.original_price)}
                </span>
                <span className="text-lg font-bold text-gold font-data">
                  {formatCurrency(bundle.price)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Package className="h-3 w-3" />
                <span>{t('bundles.itemCount', { count: String(bundle.items.length) })}</span>
              </div>
              {bundle.description && (
                <p className="text-xs text-muted mt-1 line-clamp-2">{bundle.description}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={editor.open} onOpenChange={editor.setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor.isEditing ? t('bundles.edit') : t('bundles.create')}</DialogTitle>
            <DialogDescription>{t('bundles.title')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>{t('bundles.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => editor.set('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('bundles.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => editor.set('description', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('bundles.price')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => editor.set('price', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('bundles.status')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => editor.set('status', e.target.value)}
                >
                  <option value="active">{t('bundles.active')}</option>
                  <option value="inactive">{t('bundles.inactive')}</option>
                </select>
              </div>
            </div>

            {/* Price summary */}
            {bundleItems.length > 0 && formPrice > 0 && (
              <div className="p-3 rounded-md bg-surface border border-border text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">{t('bundles.originalPrice')}:</span>
                  <span className="font-data">{formatCurrency(originalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('bundles.bundlePrice')}:</span>
                  <span className="font-data font-bold text-gold">{formatCurrency(formPrice)}</span>
                </div>
                {formSavings > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>{t('bundles.savings')}:</span>
                    <span className="font-data">
                      {formatCurrency(formSavings)} ({formSavingsPercent}%)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bundle items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('bundles.items')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setAddProductOpen(true);
                    setProductSearch('');
                  }}
                >
                  <Plus className="h-3 w-3" /> {t('bundles.addItem')}
                </Button>
              </div>
              {bundleItems.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">{t('bundles.selectProducts')}</p>
              ) : (
                <div className="space-y-2">
                  {bundleItems.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-center gap-2 p-2 rounded-md border border-border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <p className="text-xs text-muted font-data">
                          {formatCurrency(item.product_price)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemQuantity(item.product_id, parseInt(e.target.value) || 1)
                        }
                        className="w-16 h-8 text-center"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => removeItemFromBundle(item.product_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={saver.isSaving || bundleItems.length === 0}
            >
              {saver.isSaving ? t('common.loading') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add product to bundle dialog */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bundles.addItem')}</DialogTitle>
            <DialogDescription>{t('bundles.selectProducts')}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={t('bundles.searchProducts')}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="mb-3"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {allProducts?.map((p) => (
              <button
                key={p.id}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-surface text-start"
                onClick={() => addProductToBundle(p)}
              >
                <div>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted ms-2 font-data">{p.sku}</span>
                  {bundleItems.some((item) => item.product_id === p.id) && (
                    <Badge variant="gold" className="ms-2 text-[10px]">
                      {t('common.edit')}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-data">{formatCurrency(Number(p.price))}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
