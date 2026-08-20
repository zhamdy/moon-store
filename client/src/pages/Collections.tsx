import { useState } from 'react';
import { Palette, Plus, Pencil, Trash2, Package, ArrowRight, X } from 'lucide-react';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Label } from '../shared/ui/label';
import { Badge } from '../shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shared/ui/dialog';
import { useTranslation } from '../shared/i18n/index';
import { formatCurrency } from '../shared/lib/utils';
import { resource } from '../shared/lib/resource';
import { useEditorDialog } from '../shared/lib/editorDialog';
import { useApiQuery } from '../shared/lib/apiQuery';
import type { Collection, CollectionDetail, Product } from '@/types';

const collections = resource<Collection>('collections');

// One record of the same collection, read through its own type: the detail
// endpoint hands back the products too, which the list rows never carry.
const collectionDetail = resource<CollectionDetail>('collections');

const seasons = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
const statuses = ['upcoming', 'active', 'on_sale', 'archived'] as const;

// A factory, so a collection created next January defaults to next January.
const emptyCollection = () => ({
  name: '',
  season: '',
  year: String(new Date().getFullYear()),
  status: 'upcoming',
  description: '',
});

const collectionToForm = (col: Collection) => ({
  name: col.name,
  season: col.season || '',
  year: String(col.year || ''),
  status: col.status,
  description: col.description || '',
});

// Membership has no endpoint of its own: a collection gains or loses a product
// by being saved back with a different product list.
const withProducts = (detail: CollectionDetail, productIds: number[]) => ({
  id: detail.id,
  name: detail.name,
  season: detail.season || undefined,
  year: detail.year || undefined,
  status: detail.status,
  description: detail.description || undefined,
  product_ids: productIds,
});

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-600',
  active: 'bg-emerald-500/10 text-emerald-600',
  on_sale: 'bg-orange-500/10 text-orange-600',
  archived: 'bg-gray-500/10 text-gray-600',
};

export default function CollectionsPage() {
  const { t } = useTranslation();
  const editor = useEditorDialog(emptyCollection, collectionToForm);
  const form = editor.values;
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const { data: rows } = collections.useList();
  const { data: detail } = collectionDetail.useOne(selectedCol);

  const { data: allProducts } = useApiQuery<Product[]>(
    ['products-for-collection', productSearch],
    'products',
    { search: productSearch, limit: 20 },
    { enabled: addProductOpen }
  );

  const saver = collections.useSave({
    message: t('collections.created'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const remover = collections.useRemove({
    message: t('common.delete'),
    onDone: () => setSelectedCol(null),
  });

  const addProduct = collections.useSave({ message: t('common.save') });
  const removeProduct = collections.useSave();

  // Detail view
  if (selectedCol && detail) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCol(null)}>
            <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-display tracking-wider text-foreground">{detail.name}</h1>
            <div className="gold-divider mt-2" />
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setAddProductOpen(true);
              setProductSearch('');
            }}
          >
            <Plus className="h-4 w-4" /> {t('collections.addProduct')}
          </Button>
        </div>

        {detail.description && <p className="text-sm text-muted mb-4">{detail.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {!detail.products.length ? (
            <div className="col-span-full text-center py-16">
              <Package className="h-12 w-12 text-gold/40 mx-auto mb-3" />
              <p className="text-muted">{t('common.noResults')}</p>
            </div>
          ) : (
            detail.products.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-md border border-border bg-card hover:border-gold/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{p.name}</h4>
                    <p className="text-xs text-muted font-data">{p.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive shrink-0"
                    onClick={() =>
                      removeProduct.save(
                        withProducts(
                          detail,
                          detail.products.map((dp) => dp.id).filter((id) => id !== p.id)
                        )
                      )
                    }
                    aria-label={t('common.delete')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-data font-bold text-sm">{formatCurrency(p.price)}</span>
                  <Badge variant={p.stock > 0 ? 'gold' : 'destructive'} className="text-[10px]">
                    {t('inventory.stock')}: {p.stock}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add product dialog */}
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('collections.addProduct')}</DialogTitle>
              <DialogDescription>{t('collections.title')}</DialogDescription>
            </DialogHeader>
            <Input
              placeholder={t('common.search')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-3"
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {allProducts
                ?.filter((p) => !detail.products.some((dp) => dp.id === p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-surface text-start"
                    onClick={() =>
                      addProduct.save(
                        withProducts(detail, [...detail.products.map((dp) => dp.id), p.id])
                      )
                    }
                  >
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted ms-2 font-data">{p.sku}</span>
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

  // List view
  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('collections.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button onClick={editor.openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t('collections.create')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!rows?.length ? (
          <div className="col-span-full text-center py-16">
            <Palette className="h-12 w-12 text-gold/40 mx-auto mb-3" />
            <p className="text-muted">{t('collections.noCollections')}</p>
          </div>
        ) : (
          rows.map((col) => (
            <div
              key={col.id}
              className="p-4 rounded-md border border-border bg-card hover:border-gold/50 transition-colors cursor-pointer"
              onClick={() => setSelectedCol(col.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg">{col.name}</h3>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => editor.openEdit(col)}
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => remover.remove(col.id)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <Badge className={`text-[10px] ${statusColors[col.status] || ''}`}>
                  {t(`collections.${col.status}` as never)}
                </Badge>
                {col.season && (
                  <Badge variant="gold" className="text-[10px]">
                    {t(`collections.${col.season.toLowerCase()}` as never)}
                  </Badge>
                )}
                {col.year && <span className="text-xs text-muted font-data">{col.year}</span>}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Package className="h-3 w-3" />
                <span>
                  {col.product_count} {t('collections.products').toLowerCase()}
                </span>
              </div>
              {col.description && (
                <p className="text-xs text-muted mt-1 line-clamp-2">{col.description}</p>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={editor.open} onOpenChange={editor.setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.isEditing ? t('common.edit') : t('collections.create')}
            </DialogTitle>
            <DialogDescription>{t('collections.title')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saver.save({
                id: editor.editingId,
                name: form.name,
                season: form.season || undefined,
                year: Number(form.year) || undefined,
                status: form.status,
                description: form.description || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>{t('common.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => editor.set('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('collections.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => editor.set('description', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t('collections.season')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.season}
                  onChange={(e) => editor.set('season', e.target.value)}
                >
                  <option value="">—</option>
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {t(`collections.${s.toLowerCase()}` as never)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('collections.year')}</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => editor.set('year', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('common.status')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => editor.set('status', e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`collections.${s}` as never)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saver.isSaving}>
              {saver.isSaving ? t('common.loading') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
