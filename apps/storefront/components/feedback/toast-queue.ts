/**
 * Pure pieces of the lazy toaster (owner decision 2026-09-15: Sonner stays, but off every
 * page's initial JavaScript). No React, no DOM and no `sonner` import, so they run under
 * vitest's node environment; `show-toast.ts` wires them to the real module and the toaster.
 */

/** Wraps a dynamic import so every caller shares one promise, and a rejection is not cached. */
export function memoizeLoader<M>(load: () => Promise<M>): () => Promise<M> {
  let pending: Promise<M> | null = null;
  return () => {
    if (pending === null) {
      pending = load().catch((error: unknown) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

export interface ToasterGate {
  /** Asks the toaster to load now (the first toast); idempotent. */
  request(): void;
  /** The toaster subscribes here; a request made before it subscribed is replayed. */
  onRequest(listener: () => void): () => void;
  /** True once the `Toaster` has mounted and a frame has passed, so its live region exists. */
  isReady(): boolean;
  whenReady(): Promise<void>;
  markReady(): void;
  /** The toaster unmounted: later toasts wait for the next mount. */
  markUnready(): void;
}

export function createToasterGate(): ToasterGate {
  let ready = false;
  let requested = false;
  const listeners = new Set<() => void>();
  let resolve: () => void = () => {};
  let promise = new Promise<void>((r) => (resolve = r));

  return {
    request() {
      requested = true;
      listeners.forEach((listener) => listener());
    },
    onRequest(listener) {
      listeners.add(listener);
      if (requested) listener();
      return () => {
        listeners.delete(listener);
      };
    },
    isReady: () => ready,
    whenReady: () => promise,
    markReady() {
      if (ready) return;
      ready = true;
      resolve();
    },
    markUnready() {
      // A gate that never opened keeps its promise, so a waiting flush survives a remount.
      if (!ready) return;
      ready = false;
      promise = new Promise<void>((r) => (resolve = r));
    },
  };
}

export interface ToastQueueDeps<M> {
  load(): Promise<M>;
  /** Called on every wait; the wiring also uses it to request the toaster. */
  whenReady(): Promise<void>;
  isReady(): boolean;
  onError?(error: unknown, dropped: number): void;
}

export interface ToastQueue<M> {
  run(operation: (module: M) => void): void;
}

/**
 * Operations made before the module has loaded and the toaster is ready are held in call
 * order and flushed together; after that they run synchronously. A failed load drops what
 * was held (logged, never thrown to the caller) and the next call retries.
 */
export function createToastQueue<M>({
  load,
  whenReady,
  isReady,
  onError = (error, dropped) => console.error(`Toasts could not load; ${dropped} dropped.`, error),
}: ToastQueueDeps<M>): ToastQueue<M> {
  let loaded: M | null = null;
  let pending: Array<(module: M) => void> = [];
  let inflight = false;

  const flush = (module: M) => {
    const operations = pending;
    pending = [];
    operations.forEach((operation) => operation(module));
  };

  const start = () => {
    if (inflight) return;
    inflight = true;
    Promise.all([load(), whenReady()]).then(
      ([module]) => {
        inflight = false;
        loaded = module;
        flush(module);
      },
      (error: unknown) => {
        inflight = false;
        const dropped = pending.length;
        pending = [];
        onError(error, dropped);
      }
    );
  };

  return {
    run(operation) {
      if (loaded !== null && isReady() && pending.length === 0) {
        operation(loaded);
        return;
      }
      pending.push(operation);
      start();
    },
  };
}
