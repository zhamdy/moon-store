/**
 * One mutation lifecycle for the whole app: a pending state that cannot be
 * double-submitted, and a terminal state that says what failed and what the
 * user can do about it.
 *
 * ## Why a ref and not `isPending`
 *
 * `isPending` is React state. Between `mutate()` and the re-render that flips
 * it, the button is still enabled and a second click still fires. HeroUI's
 * `isLoading` does disable the button (`isDisabled = isDisabledProp ||
 * isLoading`), so the window is narrow — but it is a *render* wide, and a
 * double-click, a wireless barcode gun's repeat, or a shortcut key held down
 * all fit inside it. The ref below is set synchronously inside `submit`, so
 * the second call is dropped before React is involved at all.
 *
 * This is the CLIENT half of double-submit protection. The server half is
 * already solved for the writes that matter: `POST /api/v1/sales` and the
 * other retry-prone endpoints are idempotency-keyed, so a duplicate that does
 * escape returns the original outcome instead of charging twice. What was
 * missing is that a duplicate escaped at all — the two concurrent requests,
 * the second toast, and, for the endpoints with no key, the second row.
 *
 * ## Terminal state
 *
 * `failure` holds the classified last failure until the next submit, so a
 * caller can render recovery inline (field errors on a form, a review notice
 * on a cart) instead of losing it to a toast that vanishes in four seconds.
 */
import { useCallback, useRef, useState } from 'react';
import { useMutation, type MutateOptions } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { classifyMutationError, type MutationFailure } from './mutationError';

export interface GuardedMutationOptions<Args, Result> {
  mutationFn: (args: Args) => Promise<Result>;
  onSuccess?: (result: Result, args: Args) => void;
  /**
   * Runs before the default toast. Return `true` to say the failure has been
   * presented some other way (an inline notice, a field error) and suppress
   * it. Returning nothing keeps the toast.
   */
  onFailure?: (failure: MutationFailure, args: Args) => boolean | void;
  /** Toasted on success. Omit for a silent write. */
  successMessage?: string;
  /**
   * Toasted instead of the classified message when the classifier had nothing
   * better — i.e. when the server sent no user-facing wording of its own.
   */
  fallbackMessage?: string;
}

export interface GuardedMutation<Args, Result> {
  /**
   * Fires the write. A no-op while one is already in flight.
   *
   * `options` are React Query's per-call callbacks, forwarded untouched — a
   * caller that needs the created row (to select the customer it just made,
   * say) passes `onSuccess` here rather than at hook level, where it would
   * close over stale state.
   */
  submit: (
    args: Args,
    options?: MutateOptions<Result, Error, Args, unknown>
  ) => void;
  isPending: boolean;
  /** The other terminal state. Reset when a new attempt starts. */
  isSuccess: boolean;
  /** The last failure, or null. Cleared when a new submit starts. */
  failure: MutationFailure | null;
  clearFailure: () => void;
  /** Escape hatch for callers that need the raw React Query mutation. */
  mutation: ReturnType<typeof useMutation<Result, Error, Args>>;
}

export function useGuardedMutation<Args, Result>({
  mutationFn,
  onSuccess,
  onFailure,
  successMessage,
  fallbackMessage,
}: GuardedMutationOptions<Args, Result>): GuardedMutation<Args, Result> {
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const inFlight = useRef(false);

  const mutation = useMutation<Result, Error, Args>({
    mutationFn,
    onSuccess: (result, args) => {
      setFailure(null);
      if (successMessage) toast.success(successMessage);
      onSuccess?.(result, args);
    },
    onError: (error, args) => {
      const classified = classifyMutationError(error);
      setFailure(classified);
      const handled = onFailure?.(classified, args) === true;
      // The server's own wording is the most specific thing anyone has; the
      // caller's domain sentence beats the generic per-kind one.
      if (!handled) toast.error(classified.serverMessage || fallbackMessage || classified.message);
    },
    // Released here rather than in onSuccess/onError so a callback that throws
    // cannot strand the guard and freeze the button for the life of the tab.
    onSettled: () => {
      inFlight.current = false;
    },
  });

  // `mutate` is referentially stable across renders in React Query v5, so
  // `submit` is too — safe to pass to a memoised child or an effect.
  const { mutate } = mutation;

  const submit = useCallback(
    (args: Args, options?: MutateOptions<Result, Error, Args, unknown>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setFailure(null);
      mutate(args, options);
    },
    [mutate]
  );

  const clearFailure = useCallback(() => setFailure(null), []);

  return {
    submit,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    failure,
    clearFailure,
    mutation,
  };
}
