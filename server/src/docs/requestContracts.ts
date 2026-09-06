/**
 * Every operation's request contract, in one list (#102).
 *
 * This file only *collects*. Contracts are declared in the module that serves them, beside
 * the schemas, so a controller can parse through its own contract without importing
 * anything from `docs/` — the dependency runs modules → docs, never back.
 *
 * ## Coverage, and why "not listed" has to be impossible
 *
 * A served route that appears in neither list looks exactly like one that genuinely takes
 * no input: both produce a document with no request shape. `requestContractCoverage` is
 * the gate that refuses that, so an operation must be either a contract here or an
 * explicit entry in `unconvertedOperations` with a reason someone wrote down.
 *
 * Conversion is landing module by module. Until it finishes, `EXPECTED_UNCONVERTED` is the
 * ratchet: it is the count still to do, it may only fall, and the gate fails if it is left
 * above the true number — a ratchet above the real count has silently stopped ratcheting.
 */
import type { RequestContract, UnconvertedOperation } from '../http/requestContracts';
import { auditLogContractList } from '../modules/core/auditLog/schemas';
import { authContractList } from '../modules/core/auth/schemas';
import { branchesContractList } from '../modules/core/branches/schemas';
import { settingsContractList } from '../modules/core/settings/schemas';
import { usersContractList } from '../modules/core/users/schemas';
import { bundlesContractList } from '../modules/inventory/bundles/schemas';
import { categoriesContractList } from '../modules/inventory/categories/schemas';
import { collectionsContractList } from '../modules/inventory/collections/schemas';
import { labelTemplatesContractList } from '../modules/inventory/labelTemplates/schemas';
import { stockCountsContractList } from '../modules/inventory/stockCounts/schemas';
import { couponsContractList } from '../modules/commerce/coupons/schemas';
import { customersContractList } from '../modules/commerce/customers/schemas';
import { feedbackContractList } from '../modules/commerce/feedback/schemas';
import { giftCardsContractList } from '../modules/commerce/giftCards/schemas';
import { onlineOrdersContractList } from '../modules/commerce/onlineOrders/schemas';
import { segmentsContractList } from '../modules/commerce/segments/schemas';
import { storefrontContractList } from '../modules/commerce/storefront/schemas';
import { vendorsContractList } from '../modules/commerce/vendors/schemas';
import { warrantyContractList } from '../modules/commerce/warranty/schemas';
import { exchangesContractList } from '../modules/pos/exchanges/schemas';
import { layawayContractList } from '../modules/pos/layaway/schemas';
import { registerContractList } from '../modules/pos/register/schemas';
import { reservationsContractList } from '../modules/pos/reservations/schemas';
import { salesContractList } from '../modules/pos/sales/schemas';
import { shiftsContractList } from '../modules/pos/shifts/schemas';
import { distributorsContractList } from '../modules/inventory/distributors/schemas';
import { productsContractList } from '../modules/inventory/products/schemas';
import { stockAdjustmentsContractList } from '../modules/inventory/stockAdjustments/schemas';

export const requestContracts: readonly RequestContract[] = [
  // Core
  ...auditLogContractList,
  ...authContractList,
  ...branchesContractList,
  ...settingsContractList,
  ...usersContractList,

  // Inventory
  ...bundlesContractList,
  ...categoriesContractList,
  ...collectionsContractList,
  ...labelTemplatesContractList,
  ...stockCountsContractList,
  ...distributorsContractList,
  ...productsContractList,
  ...stockAdjustmentsContractList,

  // POS
  ...exchangesContractList,
  ...layawayContractList,
  ...registerContractList,
  ...reservationsContractList,
  ...salesContractList,
  ...shiftsContractList,

  // Commerce
  ...couponsContractList,
  ...customersContractList,
  ...feedbackContractList,
  ...giftCardsContractList,
  ...onlineOrdersContractList,
  ...segmentsContractList,
  ...storefrontContractList,
  ...vendorsContractList,
  ...warrantyContractList,
];

/**
 * Operations that are accounted for without a Zod contract.
 *
 * `custom` needs a reason because it is a promise that the hand-written documentation was
 * checked against the parser by a person. `none` is a claim that the operation reads no
 * input at all, which the coverage test cannot verify on its own either.
 */
export const unconvertedOperations: readonly UnconvertedOperation[] = [
  {
    key: 'GET /api/health',
    classification: 'none',
    reason: 'Liveness probe, mounted on the app rather than the router. No input.',
  },
  {
    key: 'GET /api/health/live',
    classification: 'none',
    reason: 'Liveness probe. No input.',
  },
  {
    key: 'GET /api/health/ready',
    classification: 'none',
    reason: 'Readiness probe. No input.',
  },
];

/**
 * Served operations with **no request contract**, whether or not they are classified.
 *
 * Deliberately not "unclassified": that number went down when an operation was written
 * into `unconvertedOperations` with a reason, so the whole API could have reached zero
 * without one schema being derived. Progress has to mean derivation, and an explanation
 * is not progress. Classification is enforced separately, as an absolute — every served
 * operation is a contract or an entry above, always, with no ratchet involved.
 *
 * Lower it in the commit that converts a module; never raise it.
 */
export const EXPECTED_UNCONVERTED = 56;

/**
 * Served operations in neither list — not a contract, and not explained.
 *
 * This is the one that must reach **zero** before the served spec is cut over, because an
 * operation nobody classified is indistinguishable from one that genuinely takes no
 * input, and a document cannot be called derived while that ambiguity is in it.
 *
 * Two numbers rather than one because they answer different questions:
 * `EXPECTED_UNCONVERTED` is how much is derived, this is how much is accounted for, and
 * writing a reason moves only the second.
 */
export const EXPECTED_UNCLASSIFIED = 53;
