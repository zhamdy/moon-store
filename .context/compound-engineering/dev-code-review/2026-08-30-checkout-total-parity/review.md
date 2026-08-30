---
date: 2026-08-30
branch: zhamdy/fix-pos-checkout-total-parity
base: 24c81097cebf4026c8e3dde5fa15b129fe970da1
mode: interactive
plan: docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md
plan_source: explicit
reviewers: 14
verdict: not-ready
---

# Code Review: zhamdy/fix-pos-checkout-total-parity

Full synthesized report delivered in-session. Summary below; see conversation transcript for the complete P0-P3 breakdown, Requirements Completeness table, deployment checklist, and per-finding evidence.

## P0 — Must fix before merge

1. **Bundle checkout never reaches server-validated bundle pricing.** Client never attaches `bundle_id` to cart lines; `server/validators/saleSchema.ts`'s `saleItemSchema` also has no `bundle_id` field, so Zod strips it even if sent. Every bundle sale is repriced at full catalog total. Confirmed independently by correctness, security, and api-contract reviewers.
   `client/src/features/pos/components/CartPanel.tsx:490`, `server/validators/saleSchema.ts:3` — owner: human (multi-file, behavior-defining fix)

2. **Offline-queued sales drop tip/coupon/points/payments but are stamped as trustworthy (contract v1).** The offline-fallback payload in `CartPanel.tsx` omits fields the live checkout payload includes, then tags itself with a contract version that causes it to bypass quarantine and auto-replay.
   `client/src/features/pos/components/CartPanel.tsx:439` — owner: human

## P1 — Should fix

- Unbounded `tip` bypassed all amount-due validation in the non-split checkout path — **FIXED in this pass** (see Applied Fixes).
- TOCTOU race: two cashiers can double-redeem a single-use coupon (`server/src/modules/commerce/coupons/service.ts:104`) — owner: human, needs locking-strategy decision, coordinate with #42.
- TOCTOU race: unlocked customer-balance read lets loyalty points go negative under concurrent redemption (`server/src/modules/pos/sales/service.ts:503`) — owner: human, same coordination.
- New Zod payment constraints aren't covered by the `STRICT_SPLIT_PAYMENT_VALIDATION` rollback flag (`server/validators/saleSchema.ts:48`) — owner: human, policy call on rollback semantics.
- `checkoutMutation.onSuccess` reads live cart state, not the submitted snapshot (`CartPanel.tsx:383`) — owner: downstream-resolver, concrete fix (snapshot items at submit time).
- Plan-mandated `docs/CONVENTIONS.md` update never made despite plan marked complete — owner: downstream-resolver.

## P2/P3

See full report in conversation. Notable: CustomerDisplay/bundle-remainder/strict-flag-disabled paths lack test coverage; error routing in `controller.ts` still relies on brittle `message.includes()` despite typed errors existing; client calculation DTOs drop 5 server-exposed fields; OpenAPI response schema omits base sale fields; migration `003`'s down-migration is destructively non-idempotent for post-deploy data; `AGENTS.md` Learnings entry never added; `CustomerDisplay`'s pending clear-timeout isn't cancelled on rapid re-broadcast (pre-existing, newly the sole remaining path since this diff centralized the channel).

## Applied Fixes (safe_auto, this pass)

1. Hoisted `SPLIT_PAYMENT_MISMATCH_CODE` into `client/src/shared/lib/checkout.ts` as a single exported constant; `CartPanel.tsx` and `useOffline.ts` now import it instead of each redeclaring the literal.
2. Extracted `CreateSaleCalculationInput` into `server/src/modules/pos/sales/types.ts`; `ISalesRepository.createSaleCalculation` and `SalesRepository.createSaleCalculation` both reference it instead of independently inlining the same 15-field type.
3. Widened `paymentLabels` to `Record<PaymentMethod | 'Gift Card', string>` (added the `Gift Card` entry via the existing `cart.giftCard` i18n key) and removed the `as PaymentMethod` cast that was silently masking the gap.
4. Added `.finite()` and `.max(MAX_PAYMENT_AMOUNT_MAJOR)` to `tip` in `server/validators/saleSchema.ts`, matching the bound already applied to `paymentEntrySchema.amount` — closes the unbounded-tip P1 finding.

**Verification:** server (`npx tsc --noEmit`) — clean. Client (`npx tsc --noEmit`) — 0 new errors (all pre-existing errors are in unrelated files, none of the 3 touched files appear). `client` vitest: `checkout.test.ts` + `CartPanel.test.tsx` + `useOffline.test.tsx` — 69/69 passed. `server` vitest: `tests/sales.test.ts` — 91/91 passed.

## Residual Actionable Work (not auto-fixed)

Left as manual/human-owned per synthesis (financial-integrity P0/P1 items requiring design decisions or multi-file behavioral changes) — see P0/P1 sections above. No todo files were created; interactive mode does not require externalizing residual work, and the user chose to review this report directly rather than have it converted to tracked items.

## Advisory-only outputs

- Deployment Go/No-Go checklist (migrations 002/003, loyalty-alias audit query, rollback safety notes) — delivered in-session, not repeated here.
- Learnings-researcher: confirmed the referenced 2026-08-21 audit's tip-sign and client-price-trust findings are genuinely fixed in this diff; the reduced-offline-payload finding is only partially fixed (live path fixed, offline-fallback path still reduced — this is P0 #2 above).
- Agent-native-reviewer: no gaps: confirmed calculation, loyalty settings, and split-payment validation are all reachable via the same REST API the SPA uses.
