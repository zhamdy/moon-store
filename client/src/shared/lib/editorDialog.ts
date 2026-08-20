import { useCallback, useMemo, useReducer, useRef } from 'react';

/**
 * The state every editor dialog in the app carries: whether it is showing,
 * which record it is editing (absent means creating), and the form values.
 */
export interface EditorState<Values> {
  open: boolean;
  editingId: number | null;
  values: Values;
}

export type EditorEvent<Values> =
  | { type: 'openNew' }
  | { type: 'openEdit'; id: number; values: Values }
  | { type: 'set'; field: keyof Values; value: Values[keyof Values] }
  | { type: 'resume' }
  | { type: 'close' };

/** Anything the dialog can be opened onto. */
export interface Editable {
  id: number;
}

/**
 * The transitions, as a pure function so they can be exercised without React.
 *
 * `empty` is passed in rather than closed over because opening for a new
 * record and closing both return the form to its starting values, and those
 * values are the caller's to define.
 */
export function reduceEditor<Values>(
  state: EditorState<Values>,
  event: EditorEvent<Values>,
  empty: Values
): EditorState<Values> {
  switch (event.type) {
    case 'openNew':
      return { open: true, editingId: null, values: empty };
    case 'openEdit':
      return { open: true, editingId: event.id, values: event.values };
    case 'set':
      return { ...state, values: { ...state.values, [event.field]: event.value } };
    case 'resume':
      return { ...state, open: true };
    case 'close':
      return { open: false, editingId: null, values: empty };
  }
}

export function initialEditorState<Values>(empty: Values): EditorState<Values> {
  return { open: false, editingId: null, values: empty };
}

export interface EditorDialog<Values, Row> {
  /** Is the dialog showing. */
  open: boolean;
  /** Editing an existing record, as opposed to creating one. */
  isEditing: boolean;
  /** The record being edited, for the caller to send back on save. */
  editingId: number | null;
  values: Values;
  set<K extends keyof Values>(field: K, value: Values[K]): void;
  openNew(): void;
  openEdit(row: Row): void;
  close(): void;
  /** For `<Dialog onOpenChange>`, which reports both directions. */
  setOpen(next: boolean): void;
}

/**
 * The editor-dialog state machine, which roughly every CRUD page in the app
 * used to hand-roll: open, which record, the form values, and the reset that
 * ties them together.
 *
 * `empty` may be a factory when the starting values are not constant — a form
 * defaulting to today's date wants that recomputed each time it opens, not
 * frozen at mount.
 *
 * `toValues` maps a server row onto form values, since the two rarely match:
 * rows carry numbers and nulls where a form carries strings.
 */
export function useEditorDialog<Values extends object, Row extends Editable = Editable>(
  empty: Values | (() => Values),
  toValues?: (row: Row) => Values
): EditorDialog<Values, Row> {
  // Held in a ref so an inline object literal does not re-seed the reducer on
  // every render, while a factory still recomputes per transition.
  const emptyRef = useRef(empty);
  emptyRef.current = empty;

  const makeEmpty = useCallback(
    () => (typeof emptyRef.current === 'function' ? emptyRef.current() : emptyRef.current),
    []
  );

  const toValuesRef = useRef(toValues);
  toValuesRef.current = toValues;

  const [state, dispatch] = useReducer(
    (current: EditorState<Values>, event: EditorEvent<Values>) =>
      reduceEditor(current, event, makeEmpty()),
    undefined,
    () => initialEditorState(makeEmpty())
  );

  const actions = useMemo(
    () => ({
      set<K extends keyof Values>(field: K, value: Values[K]) {
        dispatch({ type: 'set', field, value: value as Values[keyof Values] });
      },
      openNew: () => dispatch({ type: 'openNew' }),
      openEdit: (row: Row) => {
        const mapped = toValuesRef.current ? toValuesRef.current(row) : (row as unknown as Values);
        dispatch({ type: 'openEdit', id: row.id, values: mapped });
      },
      close: () => dispatch({ type: 'close' }),
      setOpen: (next: boolean) => dispatch(next ? { type: 'resume' } : { type: 'close' }),
    }),
    []
  );

  return {
    open: state.open,
    isEditing: state.editingId !== null,
    editingId: state.editingId,
    values: state.values,
    ...actions,
  };
}
