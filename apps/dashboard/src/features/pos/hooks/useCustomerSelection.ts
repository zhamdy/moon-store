/**
 * Attaching a customer to a checkout: searching for one, picking one, or
 * creating one on the spot.
 *
 * All of it is UI state with no financial meaning of its own — the selected
 * customer's *id* is what the sale carries, and their loyalty balance is
 * fetched by `useCheckoutPricing`, not here. Extracted from CartPanel
 * (issue #51) so the selection flow can be driven without the POS screen.
 */
import { useState } from 'react';
import { useTranslation } from '../../../shared/i18n/index';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { resource } from '../../../shared/lib/resource';
import type { Customer } from '../../../shared/types/index';

const customers = resource<Customer>('customers');

export interface CustomerSelection {
  selected: Customer | null;
  search: string;
  setSearch: (value: string) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  matches?: Customer[];
  select: (customer: Customer) => void;
  /** Drop the selection. Callers that also hold redemption state must reset it too. */
  clear: () => void;
  /** Reset selection AND the search box — what a completed checkout does. */
  reset: () => void;
  creating: boolean;
  startCreating: () => void;
  cancelCreating: () => void;
  newName: string;
  setNewName: (value: string) => void;
  newPhone: string;
  setNewPhone: (value: string) => void;
  isSaving: boolean;
  /** Create the customer from the entered name/phone and select the result. */
  createAndSelect: () => void;
}

export function useCustomerSelection(params: {
  /** Search only runs while the checkout drawer is open — it is a drawer control. */
  searchEnabled: boolean;
}): CustomerSelection {
  const { t } = useTranslation();

  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: matches } = useApiQuery<Customer[]>(
    ['customers', { search: debouncedSearch }],
    'customers',
    { search: debouncedSearch || undefined },
    {
      enabled: params.searchEnabled && debouncedSearch.length > 0,
      staleTime: 30 * 1000,
    }
  );

  const creator = customers.useSave({
    message: t('cart.customerCreated'),
    fallbackMessage: t('cart.customerCreateError'),
  });

  const clearNewCustomerForm = () => {
    setCreating(false);
    setNewName('');
    setNewPhone('');
  };

  return {
    selected,
    search,
    setSearch,
    dropdownOpen,
    setDropdownOpen,
    matches,
    select: (customer) => {
      setSelected(customer);
      setSearch('');
      setDropdownOpen(false);
    },
    clear: () => setSelected(null),
    reset: () => {
      setSelected(null);
      setSearch('');
    },
    creating,
    startCreating: () => setCreating(true),
    cancelCreating: clearNewCustomerForm,
    newName,
    setNewName,
    newPhone,
    setNewPhone,
    isSaving: creator.isSaving,
    createAndSelect: () => {
      creator.save(
        { name: newName.trim(), phone: newPhone.trim() },
        {
          onSuccess: (result) => {
            setSelected(result.data as Customer);
            clearNewCustomerForm();
          },
        }
      );
    },
  };
}
