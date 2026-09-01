import { useState } from 'react';
import { Palette, Plus, Pencil, Trash2, Package, ArrowRight, X } from 'lucide-react';
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
import type { Collection, CollectionDetail } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

const collections = resource<Collection>('collections');
const collectionDetail = resource<CollectionDetail>('collections');

const seasons = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
const statuses = ['upcoming', 'active', 'on_sale', 'archived'] as const;

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

const withProducts = (detail: CollectionDetail, productIds: number[]) => ({
  id: detail.id,
  name: detail.name,
  season: detail.season || undefined,
  year: detail.year || undefined,
  status: detail.status,
  description: detail.description || undefined,
  product_ids: productIds,
});

export default function CollectionsPage() {
  const { t } = useTranslation();
  const editor = useEditorDialog(emptyCollection, collectionToForm);
  const form = editor.values;
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);

  const { data: rows, meta } = collections.useList({ page, pageSize: 25 });
  const pagination = meta?.pagination as PaginationMeta | undefined;
  const { data: detail } = collectionDetail.useOne(selectedCol);

  const {
    products: allProducts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductCatalog({ search: debouncedProductSearch, enabled: addProductOpen });

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
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            size="sm"
            onClick={() => setSelectedCol(null)}
            aria-label={t('common.back')}
          >
            <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
          </Button>
          <div className="flex-1">
            <PageHeader title={detail.name}>
              <Button
                color="primary"
                size="sm"
                startContent={<Plus className="h-4 w-4" />}
                onClick={() => setAddProductOpen(true)}
              >
                {t('collections.addProduct')}
              </Button>
            </PageHeader>
          </div>
        </div>

        {detail.description && (
          <p className="text-sm text-muted-foreground">{detail.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Badge size="sm" variant={detail.status === 'active' ? 'success' : 'default'}>
            {t(`collections.${detail.status}` as never)}
          </Badge>
          {detail.season && (
            <Badge size="sm" variant="secondary">
              {detail.season} {detail.year}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {!detail.products.length ? (
            <div className="col-span-full text-center py-16">
              <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('common.noResults')}</p>
            </div>
          ) : (
            detail.products.map((p) => (
              <Card key={p.id} className="border border-border bg-card shadow-sm">
                <CardBody className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate text-foreground">{p.name}</h4>
                      <p className="text-xs text-muted-foreground font-data mt-0.5">{p.sku}</p>
                    </div>
                    <Button
                      isIconOnly
                      variant="light"
                      color="danger"
                      size="sm"
                      className="h-6 w-6 text-muted-foreground hover:text-danger"
                      onClick={() =>
                        removeProduct.save(
                          withProducts(
                            detail,
                            detail.products.filter((dp) => dp.id !== p.id).map((dp) => dp.id)
                          )
                        )
                      }
                      aria-label={t('common.delete')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="font-data font-semibold text-sm text-foreground">
                      {formatCurrency(Number(p.price))}
                    </span>
                    <span className="text-xs text-muted-foreground font-data">
                      {t('collections.stock')}: {p.stock}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        {/* Add Product Modal */}
        <Modal
          isOpen={addProductOpen}
          onOpenChange={setAddProductOpen}
          backdrop="blur"
          placement="center"
          size="md"
          classNames={{
            base: 'bg-card text-card-foreground border border-border shadow-xl',
          }}
        >
          <ModalContent>
            {() => (
              <div>
                <ModalHeader className="border-b border-border/50">
                  <div>
                    <h3 className="text-base font-semibold">{t('collections.addProduct')}</h3>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      {t('collections.title')}
                    </p>
                  </div>
                </ModalHeader>
                <ModalBody className="py-4 space-y-3">
                  <Input
                    placeholder={t('common.search')}
                    size="sm"
                    variant="bordered"
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {allProducts
                      ?.filter((p) => !detail.products.some((dp) => dp.id === p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-start transition-colors"
                          onClick={() =>
                            addProduct.save(
                              withProducts(detail, [...detail.products.map((dp) => dp.id), p.id])
                            )
                          }
                        >
                          <div>
                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                            <span className="text-xs text-muted-foreground ms-2 font-data">
                              {p.sku}
                            </span>
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

  // List view
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('collections.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={editor.openNew}
          >
            {t('collections.create')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!rows?.length ? (
          <div className="col-span-full text-center py-16">
            <Palette className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('collections.noCollections')}</p>
          </div>
        ) : (
          rows.map((col) => (
            <Card
              key={col.id}
              isPressable
              onPress={() => setSelectedCol(col.id)}
              className="border border-border bg-card hover:border-primary/50 transition-colors shadow-sm"
            >
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-base text-foreground">{col.name}</h3>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => editor.openEdit(col)}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      isIconOnly
                      variant="light"
                      color="danger"
                      size="sm"
                      className="h-8 w-8"
                      onClick={() => remover.remove(col.id)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <Badge
                    size="sm"
                    variant={
                      col.status === 'active'
                        ? 'success'
                        : col.status === 'upcoming'
                          ? 'primary'
                          : col.status === 'on_sale'
                            ? 'warning'
                            : 'default'
                    }
                  >
                    {t(`collections.${col.status}` as never)}
                  </Badge>
                  {col.season && (
                    <Badge size="sm" variant="default">
                      {t(`collections.${col.season.toLowerCase()}` as never)}
                    </Badge>
                  )}
                  {col.year && (
                    <span className="text-xs text-muted-foreground font-data self-center">
                      {col.year}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>
                    {col.product_count} {t('collections.products').toLowerCase()}
                  </span>
                </div>
                {col.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {col.description}
                  </p>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} total={pagination.totalPages} onChange={setPage} showControls />
        </div>
      )}

      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
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
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editor.isEditing ? t('common.edit') : t('collections.create')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('collections.title')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  label={t('common.name')}
                  size="sm"
                  variant="bordered"
                  value={form.name}
                  onValueChange={(val) => editor.set('name', val)}
                  isRequired
                />
                <Input
                  label={t('collections.description')}
                  size="sm"
                  variant="bordered"
                  value={form.description}
                  onValueChange={(val) => editor.set('description', val)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select
                    label={t('collections.season')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={form.season ? [form.season] : []}
                    onChange={(e) => editor.set('season', e.target.value)}
                  >
                    {seasons.map((s) => (
                      <SelectItem key={s} textValue={t(`collections.${s.toLowerCase()}` as never)}>
                        {t(`collections.${s.toLowerCase()}` as never)}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    label={t('collections.year')}
                    size="sm"
                    variant="bordered"
                    value={form.year}
                    onValueChange={(val) => editor.set('year', val)}
                  />
                  <Select
                    label={t('common.status')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.status]}
                    onChange={(e) => {
                      if (e.target.value) editor.set('status', e.target.value);
                    }}
                  >
                    {statuses.map((s) => (
                      <SelectItem key={s} textValue={t(`collections.${s}` as never)}>
                        {t(`collections.${s}` as never)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saver.isSaving}>
                  {saver.isSaving ? t('common.loading') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
