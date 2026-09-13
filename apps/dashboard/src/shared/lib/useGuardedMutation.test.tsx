import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ApiError } from './transport/types';
import { useSettingsStore } from '../store/settingsStore';
import { useGuardedMutation } from './useGuardedMutation';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** A mutationFn whose promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // A rejection settled later still needs a handler attached now, or Node
  // reports an unhandled rejection before React Query subscribes.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({ locale: 'en' });
});

describe('double-submit protection', () => {
  it('drops a second submit fired while the first is still in flight', async () => {
    const pending = deferred<string>();
    const mutationFn = vi.fn((_args: string) => pending.promise);

    const { result } = renderHook(() => useGuardedMutation({ mutationFn }), { wrapper });

    // Both calls inside ONE act(), i.e. inside one tick with no render
    // between them -- exactly the window `isPending` cannot close.
    act(() => {
      result.current.submit('once');
      result.current.submit('twice');
    });

    // React Query dispatches the mutationFn on a microtask, so flush before
    // counting -- the guard's work was already done, synchronously, above.
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    expect(mutationFn.mock.calls[0][0]).toBe('once');

    await act(async () => {
      pending.resolve('ok');
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it('accepts the next submit once the first has settled', async () => {
    const first = deferred<string>();
    const mutationFn = vi.fn(() => first.promise);

    const { result } = renderHook(() => useGuardedMutation({ mutationFn }), { wrapper });

    act(() => result.current.submit('a'));
    await act(async () => {
      first.resolve('ok');
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.submit('b'));
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
  });

  it('releases the guard after a failure, so the user can retry', async () => {
    const first = deferred<string>();
    const mutationFn = vi.fn(() => first.promise);

    const { result } = renderHook(() => useGuardedMutation({ mutationFn }), { wrapper });

    act(() => result.current.submit('a'));
    await act(async () => {
      first.reject(new ApiError('', null));
    });
    await waitFor(() => expect(result.current.failure).not.toBeNull());

    act(() => result.current.submit('a'));
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
  });

  it('exposes a pending state for the whole flight and a terminal state after it', async () => {
    const pending = deferred<string>();
    const { result } = renderHook(() => useGuardedMutation({ mutationFn: () => pending.promise }), {
      wrapper,
    });

    expect(result.current.isPending).toBe(false);
    act(() => result.current.submit('a'));
    await waitFor(() => expect(result.current.isPending).toBe(true));

    await act(async () => {
      pending.resolve('ok');
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.failure).toBeNull();
  });
});

describe('failure presentation', () => {
  async function failWith(error: unknown, options: Record<string, unknown> = {}) {
    const pending = deferred<string>();
    const { result } = renderHook(
      () => useGuardedMutation({ mutationFn: () => pending.promise, ...options }),
      { wrapper }
    );
    act(() => result.current.submit('a'));
    await act(async () => {
      pending.reject(error);
    });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    return result;
  }

  it('classifies the failure and keeps it as terminal state', async () => {
    const result = await failWith(
      new ApiError('Request validation failed', 400, 'VALIDATION_ERROR', [
        { field: 'price', code: 'too_small', message: 'Value is too small' },
      ])
    );

    expect(result.current.failure?.kind).toBe('validation');
    expect(result.current.failure?.recovery).toBe('fix');
    expect(result.current.failure?.fieldErrors).toEqual({ price: 'Value is too small' });
  });

  it('toasts the server wording ahead of the caller fallback', async () => {
    await failWith(new ApiError('Email already exists', 409, 'CONFLICT'), {
      fallbackMessage: 'Could not save user',
    });

    expect(toast.error).toHaveBeenCalledWith('Email already exists');
  });

  it('toasts the caller fallback when the server offered no wording of its own', async () => {
    await failWith(new ApiError('', null), { fallbackMessage: 'Could not save user' });

    expect(toast.error).toHaveBeenCalledWith('Could not save user');
  });

  it('toasts the classified message when there is no fallback either', async () => {
    await failWith(new ApiError('', 429, 'RATE_LIMITED'));

    expect(toast.error).toHaveBeenCalledWith('Too many requests. Wait a moment, then try again.');
  });

  it('suppresses the toast when the caller says it presented the failure itself', async () => {
    const onFailure = vi.fn(() => true);
    const result = await failWith(new ApiError('nope', 400, 'VALIDATION_ERROR'), { onFailure });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    // Suppressing the toast must not suppress the terminal state -- the whole
    // point is that the caller renders it somewhere durable.
    expect(result.current.failure?.kind).toBe('validation');
  });

  it('still toasts when onFailure inspects the failure but does not claim it', async () => {
    const onFailure = vi.fn(() => undefined);
    await failWith(new ApiError('Branch code already exists', 409, 'CONFLICT'), { onFailure });

    expect(toast.error).toHaveBeenCalledWith('Branch code already exists');
  });

  it('clears the previous failure when a new attempt starts', async () => {
    const result = await failWith(new ApiError('nope', 400, 'VALIDATION_ERROR'));

    act(() => result.current.submit('a'));
    expect(result.current.failure).toBeNull();
  });

  it('clears the failure on request', async () => {
    const result = await failWith(new ApiError('nope', 400, 'VALIDATION_ERROR'));

    act(() => result.current.clearFailure());
    expect(result.current.failure).toBeNull();
  });
});

describe('success', () => {
  it('toasts the success message and calls back with the result', async () => {
    const pending = deferred<string>();
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useGuardedMutation({
          mutationFn: () => pending.promise,
          successMessage: 'Saved',
          onSuccess,
        }),
      { wrapper }
    );

    act(() => result.current.submit('a'));
    await act(async () => {
      pending.resolve('row');
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('row', 'a'));
    expect(toast.success).toHaveBeenCalledWith('Saved');
  });

  it('says nothing when no success message was given', async () => {
    const pending = deferred<string>();
    const { result } = renderHook(() => useGuardedMutation({ mutationFn: () => pending.promise }), {
      wrapper,
    });

    act(() => result.current.submit('a'));
    await act(async () => {
      pending.resolve('row');
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
