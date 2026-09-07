/**
 * Attaching a customer to the sale: the selected card, the create-new form, or
 * the search box with its dropdown. All state lives in `useCustomerSelection`;
 * this renders it. Extracted from CartPanel (issue #51); markup unchanged.
 */
import { Button, Input } from '@heroui/react';
import { Plus, Search, Star, UserRound, X } from 'lucide-react';
import { useTranslation } from '../../../../shared/i18n/index';
import type { CustomerSelection } from '../../hooks/useCustomerSelection';
import type { LoyaltyState } from '../../hooks/useCheckoutPricing';

export default function CustomerSection({
  customer,
  loyalty,
  onRemoveSelected,
}: {
  customer: CustomerSelection;
  loyalty: LoyaltyState;
  /** Drops the customer AND any redemption that depended on them. */
  onRemoveSelected: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('cart.selectCustomer')}
      </h3>
      {customer.selected ? (
        <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-xl border border-border/50">
          <UserRound className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{customer.selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {customer.selected.phone}
              {loyalty.enabled && (
                <span className="ms-2 text-primary font-semibold">
                  <Star className="h-3 w-3 inline-block" />{' '}
                  {t('loyalty.pointsBalance', { points: String(loyalty.customerPoints) })}
                </span>
              )}
            </p>
          </div>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="h-7 w-7 shrink-0"
            onPress={onRemoveSelected}
            aria-label="Remove selected customer"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : customer.creating ? (
        <div className="space-y-2.5 p-3 bg-muted/20 rounded-xl border border-border/50">
          <Input
            size="sm"
            variant="bordered"
            placeholder={t('cart.customerName')}
            value={customer.newName}
            onValueChange={customer.setNewName}
          />
          <Input
            size="sm"
            variant="bordered"
            placeholder={t('cart.customerPhone')}
            value={customer.newPhone}
            onValueChange={customer.setNewPhone}
          />
          <div className="flex gap-2">
            <Button
              color="primary"
              size="sm"
              className="flex-1 text-xs"
              isDisabled={
                !customer.newName.trim() || !customer.newPhone.trim() || customer.isSaving
              }
              isLoading={customer.isSaving}
              onPress={customer.createAndSelect}
            >
              {t('cart.saveCustomer')}
            </Button>
            <Button variant="flat" size="sm" className="text-xs" onPress={customer.cancelCreating}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Input
              size="sm"
              variant="bordered"
              placeholder={t('cart.searchCustomer')}
              value={customer.search}
              onValueChange={(val) => {
                customer.setSearch(val);
                customer.setDropdownOpen(true);
              }}
              onFocus={() => customer.setDropdownOpen(true)}
              startContent={<Search className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            {customer.dropdownOpen && customer.search.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-border/50">
                {customer.matches && customer.matches.length > 0 ? (
                  customer.matches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-start px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                      onClick={() => customer.select(c)}
                    >
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-muted-foreground text-xs ms-2">{c.phone}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">{t('cart.noCustomer')}</p>
                )}
              </div>
            )}
          </div>
          <Button
            variant="light"
            color="primary"
            size="sm"
            className="w-full text-xs"
            startContent={<Plus className="h-3 w-3" />}
            onPress={customer.startCreating}
          >
            {t('cart.addNewCustomer')}
          </Button>
        </div>
      )}
    </div>
  );
}
