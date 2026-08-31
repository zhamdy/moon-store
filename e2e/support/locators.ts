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
    /**
     * `.first()` because the cart list animates its exits: while a line is leaving, the
     * animation library keeps a detached clone in the DOM, so the empty-state text can
     * briefly match twice. The count assertion below is the precise one.
     */
    empty: page.getByText(tr('cart.empty', locale)).first(),
    /** `Cart (N)` — a single heading, and the unambiguous way to assert the line count. */
    heading: (count: number) =>
      page.getByRole('heading', { name: `${tr('cart.title', locale)} (${count})` }),
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

/** Adjustment controls inside the checkout drawer (discount, tip, coupon, split). */
export function adjustments(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  const dialog = page.getByRole('dialog', {
    name: new RegExp(escapeRegExp(tr('cart.completeSale', locale))),
  });
  return {
    /** Forces percentage mode — the drawer has no fixed-amount option. */
    discountPercent: (percent: 5 | 10 | 15) =>
      dialog.getByRole('button', { name: `${percent}%`, exact: true }),
    discountCustom: dialog.getByRole('spinbutton', { name: tr('cart.quickDiscount', locale) }),
    tip: dialog.getByRole('spinbutton', { name: tr('cart.tip', locale) }),
    couponInput: dialog.getByPlaceholder(tr('cart.couponPlaceholder', locale)),
    applyCoupon: dialog.getByRole('button', { name: tr('cart.applyCoupon', locale) }),
    /** Hardcoded English aria-label in the component; deliberately not from the catalog. */
    removeCoupon: dialog.getByRole('button', { name: 'Remove coupon' }),
    splitToggle: dialog.getByRole('checkbox', { name: tr('cart.splitPayment', locale) }),
    addPayment: dialog.getByRole('button', { name: tr('cart.addPayment', locale) }),
    /**
     * Split rows have no labelled `<select>`, so the method dropdown is positional. The
     * amount input's accessible name embeds the row's *current* method, so it changes
     * when the method does — read it after setting the method, never before.
     */
    splitMethod: (index: number) => dialog.getByRole('combobox').nth(index),
    splitAmount: (method: 'Cash' | 'Card' | 'Gift Card' | 'Other', row: number) =>
      dialog.getByRole('spinbutton', {
        name: `${method} ${tr('cart.splitPayment', locale)} #${row}`,
      }),
  };
}

/** The cart footer's own discount controls, which offer fixed mode as well. */
export function footerDiscount(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  return {
    percentMode: page.getByRole('button', { name: '%', exact: true }),
    fixedMode: page.getByRole('button', { name: '$', exact: true }),
    amount: page.getByPlaceholder('0', { exact: true }),
    clear: page.getByRole('button', { name: tr('cart.clearDiscount', locale) }),
  };
}

/** Hold / resume. The hold control lives in the cart header. */
export function heldCarts(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  const dialog = page.getByRole('dialog', { name: tr('cart.heldCarts', locale) });
  return {
    /**
     * `exact` matters here: product cards are buttons whose accessible name folds in the
     * SKU, so a substring match on "Hold" also matches any product whose SKU contains it.
     */
    hold: page.getByRole('button', { name: tr('cart.hold', locale), exact: true }),
    open: page.getByRole('button', { name: tr('cart.heldCarts', locale), exact: true }),
    dialog,
    empty: dialog.getByText(tr('cart.noHeldCarts', locale)),
    row: (name: string) => dialog.locator('li, div').filter({ hasText: name }).last(),
    retrieve: dialog.getByRole('button', { name: tr('cart.retrieve', locale) }),
    delete: dialog.getByRole('button', { name: tr('cart.deleteHeld', locale) }),
  };
}

/** The recovered/restored-cart gate. Blocks checkout until acknowledged. */
export function reviewBanner(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  return {
    warning: page.getByText(tr('cart.needsReviewWarning', locale)),
    acknowledge: page.getByRole('button', { name: tr('cart.needsReviewAcknowledge', locale) }),
  };
}

/** Customer selection and loyalty controls, both inside the checkout drawer. */
export function loyaltyControls(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  const dialog = page.getByRole('dialog', {
    name: new RegExp(escapeRegExp(tr('cart.completeSale', locale))),
  });
  return {
    dialog,
    customerSearch: dialog.getByPlaceholder(tr('cart.searchCustomer', locale)),
    /**
     * Gated on `appSettings.loyalty_enabled === 'true'`. A stale settings cache hides
     * these entirely, which is why every settings write is followed by a reload.
     */
    redeemToggle: dialog.getByRole('checkbox', { name: tr('loyalty.redeemToggle', locale) }),
    pointsToRedeem: dialog.getByRole('spinbutton', { name: tr('loyalty.pointsToRedeem', locale) }),
    pointsDiscountLabel: dialog.getByText(tr('loyalty.pointsDiscount', locale)),
    vatLabel: dialog.getByText(tr('tax.vat', locale)),
  };
}
