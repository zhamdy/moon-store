import { describe, expect, it } from 'vitest';
import type { CheckoutReadiness } from '@/features/cart/utils/checkout-readiness';
import {
  INITIAL_SUBMIT_STATE,
  isSubmitBusy,
  transition,
  type SubmitEvent,
  type SubmitState,
} from './submit-machine';

const READY: CheckoutReadiness = {
  kind: 'ready',
  quoteKey: 'k1',
  pieces: 1,
  subtotal: 2850,
  priceUpdated: 0,
};
const BLOCKED: CheckoutReadiness = {
  kind: 'blocked',
  unavailable: 1,
  limited: 0,
  blockedKeys: ['a'],
};

function run(events: SubmitEvent[], start: SubmitState = INITIAL_SUBMIT_STATE) {
  const effects: (string | null)[] = [];
  let state = start;
  for (const event of events) {
    const next = transition(state, event);
    state = next.state;
    effects.push(next.effect?.kind ?? null);
  }
  return { state, effects };
}

const readiness = (value: CheckoutReadiness, currentKey = 'k1'): SubmitEvent => ({
  type: 'readiness',
  readiness: value,
  currentKey,
});

describe('submit machine', () => {
  it('happy path: validate, refresh, ready for the current key, submit, outcome', () => {
    const { state, effects } = run([
      { type: 'submit' },
      { type: 'validated', ok: true },
      { type: 'refreshed' },
      readiness(READY),
      { type: 'outcome', outcome: { kind: 'unavailable' } },
    ]);
    expect(effects).toEqual(['validate', 'refresh', null, 'submit', 'showOutcome']);
    expect(state).toEqual({
      phase: { kind: 'outcome', outcome: { kind: 'unavailable' } },
      attempted: true,
    });
  });

  it('an invalid form goes back to idle and focuses the first invalid field', () => {
    const { state, effects } = run([{ type: 'submit' }, { type: 'validated', ok: false }]);
    expect(effects).toEqual(['validate', 'focusFirstInvalid']);
    expect(state).toEqual({ phase: { kind: 'idle' }, attempted: true });
  });

  it('the refresh race: a ready verdict before the refresh settles never submits', () => {
    const { state, effects } = run([
      { type: 'submit' },
      { type: 'validated', ok: true },
      readiness(READY),
      readiness(READY),
    ]);
    expect(effects).toEqual(['validate', 'refresh', null, null]);
    expect(state.phase).toEqual({ kind: 'verifying', refreshed: false });

    const after = run([{ type: 'refreshed' }, readiness(BLOCKED)], state);
    expect(after.effects).toEqual([null, 'focusCartNotice']);
    expect(after.state.phase).toEqual({ kind: 'idle' });
  });

  it('after the refresh: checking waits, blocked and failed focus the notice, empty focuses its heading', () => {
    const verified = run([
      { type: 'submit' },
      { type: 'validated', ok: true },
      { type: 'refreshed' },
    ]).state;
    expect(run([readiness({ kind: 'checking' })], verified).state).toBe(verified);
    expect(run([readiness(BLOCKED)], verified).effects).toEqual(['focusCartNotice']);
    expect(run([readiness({ kind: 'failed', rejected: false })], verified).effects).toEqual([
      'focusCartNotice',
    ]);
    expect(run([readiness({ kind: 'empty' })], verified).effects).toEqual(['focusEmptyHeading']);
  });

  it('a ready quote for other lines keeps waiting for the re-quote', () => {
    const verified = run([
      { type: 'submit' },
      { type: 'validated', ok: true },
      { type: 'refreshed' },
    ]).state;
    const { state, effects } = run([readiness(READY, 'k2')], verified);
    expect(effects).toEqual([null]);
    expect(state.phase).toEqual({ kind: 'verifying', refreshed: true });
  });

  it('ignores a second press while busy (double-submit guard)', () => {
    const validating = run([{ type: 'submit' }]).state;
    expect(transition(validating, { type: 'submit' })).toEqual({ state: validating, effect: null });
    const verifying = run([{ type: 'validated', ok: true }], validating).state;
    expect(transition(verifying, { type: 'submit' }).effect).toBeNull();
    const submitting = run([{ type: 'refreshed' }, readiness(READY)], verifying).state;
    expect(submitting.phase.kind).toBe('submitting');
    expect(transition(submitting, { type: 'submit' }).effect).toBeNull();
    expect([validating, verifying, submitting].every((s) => isSubmitBusy(s.phase))).toBe(true);
  });

  it('an outcome clears on an edit or a bag change, and Continue can run again', () => {
    const outcome = run([
      { type: 'submit' },
      { type: 'validated', ok: true },
      { type: 'refreshed' },
      readiness(READY),
      { type: 'outcome', outcome: { kind: 'unavailable' } },
    ]).state;
    expect(transition(outcome, { type: 'edited' }).state.phase).toEqual({ kind: 'idle' });
    expect(transition(outcome, { type: 'quoteKeyChanged' }).state.phase).toEqual({ kind: 'idle' });
    expect(transition(outcome, { type: 'submit' }).effect).toEqual({ kind: 'validate' });
  });

  it('stray events outside their phase change nothing', () => {
    expect(transition(INITIAL_SUBMIT_STATE, { type: 'refreshed' }).state).toBe(
      INITIAL_SUBMIT_STATE
    );
    expect(transition(INITIAL_SUBMIT_STATE, readiness(READY)).state).toBe(INITIAL_SUBMIT_STATE);
    expect(
      transition(INITIAL_SUBMIT_STATE, { type: 'outcome', outcome: { kind: 'unavailable' } }).state
    ).toBe(INITIAL_SUBMIT_STATE);
    expect(transition(INITIAL_SUBMIT_STATE, { type: 'edited' }).state).toBe(INITIAL_SUBMIT_STATE);
  });
});
