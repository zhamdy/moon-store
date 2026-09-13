import { useState } from 'react';
import { Gift, Plus, Pencil, Trash2, Package, ArrowRight, X, Percent } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Pagination,
} from '@heroui/react';
import { Badge, PageHeader } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useProductCatalog } from '../../../shared/hooks/useProductCatalog';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import type { Product } from '../../../shared/types/index';
import type { Bundle, BundleItem } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

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
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const { page, pageSize, update } = useListRouteState();
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);

  const { data: rows, meta } = bundles.useList({ page, pageSize });
  const pagination = meta?.pagination as PaginationMeta | undefined;
  const { data: detail } = bundles.useOne(selectedBundle);

  useLastPageRecovery(page, pagination?.totalItems, pagination?.totalPages, update);

  const {
    products: allProducts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductCatalog({
    search: debouncedProductSearch,
    enabled: addProductOpen,
    selectedIds: bundleItems.map((item) => item.product_id),
  });

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

  // Detail view
  if (selectedBundle && detail) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            size="sm"
            onPress={() => setSelectedBundle(null)}
            aria-label={t('common.back')}
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <PageHeader title={detail.name} />
          <div className="ms-auto flex gap-2">
            <Button
              size="sm"
              variant="bordered"
              startContent={<Pencil className="h-4 w-4" />}
              onPress={() => openEditDialog(detail)}
            >
              {t('common.edit')}
            </Button>
            <Button
              size="sm"
              color="danger"
              variant="flat"
              startContent={<Trash2 className="h-4 w-4" />}
              onPress={() => remover.remove(detail.id)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {t('bundles.bundlePrice')}
              </p>
              <p className="text-2xl font-bold font-data text-primary mt-1">
                {formatCurrency(detail.price)}
              </p>
            </CardBody>
          </Card>
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {t('bundles.itemsIncluded')}
              </p>
              <p className="text-2xl font-bold font-data text-foreground mt-1">
                {detail.items?.length || 0}
              </p>
            </CardBody>
          </Card>
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {t('common.status')}
              </p>
              <div className="mt-1">
                <Badge variant={detail.status === 'active' ? 'success' : 'danger'}>
                  {detail.status === 'active' ? t('common.active') : t('common.inactive')}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </div>

        {detail.description && (
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                {t('common.description')}
              </p>
              <p className="text-sm text-foreground">{detail.description}</p>
            </CardBody>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Badge size="sm" variant={detail.status === 'active' ? 'success' : 'default'}>
            {t(`bundles.${detail.status}` as never)}
          </Badge>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('bundles.originalPrice')}:</span>
            <span className="font-data line-through text-muted-foreground">
              {formatCurrency(detail.original_price)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('bundles.bundlePrice')}:</span>
            <span className="font-data font-bold text-primary">{formatCurrency(detail.price)}</span>
          </div>
          {detail.savings_percent > 0 && (
            <Badge size="sm" variant="warning">
              <Percent className="h-3 w-3 inline-block me-0.5" />
              {t('bundles.savingsPercent', { percent: String(detail.savings_percent) })}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {!detail.items.length ? (
            <div className="col-span-full text-center py-16">
              <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('common.noResults')}</p>
            </div>
          ) : (
            detail.items.map((item) => (
              <Card key={item.product_id} className="border border-border bg-card shadow-sm">
                <CardBody className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate text-foreground">
                        {item.product_name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-data mt-0.5">
                        {t('bundles.quantity')}: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="font-data font-semibold text-sm text-foreground">
                      {formatCurrency(item.product_price)}
                    </span>
                    <span className="text-xs text-muted-foreground font-data">
                      = {formatCurrency(item.product_price * item.quantity)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('bundles.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onPress={openCreateDialog}
          >
            {t('bundles.create')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!rows?.length ? (
          <div className="col-span-full text-center py-16">
            <Gift className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('bundles.noBundles')}</p>
          </div>
        ) : (
          rows.map((bundle) => (
            /**
             * The edit and delete controls are SIBLINGS of the card, not children of
             * it (#104). `isPressable` renders the card as a `<button>`, so buttons
             * inside it were nested interactive controls: invalid HTML, axe's
             * `nested-interactive`, and a card whose accessible name swallowed both
             * labels. The `<div onClick={stopPropagation}>` that used to wrap them was
             * a symptom of the same nesting. This mirrors the POS product grid.
             */
            <div key={bundle.id} className="relative">
              <Card
                isPressable
                onPress={() => setSelectedBundle(bundle.id)}
                className="w-full border border-border bg-card hover:border-primary/50 transition-colors shadow-sm"
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-base text-foreground">{bundle.name}</h3>
                    {/* Space for the action buttons rendered as siblings below. */}
                    <span className="h-8 w-[4.25rem] shrink-0" aria-hidden="true" />
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Badge size="sm" variant={bundle.status === 'active' ? 'success' : 'default'}>
                      {t(`bundles.${bundle.status}` as never)}
                    </Badge>
                    {bundle.savings_percent > 0 && (
                      <Badge size="sm" variant="warning">
                        <Percent className="h-2.5 w-2.5 inline-block me-0.5" />
                        {t('bundles.savingsPercent', { percent: String(bundle.savings_percent) })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground line-through font-data">
                      {formatCurrency(bundle.original_price)}
                    </span>
                    <span className="text-lg font-bold text-primary font-data">
                      {formatCurrency(bundle.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    <span>{t('bundles.itemCount', { count: String(bundle.items.length) })}</span>
                  </div>
                  {bundle.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {bundle.description}
                    </p>
                  )}
                </CardBody>
              </Card>
              {/* Named per row: a bare "Edit" repeats on every card and identifies none. */}
              <div className="absolute top-3 end-3 z-20 flex gap-1">
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onPress={() => openEditDialog(bundle)}
                  aria-label={`${bundle.name}: ${t('common.edit')}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  isIconOnly
                  variant="light"
                  color="danger"
                  size="sm"
                  className="h-8 w-8"
                  onPress={() => remover.remove(bundle.id)}
                  aria-label={`${bundle.name}: ${t('common.delete')}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            page={page}
            total={pagination.totalPages}
            onChange={(newPage) => update({ page: newPage })}
            showControls
          />
        </div>
      )}

      {/* Create / Edit dialog */}
      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        scrollBehavior="inside"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form onSubmit={handleSubmit}>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editor.isEditing ? t('bundles.edit') : t('bundles.create')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('bundles.title')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  label={t('bundles.name')}
                  size="sm"
                  variant="bordered"
                  value={form.name}
                  onValueChange={(val) => editor.set('name', val)}
                  isRequired
                />
                <Input
                  label={t('bundles.description')}
                  size="sm"
                  variant="bordered"
                  value={form.description}
                  onValueChange={(val) => editor.set('description', val)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label={t('bundles.price')}
                    size="sm"
                    variant="bordered"
                    value={form.price}
                    onValueChange={(val) => editor.set('price', val)}
                    isRequired
                  />
                  <Select
                    label={t('bundles.status')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.status]}
                    onChange={(e) => {
                      if (e.target.value) editor.set('status', e.target.value);
                    }}
                  >
                    <SelectItem key="active" textValue={t('bundles.active')}>
                      {t('bundles.active')}
                    </SelectItem>
                    <SelectItem key="inactive" textValue={t('bundles.inactive')}>
                      {t('bundles.inactive')}
                    </SelectItem>
                  </Select>
                </div>

                {/* Price summary */}
                {bundleItems.length > 0 && formPrice > 0 && (
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('bundles.originalPrice')}:</span>
                      <span className="font-data">{formatCurrency(originalPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('bundles.bundlePrice')}:</span>
                      <span className="font-data font-bold text-primary">
                        {formatCurrency(formPrice)}
                      </span>
                    </div>
                    {formSavings > 0 && (
                      <div className="flex justify-between text-success">
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
                    <span className="text-xs font-medium text-foreground">
                      {t('bundles.items')}
                    </span>
                    <Button
                      type="button"
                      variant="bordered"
                      size="sm"
                      startContent={<Plus className="h-3.5 w-3.5" />}
                      onPress={() => {
                        setAddProductOpen(true);
                        setProductSearch('');
                      }}
                    >
                      {t('bundles.addItem')}
                    </Button>
                  </div>
                  {bundleItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {t('bundles.selectProducts')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {bundleItems.map((item) => (
                        <div
                          key={item.product_id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-data">
                              {formatCurrency(item.product_price)}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            size="sm"
                            variant="bordered"
                            value={String(item.quantity)}
                            onValueChange={(val) =>
                              updateItemQuantity(item.product_id, parseInt(val) || 1)
                            }
                            className="w-20"
                          />
                          <Button
                            type="button"
                            isIconOnly
                            variant="light"
                            color="danger"
                            size="sm"
                            className="h-8 w-8 shrink-0"
                            onPress={() => removeItemFromBundle(item.product_id)}
                            aria-label={t('common.remove')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  size="sm"
                  disabled={bundleItems.length === 0}
                  isLoading={saver.isSaving}
                >
                  {saver.isSaving ? t('common.loading') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Add product to bundle dialog */}
      <Modal
        isOpen={addProductOpen}
        onOpenChange={setAddProductOpen}
        backdrop="blur"
        placement="center"
        size="md"
        scrollBehavior="inside"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('bundles.addItem')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('bundles.selectProducts')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-3">
                <Input
                  placeholder={t('bundles.searchProducts')}
                  size="sm"
                  variant="bordered"
                  value={productSearch}
                  onValueChange={setProductSearch}
                />
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {allProducts?.map((p) => (
                    <button
                      key={p.id}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-start transition-colors"
                      onClick={() => addProductToBundle(p)}
                    >
                      <div>
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        <span className="text-xs text-muted-foreground ms-2 font-data">
                          {p.sku}
                        </span>
                        {bundleItems.some((item) => item.product_id === p.id) && (
                          <Badge size="sm" variant="primary" className="ms-2">
                            {t('common.edit')}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-data text-foreground">
                        {formatCurrency(Number(p.price))}
                      </span>
                    </button>
                  ))}
                  {hasNextPage && (
                    <Button
                      fullWidth
                      variant="bordered"
                      onPress={() => void fetchNextPage()}
                      isLoading={isFetchingNextPage}
                      aria-label="Load more products"
                    >
                      Load more
                    </Button>
                  )}
                </div>
              </ModalBody>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
