import { withTransaction, Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ISalesRepository, salesRepository as defaultRepo } from './repository';
import { bundlesRepository, IBundlesRepository } from '../../inventory/bundles/repository';
import { couponsService, CouponsService } from '../../commerce/coupons/service';
import { registerService, IRegisterService } from '../register/service';
import {
  parseLoyaltySettings,
  CanonicalLoyaltySettings,
  SettingsMap,
  LOYALTY_ENABLED_KEY,
  LOYALTY_POINTS_PER_EGP_KEY,
  LOYALTY_EGP_PER_POINT_KEY,
  LOYALTY_EARN_RATE_ALIAS_KEY,
  LOYALTY_REDEEM_VALUE_ALIAS_KEY,
} from '../../core/settings/types';
import {
  CreateSaleDTO,
  SaleItemInput,
  PaymentInput,
  SaleTotals,
  TaxSettings,
  CreateRefundDTO,
  SaleCalculationBreakdown,
  SaleCalculationInput,
  SaleCalculationLineInput,
  ManualDiscountInput,
  TaxMode,
  toMinorUnits,
  fromMinorUnits,
  ConfirmedPayment,
  SaleCalculationSnapshot,
  SalesValidationError,
  InsufficientStockError,
  SPLIT_PAYMENT_MISMATCH_CODE,
  STRICT_SPLIT_PAYMENT_VALIDATION,
} from './types';

/**
 * A single checkout line resolved to an authoritative, server-known price.
 * Never derived from a trusted client `unit_price` for ordinary catalog
 * lines; see `resolveLines` for the bundle exception.
 */
interface ResolvedSaleLine {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  /** Persisted per-unit price (EGP major units). May be a cosmetic rounding of a bundle allocation. */
  unit_price: number;
  cost_price: number;
  memo?: string | null;
  isVariant: boolean;
}

/**
 * Canonical order for the stock write phase: products before variants, then ascending by
 * id. Two concurrent multi-line checkouts naming the same rows in opposite request order
 * would otherwise lock them in opposite order and deadlock. Sorting is what removes the
 * cycle, so this ordering must be applied by every path that decrements stock.
 */
function sortForStockWrites<T extends { product_id: number; variant_id?: number | null }>(
  lines: T[]
): T[] {
  return [...lines].sort((a, b) => {
    const aVariant = a.variant_id ?? 0;
    const bVariant = b.variant_id ?? 0;
    if (aVariant !== bVariant) {
      return aVariant - bVariant;
    }
    return a.product_id - b.product_id;
  });
}

interface ResolvedLines {
  resolvedItems: ResolvedSaleLine[];
  /** Authoritative per-line calculation input: exact, never re-derived from `unit_price * quantity`. */
  calcLines: SaleCalculationLineInput[];
}

/**
 * Manual discount, applied to a subtotal already in integer minor units.
 * Exported and reused identically by `calculateSaleBreakdown` and by
 * `SalesService` (to resolve the post-manual-discount amount a coupon must
 * validate against) so there is exactly one manual-discount formula.
 */
export function computeManualDiscountMinor(
  subtotalMinor: number,
  discount: ManualDiscountInput
): number {
  let amount: number;
  if (discount.type === 'percentage') {
    const percent = Math.min(Math.max(discount.valuePercent || 0, 0), 100);
    amount = Math.round((subtotalMinor * percent) / 100);
  } else {
    amount = Math.max(0, discount.valueMinor || 0);
  }
  return Math.min(amount, subtotalMinor);
}

/**
 * The pure, DB-free calculation core of the checkout financial contract (see
 * docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md, "Canonical
 * Calculation Contract" and `contracts/checkout-totals.v1.json`). Consumes
 * and produces only integer minor units. Every stored financial component of
 * a sale must derive from calling this function exactly once — no ad hoc
 * recalculation elsewhere.
 *
 * Rounding rule: round to the nearest whole minor unit, ties away from zero
 * (`Math.round` on non-negative magnitudes), applied at each stage that
 * produces a non-integer amount (percentage discounts, tax).
 */
export function calculateSaleBreakdown(input: SaleCalculationInput): SaleCalculationBreakdown {
  const subtotalMinor = input.items.reduce(
    (sum, item) => sum + item.unitPriceMinor * item.quantity,
    0
  );

  const manualDiscountMinor = computeManualDiscountMinor(subtotalMinor, input.manualDiscount);
  const remainingAfterManual = subtotalMinor - manualDiscountMinor;

  const couponDiscountMinor = Math.min(
    Math.max(input.couponDiscountMinor || 0, 0),
    remainingAfterManual
  );
  const couponId = input.couponId;

  const remainingAfterCoupon = remainingAfterManual - couponDiscountMinor;

  let pointsRedeemed = 0;
  let pointsDiscountMinor = 0;
  if (input.loyalty.enabled) {
    const balanceCap = input.loyalty.pointsBalance ?? Number.POSITIVE_INFINITY;
    const requested = Math.max(0, Math.floor(input.loyalty.pointsRedeemed || 0));
    const egpPerPointMinor = Math.max(0, input.loyalty.egpPerPointMinor || 0);

    let candidatePoints = Math.min(requested, balanceCap);
    let candidateDiscount = candidatePoints * egpPerPointMinor;

    if (candidateDiscount > remainingAfterCoupon) {
      candidatePoints =
        egpPerPointMinor > 0 ? Math.floor(remainingAfterCoupon / egpPerPointMinor) : 0;
      candidateDiscount = candidatePoints * egpPerPointMinor;
    }

    pointsRedeemed = candidatePoints;
    pointsDiscountMinor = candidateDiscount;
  }

  const taxableBaseMinor = Math.max(
    0,
    subtotalMinor - manualDiscountMinor - couponDiscountMinor - pointsDiscountMinor
  );

  let taxAmountMinor = 0;
  if (input.tax.enabled && input.tax.ratePercent > 0) {
    if (input.tax.mode === 'exclusive') {
      taxAmountMinor = Math.round((taxableBaseMinor * input.tax.ratePercent) / 100);
    } else {
      taxAmountMinor = Math.round(
        taxableBaseMinor - taxableBaseMinor / (1 + input.tax.ratePercent / 100)
      );
    }
  }

  const tipMinor = Math.max(0, Math.round(input.tipMinor || 0));

  let amountDueMinor =
    input.tax.mode === 'exclusive'
      ? taxableBaseMinor + taxAmountMinor + tipMinor
      : taxableBaseMinor + tipMinor;
  amountDueMinor = Math.max(0, Math.round(amountDueMinor));

  // Gated by `enabled` (not just a zero rate): a disabled loyalty program
  // must never award points even if a stale/default rate is still configured.
  const earnedPoints = input.loyalty.enabled
    ? Math.floor((amountDueMinor / 100) * (input.loyalty.pointsPerEgp || 0))
    : 0;

  return {
    contractVersion: 1,
    subtotalMinor,
    manualDiscountMinor,
    couponId,
    couponDiscountMinor,
    pointsRedeemed,
    pointsDiscountMinor,
    taxableBaseMinor,
    taxMode: input.tax.mode,
    taxRatePercent: input.tax.ratePercent,
    taxAmountMinor,
    tipMinor,
    amountDueMinor,
    earnedPoints,
  };
}

export class SalesService {
  constructor(
    private repo: ISalesRepository = defaultRepo,
    private bundles: IBundlesRepository = bundlesRepository,
    private coupons: CouponsService = couponsService,
    private register: IRegisterService = registerService
  ) {}

  getRepository(): ISalesRepository {
    return this.repo;
  }

  async getTaxSettings(queryable: Queryable = pool): Promise<TaxSettings> {
    const taxEnabledStr = await this.repo.getSetting('tax_enabled', queryable);
    const taxRateStr = await this.repo.getSetting('tax_rate', queryable);
    const taxModeStr = await this.repo.getSetting('tax_mode', queryable);

    return {
      enabled: taxEnabledStr === 'true',
      rate: Number(taxRateStr || 0),
      mode: taxModeStr || 'inclusive',
    };
  }

  /** Canonical loyalty settings (issue #31 / checkout financial contract): direct units, canonical-key-wins precedence. */
  async getCanonicalLoyaltySettings(
    queryable: Queryable = pool
  ): Promise<CanonicalLoyaltySettings> {
    const keys = [
      LOYALTY_ENABLED_KEY,
      LOYALTY_POINTS_PER_EGP_KEY,
      LOYALTY_EGP_PER_POINT_KEY,
      LOYALTY_EARN_RATE_ALIAS_KEY,
      LOYALTY_REDEEM_VALUE_ALIAS_KEY,
    ];
    const settings: SettingsMap = {};
    for (const key of keys) {
      const value = await this.repo.getSetting(key, queryable);
      if (value != null) settings[key] = value;
    }
    return parseLoyaltySettings(settings);
  }

  /**
   * Resolve every checkout line to a server-authoritative price. Ordinary
   * catalog/variant lines NEVER trust a client-supplied `unit_price`. A line
   * tagged with `bundle_id` is validated against its server-known bundle
   * definition and priced from a proportional allocation of the bundle's
   * price across its catalog-priced members (see `resolveBundleGroup`) —
   * the only server-recognized authorized price-override source.
   */
  private async resolveLines(
    items: SaleItemInput[],
    queryable: Queryable,
    checkStock: boolean
  ): Promise<ResolvedLines> {
    const resolvedItems: ResolvedSaleLine[] = [];
    const calcLines: SaleCalculationLineInput[] = [];

    const bundleGroups = new Map<number, SaleItemInput[]>();
    const plainItems: SaleItemInput[] = [];

    for (const item of items) {
      if (item.bundle_id) {
        const group = bundleGroups.get(item.bundle_id) || [];
        group.push(item);
        bundleGroups.set(item.bundle_id, group);
      } else {
        plainItems.push(item);
      }
    }

    for (const item of plainItems) {
      if (item.variant_id) {
        const variant = await this.repo.getProductVariantById(
          item.variant_id,
          item.product_id,
          queryable
        );
        if (!variant) throw new Error(`Variant not found: ID ${item.variant_id}`);
        if (checkStock && Number(variant.stock) < item.quantity) {
          throw new Error(`Insufficient stock for variant ID ${item.variant_id}`);
        }
        const unitPrice = Number(variant.price);
        resolvedItems.push({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          cost_price: Number(variant.cost_price || 0),
          memo: item.memo || null,
          isVariant: true,
        });
        calcLines.push({ unitPriceMinor: toMinorUnits(unitPrice), quantity: item.quantity });
      } else {
        const product = await this.repo.getProductById(item.product_id, queryable);
        if (!product) throw new Error(`Product not found: ID ${item.product_id}`);
        if (checkStock && Number(product.stock) < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }
        const unitPrice = Number(product.price);
        resolvedItems.push({
          product_id: item.product_id,
          variant_id: null,
          quantity: item.quantity,
          unit_price: unitPrice,
          cost_price: Number(product.cost_price || 0),
          memo: item.memo || null,
          isVariant: false,
        });
        calcLines.push({ unitPriceMinor: toMinorUnits(unitPrice), quantity: item.quantity });
      }
    }

    for (const [bundleId, group] of bundleGroups) {
      const { resolvedItems: bundleResolved, calcLines: bundleCalcLines } =
        await this.resolveBundleGroup(bundleId, group, queryable, checkStock);
      resolvedItems.push(...bundleResolved);
      calcLines.push(...bundleCalcLines);
    }

    return { resolvedItems, calcLines };
  }

  /**
   * Validate one bundle's requested lines against its server-known
   * definition and allocate its authoritative bundle price across the
   * requested lines proportionally to their catalog value (the same
   * allocation intent as `cartStore.addBundle` on the client, but computed
   * here from current catalog prices, not trusted from the request).
   *
   * The allocated total is fed to the calculator as one exact minor-unit
   * amount per resolved line (quantity folded in) so the authoritative
   * subtotal always equals the bundle's price exactly; only the persisted
   * per-unit `unit_price` (informational, for receipts) can carry a
   * sub-cent rounding remainder when a line's quantity does not divide its
   * allocation evenly.
   */
  private async resolveBundleGroup(
    bundleId: number,
    requestedItems: SaleItemInput[],
    queryable: Queryable,
    checkStock: boolean
  ): Promise<ResolvedLines> {
    const bundle = await this.bundles.findById(bundleId, queryable);
    if (!bundle || bundle.status !== 'active') {
      throw new Error(`Bundle not found or inactive: ID ${bundleId}`);
    }

    const bundleItems = await this.bundles.findItemsByBundleId(bundleId, queryable);
    if (bundleItems.length === 0) {
      throw new Error(`Bundle has no items: ID ${bundleId}`);
    }

    const requestedByProduct = new Map<number, number>();
    for (const item of requestedItems) {
      requestedByProduct.set(
        item.product_id,
        (requestedByProduct.get(item.product_id) || 0) + item.quantity
      );
    }

    const bundleProductIds = new Set(bundleItems.map((bi) => bi.product_id));
    if (
      bundleProductIds.size !== requestedByProduct.size ||
      ![...bundleProductIds].every((id) => requestedByProduct.has(id))
    ) {
      throw new Error(`Bundle allocation does not match its definition: ID ${bundleId}`);
    }

    let multiplier: number | null = null;
    for (const bi of bundleItems) {
      const requestedQty = requestedByProduct.get(bi.product_id)!;
      const candidateMultiplier = requestedQty / bi.quantity;
      if (!Number.isInteger(candidateMultiplier) || candidateMultiplier <= 0) {
        throw new Error(`Bundle allocation quantity mismatch: ID ${bundleId}`);
      }
      if (multiplier === null) {
        multiplier = candidateMultiplier;
      } else if (multiplier !== candidateMultiplier) {
        throw new Error(`Bundle allocation quantity mismatch: ID ${bundleId}`);
      }
    }

    // The bundles table has both a legacy `price` column and the `bundle_price`
    // column that the bundles module's own create/update paths write to (see
    // server/src/modules/inventory/bundles/repository.ts); prefer the latter.
    const bundleRow = bundle as unknown as { bundle_price?: number; price?: number };
    const bundlePriceMajor = Number(bundleRow.bundle_price ?? bundleRow.price ?? 0);
    const totalAllocatedMinor = toMinorUnits(bundlePriceMajor) * (multiplier || 1);

    const catalogLineMinor: number[] = bundleItems.map((bi) => {
      const requestedQty = requestedByProduct.get(bi.product_id)!;
      return toMinorUnits(Number(bi.original_price || 0)) * requestedQty;
    });
    const totalCatalogMinor = catalogLineMinor.reduce((s, v) => s + v, 0);

    const rawShares = bundleItems.map((_, i) =>
      totalCatalogMinor > 0
        ? (totalAllocatedMinor * catalogLineMinor[i]) / totalCatalogMinor
        : totalAllocatedMinor / bundleItems.length
    );
    const floors = rawShares.map((v) => Math.floor(v));
    let leftover = totalAllocatedMinor - floors.reduce((s, v) => s + v, 0);

    const remainderOrder = rawShares
      .map((v, i) => ({ i, remainder: v - floors[i] }))
      .sort((a, b) => b.remainder - a.remainder);
    const lineTotalsMinor = [...floors];
    for (const { i } of remainderOrder) {
      if (leftover <= 0) break;
      lineTotalsMinor[i] += 1;
      leftover -= 1;
    }

    const resolvedItems: ResolvedSaleLine[] = [];
    const calcLines: SaleCalculationLineInput[] = [];

    for (let i = 0; i < bundleItems.length; i++) {
      const bi = bundleItems[i];
      const requestedQty = requestedByProduct.get(bi.product_id)!;
      const product = await this.repo.getProductById(bi.product_id, queryable);
      if (!product) throw new Error(`Product not found: ID ${bi.product_id}`);
      if (checkStock && Number(product.stock) < requestedQty) {
        throw new Error(`Insufficient stock for product ID ${bi.product_id}`);
      }

      const lineTotalMinor = lineTotalsMinor[i];
      const perUnitMinor = Math.round(lineTotalMinor / requestedQty);

      resolvedItems.push({
        product_id: bi.product_id,
        variant_id: null,
        quantity: requestedQty,
        unit_price: fromMinorUnits(perUnitMinor),
        cost_price: Number(product.cost_price || 0),
        memo: `[Bundle #${bundleId}] ${bundle.name}`,
        isVariant: false,
      });
      // Authoritative line contribution is the exact allocation, folded into
      // one minor-unit amount at quantity 1 — never re-derived from
      // `perUnitMinor * requestedQty`, which can lose a minor unit to rounding.
      calcLines.push({ unitPriceMinor: lineTotalMinor, quantity: 1 });
    }

    return { resolvedItems, calcLines };
  }

  /**
   * Build the one authoritative calculation for a sale intent: resolve
   * catalog/bundle pricing, validate the coupon through the canonical
   * coupons service, validate loyalty redemption eligibility, and run the
   * pure calculator exactly once. Used identically by `calculateSaleTotals`
   * (preview/legacy shape) and `executeSale` (persistence) so there is no
   * second, weaker calculation path.
   */
  /**
   * @param forConsumption true only on the path that is about to persist the sale. It
   *   turns on the fail-fast stock pre-check and makes the coupon lookup take a row lock,
   *   because this is the call that will record a `coupon_usage` row. Preview callers
   *   pass false and take no locks.
   */
  private async buildBreakdown(
    input: CreateSaleDTO,
    queryable: Queryable,
    forConsumption: boolean
  ): Promise<{
    breakdown: SaleCalculationBreakdown;
    resolvedItems: ResolvedSaleLine[];
    customer: Record<string, any> | null;
  }> {
    const { resolvedItems, calcLines } = await this.resolveLines(
      input.items,
      queryable,
      forConsumption
    );
    const subtotalMinor = calcLines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);

    const manualDiscount: ManualDiscountInput =
      input.discount_type === 'percentage'
        ? { type: 'percentage', valuePercent: input.discount || 0 }
        : { type: 'fixed', valueMinor: toMinorUnits(input.discount || 0) };

    let couponId: number | null = null;
    let couponDiscountMinor = 0;
    if (input.coupon_code) {
      const manualDiscountMinor = computeManualDiscountMinor(subtotalMinor, manualDiscount);
      const postManualDiscountMajor = fromMinorUnits(subtotalMinor - manualDiscountMinor);
      // A CouponError (or any other failure) is intentionally left uncaught
      // here and propagates as-is: a deterministic validation failure must
      // never silently omit an explicitly requested coupon from the
      // authoritative calculation, and preserving CouponError's type lets the
      // controller map it to a 400 regardless of its message wording.
      const result = await this.coupons.validate(
        {
          code: input.coupon_code,
          subtotal: postManualDiscountMajor,
          customer_id: input.customer_id ?? null,
          item_product_ids: input.items.map((i) => i.product_id),
        },
        queryable,
        { forConsumption }
      );
      couponId = result.coupon_id;
      couponDiscountMinor = toMinorUnits(result.discount);
    }

    let customer: Record<string, any> | null = null;
    if (input.customer_id) {
      customer = await this.repo.getCustomerById(input.customer_id, queryable);
      if (!customer) throw new Error(`Customer not found: ID ${input.customer_id}`);
    }

    const loyaltySettings = await this.getCanonicalLoyaltySettings(queryable);
    const pointsRequested = Math.max(0, input.points_redeemed || 0);
    if (pointsRequested > 0) {
      if (!input.customer_id || !customer) {
        throw new Error('A customer must be selected to redeem loyalty points');
      }
      if (!loyaltySettings.enabled) {
        throw new Error('Loyalty program is disabled');
      }
      if (Number(customer.loyalty_points) < pointsRequested) {
        throw new Error('Insufficient loyalty points');
      }
    }

    const tax = await this.getTaxSettings(queryable);

    const breakdown = calculateSaleBreakdown({
      items: calcLines,
      manualDiscount,
      couponId,
      couponDiscountMinor,
      loyalty: {
        enabled: loyaltySettings.enabled && !!input.customer_id,
        pointsPerEgp: loyaltySettings.pointsPerEgp,
        egpPerPointMinor: toMinorUnits(loyaltySettings.egpPerPoint),
        pointsRedeemed: pointsRequested,
        pointsBalance: customer ? Number(customer.loyalty_points) : undefined,
      },
      tax: {
        enabled: tax.enabled,
        ratePercent: tax.rate,
        mode: (tax.mode as TaxMode) === 'exclusive' ? 'exclusive' : 'inclusive',
      },
      tipMinor: toMinorUnits(input.tip || 0),
    });

    return { breakdown, resolvedItems, customer };
  }

  /**
   * Validate the request's `payments` entries against the authoritative
   * `amountDueMinor` from `buildBreakdown` and return exactly the entries to
   * persist -- never coerced/rounded into balance. See types.ts for the full
   * documented split-payment policy (methods, duplicates, precision, zero-
   * due, and the compatibility gate).
   *
   * Returns `[]` (no `sale_payments` rows) when `payments` is omitted --
   * the unchanged, non-split compatibility path.
   */
  private resolvePayments(
    payments: PaymentInput[] | undefined,
    amountDueMinor: number
  ): ConfirmedPayment[] {
    if (!payments) return [];

    if (!STRICT_SPLIT_PAYMENT_VALIDATION) {
      // Compatibility gate disabled (emergency rollback only -- see
      // STRICT_SPLIT_PAYMENT_VALIDATION in types.ts): persist entries as
      // provided, without enforcing sum equality.
      return payments.map((p) => ({ method: p.method, amount: p.amount }));
    }

    if (payments.length === 0) {
      throw new SalesValidationError(
        'Split payment entries cannot be empty',
        SPLIT_PAYMENT_MISMATCH_CODE
      );
    }

    let sumMinor = 0;
    for (const p of payments) {
      const amountMinor = toMinorUnits(p.amount);
      if (!Number.isFinite(amountMinor) || amountMinor < 0) {
        throw new SalesValidationError(
          'Payment amount must be a non-negative finite value',
          SPLIT_PAYMENT_MISMATCH_CODE
        );
      }
      sumMinor += amountMinor;
    }

    // Exact integer minor-unit equality -- no float tolerance. Matches the
    // client's allocateSplit (client/src/shared/lib/checkout.ts, Unit 3).
    if (sumMinor !== amountDueMinor) {
      throw new SalesValidationError(
        `Split payment total (${fromMinorUnits(sumMinor)}) does not equal the authoritative amount due (${fromMinorUnits(amountDueMinor)})`,
        SPLIT_PAYMENT_MISMATCH_CODE
      );
    }

    return payments.map((p) => ({ method: p.method, amount: p.amount }));
  }

  async calculateSaleTotals(
    input: CreateSaleDTO,
    queryable: Queryable = pool
  ): Promise<SaleTotals> {
    const { breakdown } = await this.buildBreakdown(input, queryable, false);
    return {
      subtotal: fromMinorUnits(breakdown.subtotalMinor),
      discountAmount: fromMinorUnits(breakdown.manualDiscountMinor),
      afterDiscount: fromMinorUnits(breakdown.subtotalMinor - breakdown.manualDiscountMinor),
      taxAmount: fromMinorUnits(breakdown.taxAmountMinor),
      pointsDiscount: fromMinorUnits(breakdown.pointsDiscountMinor),
      couponId: breakdown.couponId,
      couponDiscount: fromMinorUnits(breakdown.couponDiscountMinor),
      tipAmount: fromMinorUnits(breakdown.tipMinor),
      total: fromMinorUnits(breakdown.amountDueMinor),
    };
  }

  async executeSale(
    input: CreateSaleDTO,
    cashierId: number,
    clientOrPool?: any
  ): Promise<Record<string, any>> {
    return withTransaction(async (client) => {
      const { breakdown, resolvedItems, customer } = await this.buildBreakdown(input, client, true);

      // Validate BEFORE persisting anything: a mismatched/invalid split must
      // create no sale, items, payments, coupon usage, loyalty change, or
      // register movement. `withTransaction` rolls back on any thrown error,
      // but failing fast here avoids doing pointless work first.
      const confirmedPayments = this.resolvePayments(input.payments, breakdown.amountDueMinor);

      const sale = await this.repo.createSale(
        {
          total: fromMinorUnits(breakdown.amountDueMinor),
          discount: input.discount || 0,
          discount_type: input.discount_type || 'fixed',
          payment_method:
            confirmedPayments.length > 1
              ? 'Split'
              : confirmedPayments.length === 1
                ? confirmedPayments[0].method
                : input.payment_method,
          cashier_id: cashierId,
          customer_id: input.customer_id || null,
          tax_amount: fromMinorUnits(breakdown.taxAmountMinor),
          points_redeemed: breakdown.pointsRedeemed,
          notes: input.notes || null,
          tip_amount: fromMinorUnits(breakdown.tipMinor),
          coupon_id: breakdown.couponId,
          coupon_discount: fromMinorUnits(breakdown.couponDiscountMinor),
        },
        client
      );

      await this.repo.createSaleCalculation(
        {
          sale_id: sale.id,
          contract_version: `v${breakdown.contractVersion}`,
          subtotal: fromMinorUnits(breakdown.subtotalMinor),
          manual_discount: fromMinorUnits(breakdown.manualDiscountMinor),
          coupon_id: breakdown.couponId,
          coupon_discount: fromMinorUnits(breakdown.couponDiscountMinor),
          points_redeemed: breakdown.pointsRedeemed,
          points_discount: fromMinorUnits(breakdown.pointsDiscountMinor),
          taxable_base: fromMinorUnits(breakdown.taxableBaseMinor),
          tax_mode: breakdown.taxMode,
          tax_rate_percent: breakdown.taxRatePercent,
          tax_amount: fromMinorUnits(breakdown.taxAmountMinor),
          tip_amount: fromMinorUnits(breakdown.tipMinor),
          amount_due: fromMinorUnits(breakdown.amountDueMinor),
          earned_points: breakdown.earnedPoints,
        },
        client
      );

      for (const p of confirmedPayments) {
        await this.repo.createSalePayment(sale.id, p.method, p.amount, client);
      }

      if (breakdown.couponId && breakdown.couponDiscountMinor > 0) {
        await this.repo.createCouponUsage(
          breakdown.couponId,
          sale.id,
          input.customer_id || null,
          fromMinorUnits(breakdown.couponDiscountMinor),
          client
        );
      }

      // Line rows keep the request's order, so the confirmed response's `items` array is
      // exactly what it always was.
      for (const item of resolvedItems) {
        await this.repo.createSaleItem(
          {
            sale_id: sale.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price: item.cost_price,
            memo: item.memo,
          },
          client
        );
      }

      // Stock writes run in a canonical order instead of the request's. Two concurrent
      // two-line checkouts naming the same products in opposite order would otherwise
      // take row locks in opposite order and deadlock. Sorting removes the cycle.
      for (const item of sortForStockWrites(resolvedItems)) {
        const isVariantLine = Boolean(item.isVariant && item.variant_id);

        const newStock = isVariantLine
          ? await this.repo.decrementVariantStock(item.variant_id!, item.quantity, client)
          : await this.repo.decrementProductStock(item.product_id, item.quantity, client);

        if (newStock === null) {
          // The guarded UPDATE matched nothing: stock was insufficient, or the row was
          // deleted between resolve and write. Either way the transaction rolls back and
          // no partial sale survives. The check in resolveLines is only a fail-fast
          // courtesy; this is the authority.
          throw new InsufficientStockError(
            isVariantLine
              ? `Insufficient stock for variant ID ${item.variant_id}`
              : `Insufficient stock for product ID ${item.product_id}`,
            item.product_id,
            isVariantLine ? item.variant_id! : null
          );
        }

        await this.repo.createStockAdjustment(
          {
            product_id: item.product_id,
            // Derived from RETURNING, so the audit trail records what actually happened
            // rather than what the earlier read predicted.
            previous_qty: newStock + item.quantity,
            new_qty: newStock,
            delta: -item.quantity,
            reason: 'Sale',
            user_id: cashierId,
          },
          client
        );
      }

      if (input.customer_id && customer) {
        if (breakdown.pointsRedeemed > 0) {
          const remaining = await this.repo.redeemCustomerLoyalty(
            input.customer_id,
            breakdown.pointsRedeemed,
            client
          );
          if (remaining === null) {
            // The balance moved between the breakdown's read and this write. Same
            // wording the stale check produces, so the client sees no change.
            throw new Error('Insufficient loyalty points');
          }
          await this.repo.createLoyaltyTransaction(
            input.customer_id,
            sale.id,
            -breakdown.pointsRedeemed,
            'redeemed',
            `Redeemed on sale #${sale.id}`,
            client
          );
        }

        if (breakdown.earnedPoints > 0) {
          await this.repo.updateCustomerLoyalty(input.customer_id, breakdown.earnedPoints, client);
          await this.repo.createLoyaltyTransaction(
            input.customer_id,
            sale.id,
            breakdown.earnedPoints,
            'earned',
            `Earned from sale #${sale.id}`,
            client
          );
        }
      }

      // Derive the cash-register movement from the confirmed, validated
      // split (never raw request values). Split mode: sum every 'Cash'
      // entry (duplicates allowed, see types.ts policy). Non-split
      // compatibility mode: the whole amount due, only when the single
      // declared method is 'Cash' -- matching current behavior. Runs inside
      // this same checkout transaction (via `client`) so it commits or
      // rolls back atomically with the sale; failures are NOT swallowed.
      const cashComponentMinor =
        confirmedPayments.length > 0
          ? confirmedPayments
              .filter((p) => p.method === 'Cash')
              .reduce((sum, p) => sum + toMinorUnits(p.amount), 0)
          : input.payment_method === 'Cash'
            ? breakdown.amountDueMinor
            : 0;

      if (cashComponentMinor > 0) {
        await this.register.recordSaleMovement(
          cashierId,
          sale.id,
          fromMinorUnits(cashComponentMinor),
          client
        );
      }

      const calculation: SaleCalculationSnapshot = {
        contractVersion: `v${breakdown.contractVersion}`,
        subtotal: fromMinorUnits(breakdown.subtotalMinor),
        manualDiscount: fromMinorUnits(breakdown.manualDiscountMinor),
        couponId: breakdown.couponId,
        couponDiscount: fromMinorUnits(breakdown.couponDiscountMinor),
        pointsRedeemed: breakdown.pointsRedeemed,
        pointsDiscount: fromMinorUnits(breakdown.pointsDiscountMinor),
        taxableBase: fromMinorUnits(breakdown.taxableBaseMinor),
        taxMode: breakdown.taxMode,
        taxRatePercent: breakdown.taxRatePercent,
        taxAmount: fromMinorUnits(breakdown.taxAmountMinor),
        tipAmount: fromMinorUnits(breakdown.tipMinor),
        amountDue: fromMinorUnits(breakdown.amountDueMinor),
        earnedPoints: breakdown.earnedPoints,
      };

      // Additive confirmed-response fields (R6/R9): existing consumers keep
      // every existing field on `sale` untouched; `calculation`/`items`/
      // `payments` are new. `items`/`payments` mirror exactly what was just
      // persisted -- authoritative prices and validated entries, never
      // re-derived from the request.
      return {
        ...sale,
        calculation,
        items: resolvedItems.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          memo: item.memo ?? null,
        })),
        payments: confirmedPayments,
      };
    }, clientOrPool);
  }

  async executeRefund(
    saleId: number,
    input: CreateRefundDTO,
    cashierId: number,
    clientOrPool?: any
  ): Promise<{ refund: Record<string, any>; refundStatus: string; newRefundedTotal: number }> {
    return withTransaction(async (client) => {
      const sale = await this.repo.findById(saleId, client);
      if (!sale) throw new Error('Sale not found');
      if (sale.refund_status === 'full') throw new Error('Sale already fully refunded');

      const saleItems = await this.repo.findItemsBySaleId(saleId, client);

      for (const refundItem of input.items) {
        const saleItem = saleItems.find((si) => si.product_id === refundItem.product_id);
        if (!saleItem) throw new Error(`Product ${refundItem.product_id} not in this sale`);
        if (refundItem.quantity > saleItem.quantity) {
          throw new Error(
            `Refund quantity exceeds sold quantity for product ${refundItem.product_id}`
          );
        }
      }

      let refundAmount = 0;
      for (const item of input.items) {
        refundAmount += item.unit_price * item.quantity;
      }

      const previouslyRefunded = Number(sale.refunded_amount) || 0;
      if (previouslyRefunded + refundAmount > Number(sale.total)) {
        throw new Error('Refund amount exceeds sale total');
      }

      const newRefundedTotal = previouslyRefunded + refundAmount;
      const refundStatus = newRefundedTotal >= Number(sale.total) ? 'full' : 'partial';

      const refund = await this.repo.createRefund(
        {
          sale_id: saleId,
          amount: refundAmount,
          reason: input.reason,
          items: input.items,
          restock: input.restock,
          cashier_id: cashierId,
        },
        client
      );

      await this.repo.updateSaleRefundStatus(saleId, refundStatus, newRefundedTotal, client);

      if (input.restock) {
        for (const item of input.items) {
          const product = await this.repo.getProductById(item.product_id, client);
          const currentStock = Number(product?.stock || 0);
          await this.repo.updateProductStock(item.product_id, currentStock + item.quantity, client);
        }
      }

      return { refund, refundStatus, newRefundedTotal };
    }, clientOrPool);
  }
}

export const salesService = new SalesService();
