import { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Archive, Trash2, RotateCcw, ShoppingBag } from 'lucide-react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { useHeldCartsStore, type HeldCart } from '../store/heldCartsStore';
import { useCartStore } from '../store/cartStore';
import { formatCurrency, formatRelative } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import toast from 'react-hot-toast';

interface HeldCartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HeldCartsDialog({ open, onOpenChange }: HeldCartsDialogProps) {
  const { t } = useTranslation();
  const [animateParent] = useAutoAnimate();
  const { carts, retrieveCart, deleteCart } = useHeldCartsStore();
  const cartStore = useCartStore();

  const [confirmRetrieveId, setConfirmRetrieveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRetrieve = (id: string) => {
    if (cartStore.items.length > 0) {
      setConfirmRetrieveId(id);
    } else {
      doRetrieve(id);
    }
  };

  const doRetrieve = (id: string) => {
    const cart = retrieveCart(id);
    if (cart) {
      cartStore.clearCart();
      for (const item of cart.items) {
        cartStore.addItem({
          id: item.product_id,
          name: item.name,
          price: item.unit_price,
          stock: item.stock,
        });
        if (item.quantity > 1) {
          cartStore.updateQuantity(item.product_id, item.quantity);
        }
      }
      cartStore.setDiscount(cart.discount);
      cartStore.setDiscountType(cart.discountType);
      toast.success(t('cart.retrieveSuccess'));
      onOpenChange(false);
    }
    setConfirmRetrieveId(null);
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const doDelete = () => {
    if (confirmDeleteId) {
      deleteCart(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const getCartTotal = (cart: HeldCart) =>
    cart.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <>
      <Modal
        isOpen={open}
        onOpenChange={onOpenChange}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="text-base font-semibold">{t('cart.heldCarts')}</h3>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      {t('cart.heldCartsDesc')}
                    </p>
                  </div>
                </div>
              </ModalHeader>

              <ModalBody className="py-4">
                <div ref={animateParent} className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {carts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">{t('cart.noHeldCarts')}</p>
                    </div>
                  ) : (
                    carts.map((cart) => (
                      <div
                        key={cart.id}
                        className="p-3 bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl border border-border/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {cart.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-data">
                              {t('cart.itemCount', { count: String(cart.items.length) })} &middot;{' '}
                              {formatCurrency(getCartTotal(cart))}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {t('cart.heldAt', { time: formatRelative(cart.createdAt) })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              isIconOnly
                              variant="light"
                              color="primary"
                              size="sm"
                              className="h-8 w-8"
                              onClick={() => handleRetrieve(cart.id)}
                              title={t('cart.retrieve')}
                              aria-label={t('cart.retrieve')}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              isIconOnly
                              variant="light"
                              color="danger"
                              size="sm"
                              className="h-8 w-8"
                              onClick={() => handleDelete(cart.id)}
                              title={t('cart.deleteHeld')}
                              aria-label={t('cart.deleteHeld')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Confirm replace cart */}
      <ConfirmDialog
        open={confirmRetrieveId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRetrieveId(null);
        }}
        title={t('cart.replaceCart')}
        description={t('cart.replaceCartConfirm')}
        confirmText={t('cart.replaceCart')}
        confirmColor="primary"
        onConfirm={() => confirmRetrieveId && doRetrieve(confirmRetrieveId)}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title={t('cart.deleteHeld')}
        description={t('cart.deleteHeldConfirm')}
        confirmText={t('common.delete')}
        confirmColor="danger"
        onConfirm={doDelete}
      />
    </>
  );
}
