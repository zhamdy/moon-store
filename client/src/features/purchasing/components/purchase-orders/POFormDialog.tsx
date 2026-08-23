import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Distributor, Product } from '../../../../shared/types/index';
import type { PurchaseOrderLine } from '../../types';

interface POFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributors: Distributor[] | undefined;
  products: Product[] | undefined;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  hasMoreProducts?: boolean;
  onLoadMoreProducts: () => void;
  isLoadingMoreProducts: boolean;
  onSubmit: (data: {
    distributor_id: number;
    items: Array<{ product_id: number; quantity: number; cost_price: number }>;
    notes: string | null;
  }) => void;
  isSubmitting: boolean;
  /** Pre-filled distributor id (e.g. from auto-generate) */
  initialDistributorId?: string;
  /** Pre-filled line items (e.g. from auto-generate) */
  initialLineItems?: PurchaseOrderLine[];
}

export default function POFormDialog({
  open,
  onOpenChange,
  distributors,
  products,
  productSearch,
  onProductSearchChange,
  hasMoreProducts,
  onLoadMoreProducts,
  isLoadingMoreProducts,
  onSubmit,
  isSubmitting,
  initialDistributorId = '',
  initialLineItems,
}: POFormDialogProps) {
  const { t } = useTranslation();

  const [distributorId, setDistributorId] = useState(initialDistributorId);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseOrderLine[]>(initialLineItems ?? []);
  const [addProductId, setAddProductId] = useState('');

  const resetForm = () => {
    setDistributorId('');
    setNotes('');
    setLineItems([]);
    setAddProductId('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
      onProductSearchChange('');
    }
    onOpenChange(nextOpen);
  };

  const handleAddLineItem = () => {
    if (!addProductId) return;
    const product = products?.find((p) => p.id === Number(addProductId));
    if (!product) return;
    if (lineItems.find((li) => li.product_id === product.id)) return;
    setLineItems([
      ...lineItems,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        cost_price: product.cost_price || 0,
      },
    ]);
    setAddProductId('');
  };

  const handleSubmit = () => {
    if (!distributorId || lineItems.length === 0) return;
    onSubmit({
      distributor_id: Number(distributorId),
      items: lineItems.map((li) => ({
        product_id: li.product_id,
        quantity: li.quantity,
        cost_price: li.cost_price,
      })),
      notes: notes || null,
    });
  };

  const lineTotal = lineItems.reduce((s, li) => s + li.quantity * li.cost_price, 0);

  return (
    <Modal
      isOpen={open}
      onOpenChange={handleOpenChange}
      backdrop="blur"
      placement="center"
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl max-h-[90vh]',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">{t('po.create')}</h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('po.selectDistributor')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label={t('po.distributor')}
                  size="sm"
                  variant="bordered"
                  selectedKeys={distributorId ? [distributorId] : []}
                  onChange={(e) => setDistributorId(e.target.value)}
                >
                  {(distributors ?? []).map((d) => (
                    <SelectItem key={String(d.id)} textValue={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </Select>
                <Input
                  label={t('po.notes')}
                  size="sm"
                  variant="bordered"
                  value={notes}
                  onValueChange={setNotes}
                  placeholder={t('po.notes')}
                />
              </div>

              {/* Add product */}
              <div className="space-y-2">
                <Input
                  aria-label="Search products"
                  placeholder={t('common.search')}
                  size="sm"
                  variant="bordered"
                  value={productSearch}
                  onValueChange={onProductSearchChange}
                />
                <div className="flex gap-2 items-center">
                  <Select
                    label={t('po.selectProduct')}
                    size="sm"
                    variant="bordered"
                    className="flex-1"
                    selectedKeys={addProductId ? [addProductId] : []}
                    onChange={(e) => setAddProductId(e.target.value)}
                  >
                    {(products ?? [])
                      .filter((p) => p.status === 'active')
                      .map((p) => (
                        <SelectItem key={String(p.id)} textValue={`${p.name} (${p.sku})`}>
                          {p.name} ({p.sku})
                        </SelectItem>
                      ))}
                  </Select>
                  <Button
                    isIconOnly
                    variant="bordered"
                    size="sm"
                    className="h-10 w-10"
                    onClick={handleAddLineItem}
                    isDisabled={!addProductId}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {hasMoreProducts && (
                  <Button
                    fullWidth
                    variant="bordered"
                    size="sm"
                    onPress={onLoadMoreProducts}
                    isLoading={isLoadingMoreProducts}
                    aria-label="Load more products"
                  >
                    Load more
                  </Button>
                )}
              </div>

              {/* Line items */}
              {lineItems.length > 0 ? (
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card">
                  <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider p-2.5 bg-muted/20">
                    <span className="col-span-5">{t('po.product')}</span>
                    <span className="col-span-2">{t('po.quantity')}</span>
                    <span className="col-span-2">{t('po.costPrice')}</span>
                    <span className="col-span-2">{t('po.total')}</span>
                    <span className="col-span-1" />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                    {lineItems.map((li, i) => (
                      <div
                        key={li.product_id}
                        className="grid grid-cols-12 gap-2 items-center p-2.5"
                      >
                        <span className="col-span-5 text-sm font-medium text-foreground truncate">
                          {li.product_name}
                          {products?.find((p) => p.id === li.product_id)?.status !== 'active' && (
                            <span className="ms-2 text-xs text-warning">Unavailable</span>
                          )}
                        </span>
                        <input
                          type="number"
                          className="col-span-2 h-7 text-sm font-data border border-border rounded-lg bg-background text-foreground text-center"
                          value={li.quantity}
                          min={1}
                          onChange={(e) => {
                            const updated = [...lineItems];
                            updated[i] = { ...updated[i], quantity: Number(e.target.value) || 1 };
                            setLineItems(updated);
                          }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="col-span-2 h-7 text-sm font-data border border-border rounded-lg bg-background text-foreground text-center"
                          value={li.cost_price}
                          onChange={(e) => {
                            const updated = [...lineItems];
                            updated[i] = { ...updated[i], cost_price: Number(e.target.value) || 0 };
                            setLineItems(updated);
                          }}
                        />
                        <span className="col-span-2 text-sm font-data font-semibold text-primary">
                          {formatCurrency(li.quantity * li.cost_price)}
                        </span>
                        <Button
                          isIconOnly
                          variant="light"
                          color="danger"
                          size="sm"
                          className="col-span-1 h-7 w-7"
                          onClick={() => setLineItems(lineItems.filter((_, j) => j !== i))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end p-3 bg-muted/20 border-t border-border">
                    <span className="text-sm font-semibold text-foreground">
                      {t('po.total')}:{' '}
                      <span className="text-primary font-data">{formatCurrency(lineTotal)}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                  {t('po.noItems')}
                </p>
              )}
            </ModalBody>
            <ModalFooter className="border-t border-border/50">
              <Button variant="flat" size="sm" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                color="primary"
                size="sm"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                isDisabled={!distributorId || lineItems.length === 0 || isSubmitting}
              >
                {t('common.create')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
