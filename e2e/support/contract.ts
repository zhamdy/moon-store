/**
 * The money contract, read rather than restated (D7).
 *
 * `contracts/checkout-totals.v1.json` is already consumed by both calculators —
 * `client/src/shared/lib/checkout.ts` and `server/src/modules/pos/sales/service.ts` — and
 * each side is proven against it by its own unit suite. This suite's job is the wire
 * between them, not the arithmetic: it asserts that a named case *entered through the UI*
 * produces that case's `amountDueMinor` on screen and in the persisted row.
 *
 * So expected totals come from here. Hardcoding one would put the money rules in a third
 * place and create a two-way maintenance burden the contract file exists to prevent.
 */
import contract from '../../contracts/checkout-totals.v1.json';

export interface ContractItem {
  unitPriceMinor: number;
  quantity: number;
}

export interface ContractExpected {
  subtotalMinor: number;
  manualDiscountMinor: number;
  couponDiscountMinor: number;
  pointsDiscountMinor: number;
  taxableBaseMinor: number;
  taxAmountMinor: number;
  tipMinor: number;
  amountDueMinor: number;
  earnedPoints: number;
}

export interface ContractCase {
  name: string;
  input: {
    items: ContractItem[];
    tax: { enabled: boolean; ratePercent: number; mode: string };
    loyalty: {
      enabled: boolean;
      pointsPerEgp: number;
      egpPerPointMinor: number;
      pointsRedeemed: number;
    };
    couponDiscountMinor: number;
    manualDiscount: { type: string; valueMinor: number };
    tipMinor: number;
  };
  expected: ContractExpected;
}

const cases = contract.cases as ContractCase[];

/**
 * A named case. Throws rather than returning undefined: a renamed case must fail loudly
 * here, not silently turn an assertion into a comparison against `undefined`.
 */
export function contractCase(name: string): ContractCase {
  const found = cases.find((c) => c.name === name);
  if (!found) {
    throw new Error(
      `No case named "${name}" in contracts/checkout-totals.v1.json. ` +
        `Available: ${cases.map((c) => c.name).join(', ')}.`
    );
  }
  return found;
}

/** Minor units (piastres) to the major-unit number the UI and the API deal in. */
export function toMajor(minor: number): number {
  return minor / 100;
}
