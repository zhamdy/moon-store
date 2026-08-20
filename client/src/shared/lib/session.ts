/**
 * Minimal typed event emitter for cross-store session lifecycle events
 * (currently just `logout`). Deliberately zero-dependency: this is the
 * lowest module in `shared/`, and anything it imports becomes a cycle
 * candidate once slice barrels exist.
 *
 * Stores that need to react to a session event (cart, offline queue, ...)
 * should not self-register a subscriber in their own module — that only
 * runs once the module has been imported somewhere, which a persisted
 * store cannot guarantee. Instead the composition root subscribes eagerly
 * once at startup; see app/session.ts (client/src/main.tsx for now).
 */

export interface SessionEvents {
  logout: [];
}

export type SessionEventType = keyof SessionEvents;

type Handler<Type extends SessionEventType> = (...args: SessionEvents[Type]) => void;

const handlers: { [Type in SessionEventType]?: Set<Handler<Type>> } = {};

/** Registers `handler` for `type`. Returns a function that unsubscribes it. */
export function onSessionEvent<Type extends SessionEventType>(
  type: Type,
  handler: Handler<Type>
): () => void {
  const set = (handlers[type] ??= new Set());
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

/**
 * Runs every handler registered for `type`. A handler that throws is
 * isolated so it cannot prevent the remaining handlers from running (a
 * failing cart clear must not skip the queue clear).
 */
export function emitSessionEvent<Type extends SessionEventType>(
  type: Type,
  ...args: SessionEvents[Type]
): void {
  const set = handlers[type];
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(...args);
    } catch (error) {
      console.error(`[session] handler for "${type}" threw`, error);
    }
  }
}
