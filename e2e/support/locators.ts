/**
 * Locator helpers, built from the app's own i18n catalogs.
 *
 * The priority is Playwright's documented one — role, then label, then text — with test
 * ids reserved for surfaces that have no meaningful accessible name at all. Where a role
 * query cannot find a control, the first move is to **fix the accessible name** in the
 * component: a missing name is a real accessibility defect, and reaching for a test id
 * buries it. The six test ids used below each carry a justification comment at their
 * definition site in `client/src`.
 *
 * Every helper takes the locale, so the same spec body runs against the shipped Arabic
 * default and against the `en` the bulk of the suite is pinned to.
 */
import type { Locator, Page } from '@playwright/test';
import { DEFAULT_TEST_LOCALE, type Locale, tr } from './i18n';

export interface LocaleOptions {
  locale?: Locale;
}

export function loginPage(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  return {
    email: page.getByLabel(tr('login.email', locale), { exact: true }),
    password: page.getByLabel(tr('login.password', locale), { exact: true }),
    submit: page.getByRole('button', { name: tr('login.submit', locale) }),
    heading: page.getByRole('heading', { name: tr('login.title', locale) }),
  };
}

/**
 * The shift/register gate.
 *
 * One dialog with **two mutually exclusive steps**: a cashier with neither sees only
 * "Clock In", and the register step replaces it once the shift query refetches. It is not
 * two dialogs, and both controls are never on screen together.
 */
export function startupPrompt(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  const dialog = page.getByRole('dialog', { name: tr('startup.title', locale) });
  return {
    dialog,
    clockIn: dialog.getByRole('button', { name: tr('startup.clockIn', locale) }),
    openingFloat: dialog.getByLabel(tr('startup.openingFloat', locale)),
    openRegister: dialog.getByRole('button', { name: tr('startup.openRegister', locale) }),
    later: dialog.getByRole('button', { name: tr('startup.skip', locale) }),
  };
}

export function posPage(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  return {
    search: page.getByPlaceholder(tr('pos.searchPlaceholder', locale)),
    /** Scoped by SKU: the card's own accessible name is an unusable concatenation. */
    productCard: (sku: string): Locator => page.getByTestId(`product-card-${sku}`),
    outOfStock: page.getByText(tr('pos.outOfStock', locale)),
  };
}

export function cartPanel(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  /** One cart line. Keyed by product and variant, matching the component's own key. */
  const line = (productId: number, variantId = 0): Locator =>
    page.getByTestId(`cart-line-${productId}-${variantId}`);

  return {
    line,
    /**
     * The +/- and remove controls carry hardcoded English `aria-label`s rather than
     * `t()` calls, so they are deliberately *not* read from the catalog — they do not
     * change under `ar`, and pretending otherwise would break the RTL spec.
     */
    increaseQuantity: (productId: number, variantId = 0) =>
      line(productId, variantId).getByRole('button', { name: 'Increase quantity' }),
    decreaseQuantity: (productId: number, variantId = 0) =>
      line(productId, variantId).getByRole('button', { name: 'Decrease quantity' }),
    removeItem: (productId: number, variantId = 0) =>
      line(productId, variantId).getByRole('button', { name: 'Remove item' }),
    quantity: (productId: number, variantId = 0) =>
      line(productId, variantId).getByTestId('cart-line-qty'),
    total: page.getByTestId('cart-total'),
    empty: page.getByText(tr('cart.empty', locale)),
    checkout: page.getByRole('button', { name: tr('cart.checkout', locale) }),
  };
}

/**
 * The checkout sheet. Its accessible name is the header heading *and* subtitle
 * concatenated, so it is matched by prefix rather than exactly.
 */
export function checkoutDrawer(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  const dialog = page.getByRole('dialog', {
    name: new RegExp(escapeRegExp(tr('cart.completeSale', locale))),
  });
  return {
    dialog,
    paymentMethod: (method: 'cash' | 'card' | 'other') =>
      dialog.getByRole('radio', { name: tr(`cart.${method}`, locale) }),
    total: dialog.getByTestId('checkout-total'),
    confirm: dialog.getByRole('button', { name: tr('cart.confirmSale', locale) }),
  };
}

export function receiptDialog(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  const dialog = page.getByRole('dialog', { name: tr('receipt.title', locale) });
  return {
    dialog,
    total: dialog.getByTestId('receipt-total'),
    /**
     * HeroUI renders its own dismiss button in addition to the footer one, so two
     * elements share the name — `.last()` selects the footer control deliberately.
     */
    close: dialog.getByRole('button', { name: tr('common.close', locale) }).last(),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
