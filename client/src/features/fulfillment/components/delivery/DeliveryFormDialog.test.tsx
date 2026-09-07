import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useSettingsStore } from '../../../../shared/store/settingsStore';
import type { Customer } from '../../../../shared/types/index';
import DeliveryFormDialog from './DeliveryFormDialog';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const LAYLA = {
  id: 11,
  name: 'Layla Hassan',
  phone: '0500000000',
  address: '12 Olive Street',
} as Customer;

const OMAR = {
  id: 12,
  name: 'Omar Nasser',
  phone: '0511111111',
  address: '3 Cedar Road',
} as Customer;

type HarnessProps = {
  customers?: Customer[];
  isLoadingCustomers?: boolean;
  hasCustomerLoadError?: boolean;
};

/**
 * The search term is owned by the page, so the harness owns it too: this drives the
 * real controlled contract rather than a stub that always echoes what it is given.
 */
function Harness({
  customers = [LAYLA, OMAR],
  isLoadingCustomers = false,
  hasCustomerLoadError = false,
}: HarnessProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  return (
    <DeliveryFormDialog
      open
      onOpenChange={() => {}}
      editingOrder={null}
      products={[]}
      productSearch=""
      onProductSearchChange={() => {}}
      onLoadMoreProducts={() => {}}
      isLoadingMoreProducts={false}
      customers={customers}
      isLoadingCustomers={isLoadingCustomers}
      hasCustomerLoadError={hasCustomerLoadError}
      shippingCompanies={[]}
      onSubmit={() => {}}
      isSubmitting={false}
      customerSearch={customerSearch}
      onCustomerSearchChange={setCustomerSearch}
      onOpenCompaniesDialog={() => {}}
    />
  );
}

/**
 * `hidden: true` because an open popover marks the rest of the dialog aria-hidden,
 * and the flattened framer-motion mock leaves it mounted after it closes. The
 * combobox's real exposure while the list is shut is asserted explicitly below.
 */
function customerCombobox() {
  return screen.getByRole('combobox', { name: /select customer/i, hidden: true });
}

function pressKey(el: Element, key: string) {
  fireEvent.keyDown(el, { key });
  fireEvent.keyUp(el, { key });
}

/**
 * The open popover marks everything outside itself aria-hidden, so the combobox
 * drops out of the accessibility tree: hold the element before opening the list.
 */
async function openListbox() {
  const input = customerCombobox();
  input.focus();
  pressKey(input, 'ArrowDown');
  return { input, listbox: within(await screen.findByRole('listbox')) };
}

/**
 * react-aria keeps DOM focus on the input and tracks the active option through
 * aria-activedescendant, so every key goes to the combobox - never to the option.
 */
async function chooseOption(name: RegExp) {
  const { input, listbox } = await openListbox();
  const option = await listbox.findByRole('option', { name });

  for (let i = 0; i < 20; i += 1) {
    if (input.getAttribute('aria-activedescendant') === option.id) break;
    pressKey(input, 'ArrowDown');
  }
  expect(input).toHaveAttribute('aria-activedescendant', option.id);

  pressKey(input, 'Enter');
  return option;
}

describe('DeliveryFormDialog customer picker', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
  });

  it('exposes a combobox with its expanded state instead of a static div', async () => {
    render(<Harness />);

    expect(screen.getByRole('combobox', { name: /select customer/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    const { input } = await openListbox();

    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
  });

  it('keeps its name when the list opens, which is when the name matters most', async () => {
    /*
     * Opening the popover marks everything outside it `aria-hidden`, including the visible
     * label. A name computed from that label therefore disappears at exactly the moment a
     * screen-reader user is choosing from the list — and jsdom will not tell you, because
     * it computes the name from the DOM regardless. Playwright did (#111).
     *
     * So this asserts the *mechanism*: the name comes from an attribute on the element
     * itself, which nothing can hide.
     */
    render(<Harness />);

    const { input } = await openListbox();
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));

    expect(input).toHaveAttribute('aria-label', 'Select Customer');

    /*
     * And crucially, no `aria-labelledby` — which is what actually broke this.
     *
     * HeroUI's `label` prop emits both, and a reference wins the accessible-name
     * algorithm over an attribute. Its reference pointed at the input itself and at an id
     * that does not exist, so a browser computed no name at all while jsdom fell back to
     * `aria-label` and reported success. Asserting only the presence of `aria-label`
     * would therefore still pass against the broken markup; asserting the absence of the
     * reference is what pins the fix.
     */
    expect(input).not.toHaveAttribute('aria-labelledby');
  });

  it('selects an existing customer with the keyboard and fills the form', async () => {
    render(<Harness />);

    fireEvent.change(customerCombobox(), { target: { value: 'Layla' } });

    const option = await chooseOption(/Layla Hassan/);
    expect(option).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByLabelText(/customer name/i)).toHaveValue('Layla Hassan')
    );
    expect(screen.getByLabelText(/^phone$/i)).toHaveValue('0500000000');
    expect(screen.getByLabelText(/address/i)).toHaveValue('12 Olive Street');
  });

  it('offers the new-customer affordance as a real option and clears the fields', async () => {
    render(<Harness />);

    await chooseOption(/Layla Hassan/);
    await waitFor(() =>
      expect(screen.getByLabelText(/customer name/i)).toHaveValue('Layla Hassan')
    );

    await chooseOption(/new customer/i);

    await waitFor(() => expect(screen.getByLabelText(/customer name/i)).toHaveValue(''));
    expect(screen.getByLabelText(/^phone$/i)).toHaveValue('');
  });

  it('keeps the new-customer option reachable when the search matches nothing', async () => {
    render(<Harness customers={[]} />);

    fireEvent.change(customerCombobox(), { target: { value: 'nobody' } });

    const { listbox } = await openListbox();
    expect(await listbox.findByRole('option', { name: /new customer/i })).toBeInTheDocument();
    expect(listbox.queryByRole('option', { name: /Layla Hassan/ })).not.toBeInTheDocument();
    expect(screen.getByText(/no customers found/i)).toBeInTheDocument();
  });

  it('closes the list on Escape and leaves focus on the combobox', async () => {
    render(<Harness />);

    const { input } = await openListbox();
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));

    pressKey(input, 'Escape');

    // aria-expanded is what a screen reader reports, and it is the state the
    // dialog beneath must not have consumed the Escape from.
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
    expect(input).toHaveFocus();
  });

  it('reports a failed customer lookup instead of presenting it as no results', () => {
    render(<Harness customers={undefined} hasCustomerLoadError />);

    expect(screen.getByRole('combobox', { name: /select customer/i })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/no customers found/i)).not.toBeInTheDocument();
  });

  it('does not drop a selected customer when a later search no longer returns them', async () => {
    function Rerenderable() {
      const [customers, setCustomers] = useState<Customer[]>([LAYLA]);
      return (
        <>
          <button type="button" onClick={() => setCustomers([OMAR])}>
            move search on
          </button>
          <Harness customers={customers} />
        </>
      );
    }
    render(<Rerenderable />);

    await chooseOption(/Layla Hassan/);
    await waitFor(() =>
      expect(screen.getByLabelText(/customer name/i)).toHaveValue('Layla Hassan')
    );

    fireEvent.click(screen.getByRole('button', { name: /move search on/i, hidden: true }));

    const { listbox: reopened } = await openListbox();
    expect(await reopened.findByRole('option', { name: /Layla Hassan/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByLabelText(/customer name/i)).toHaveValue('Layla Hassan');
  });
});
