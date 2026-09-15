import type { CheckoutReadiness } from '@/features/cart/utils/checkout-readiness';
import type { CheckoutOutcome } from '../commerce/checkout-commerce';

/**
 * Continue, as a pure state machine (plan 2026-09-15-002, *Submit machine*). The island
 * performs each returned effect and feeds results back as events.
 *
 * The refresh race (CO-14): in the commit that enters `verifying`, TanStack still reports the
 * previous settled quote, so a `ready` seen before the refresh settles would submit on a stale
 * quote. `verifying` therefore ignores readiness until a `refreshed` event, and even then
 * accepts `ready` only for the current lines' key (a bag edited mid-submit keeps it waiting).
 */

export type SubmitPhase =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'verifying'; refreshed: boolean }
  | { kind: 'submitting'; quoteKey: string }
  | { kind: 'outcome'; outcome: CheckoutOutcome };

export interface SubmitState {
  phase: SubmitPhase;
  /** Continue was pressed at least once: the checking notice may show from now on. */
  attempted: boolean;
}

export type SubmitEvent =
  | { type: 'submit' }
  | { type: 'validated'; ok: boolean }
  | { type: 'refreshed' }
  | { type: 'readiness'; readiness: CheckoutReadiness; currentKey: string }
  | { type: 'outcome'; outcome: CheckoutOutcome }
  /** A form value changed. */
  | { type: 'edited' }
  | { type: 'quoteKeyChanged' };

export type SubmitEffect =
  | { kind: 'validate' }
  | { kind: 'focusFirstInvalid' }
  | { kind: 'refresh' }
  | { kind: 'submit'; quoteKey: string }
  | { kind: 'focusCartNotice' }
  | { kind: 'focusEmptyHeading' }
  | { kind: 'showOutcome'; outcome: CheckoutOutcome };

export interface Transition {
  state: SubmitState;
  effect: SubmitEffect | null;
}

export const INITIAL_SUBMIT_STATE: SubmitState = { phase: { kind: 'idle' }, attempted: false };

/** Busy phases: Continue is `aria-disabled` and a second press is ignored. */
export function isSubmitBusy(phase: SubmitPhase): boolean {
  return phase.kind === 'validating' || phase.kind === 'verifying' || phase.kind === 'submitting';
}

function stay(state: SubmitState): Transition {
  return { state, effect: null };
}

function to(state: SubmitState, phase: SubmitPhase, effect: SubmitEffect | null): Transition {
  return { state: { ...state, phase }, effect };
}

export function transition(state: SubmitState, event: SubmitEvent): Transition {
  const { phase } = state;

  switch (event.type) {
    case 'submit':
      if (isSubmitBusy(phase)) return stay(state);
      return {
        state: { phase: { kind: 'validating' }, attempted: true },
        effect: { kind: 'validate' },
      };

    case 'validated':
      if (phase.kind !== 'validating') return stay(state);
      return event.ok
        ? to(state, { kind: 'verifying', refreshed: false }, { kind: 'refresh' })
        : to(state, { kind: 'idle' }, { kind: 'focusFirstInvalid' });

    case 'refreshed':
      if (phase.kind !== 'verifying' || phase.refreshed) return stay(state);
      return to(state, { kind: 'verifying', refreshed: true }, null);

    case 'readiness': {
      if (phase.kind !== 'verifying' || !phase.refreshed) return stay(state);
      const { readiness, currentKey } = event;
      switch (readiness.kind) {
        case 'hydrating':
        case 'checking':
          return stay(state);
        case 'ready':
          return readiness.quoteKey === currentKey
            ? to(
                state,
                { kind: 'submitting', quoteKey: readiness.quoteKey },
                { kind: 'submit', quoteKey: readiness.quoteKey }
              )
            : stay(state);
        case 'blocked':
        case 'failed':
          return to(state, { kind: 'idle' }, { kind: 'focusCartNotice' });
        case 'empty':
          return to(state, { kind: 'idle' }, { kind: 'focusEmptyHeading' });
      }
      return stay(state);
    }

    case 'outcome':
      if (phase.kind !== 'submitting') return stay(state);
      return to(
        state,
        { kind: 'outcome', outcome: event.outcome },
        { kind: 'showOutcome', outcome: event.outcome }
      );

    case 'edited':
    case 'quoteKeyChanged':
      return phase.kind === 'outcome' ? to(state, { kind: 'idle' }, null) : stay(state);
  }
}
