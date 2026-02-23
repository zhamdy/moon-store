import { useState } from 'react';
import { Archive, Trash2, RotateCcw, ShoppingBag } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useHeldCartsStore, type HeldCart } from '../store/heldCartsStore';
import { useCartStore } from '../store/cartStore';
import { formatCurrency, formatRelative } from '../lib/utils';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';

interface HeldCartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HeldCartsDialog({ open, onOpenChange }: HeldCartsDialogProps) {
  const { t } = useTranslation();
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-gold" />
              {t('cart.heldCarts')}
            </DialogTitle>
            <DialogDescription>{t('cart.heldCartsDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {carts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="h-10 w-10 text-muted/40 mb-3" />
                <p className="text-sm text-muted">{t('cart.noHeldCarts')}</p>
              </div>
            ) : (
              carts.map((cart) => (
                <div
                  key={cart.id}
                  className="p-3 bg-surface rounded-md border border-border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{cart.name}</p>
                      <p className="text-xs text-muted">
                        {t('cart.itemCount', { count: String(cart.items.length) })} &middot;{' '}
                        {formatCurrency(getCartTotal(cart))}
                      </p>
                      <p className="text-xs text-muted/70">
                        {t('cart.heldAt', { time: formatRelative(cart.createdAt) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gold hover:text-gold/80"
                        onClick={() => handleRetrieve(cart.id)}
                        title={t('cart.retrieve')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/80"
                        onClick={() => handleDelete(cart.id)}
                        title={t('cart.deleteHeld')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm replace cart */}
      <AlertDialog
        open={confirmRetrieveId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRetrieveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cart.replaceCart')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cart.replaceCartConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRetrieveId && doRetrieve(confirmRetrieveId)}>
              {t('cart.replaceCart')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cart.deleteHeld')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cart.deleteHeldConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
