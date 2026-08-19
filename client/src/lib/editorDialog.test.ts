import { describe, it, expect } from 'vitest';
import {
  reduceEditor,
  initialEditorState,
  type EditorEvent,
  type EditorState,
} from './editorDialog';

interface VendorForm {
  name: string;
  email: string;
  commission_rate: number;
}

const EMPTY: VendorForm = { name: '', email: '', commission_rate: 15 };

/** Drives a sequence of events through the reducer, no React involved. */
function run(events: EditorEvent<VendorForm>[], empty = EMPTY): EditorState<VendorForm> {
  return events.reduce(
    (state, event) => reduceEditor(state, event, empty),
    initialEditorState(empty)
  );
}

describe('editor dialog state machine', () => {
  it('starts closed, creating, and empty', () => {
    const state = initialEditorState(EMPTY);

    expect(state).toEqual({ open: false, editingId: null, values: EMPTY });
  });

  it('opens for a new record with the starting values', () => {
    const state = run([{ type: 'openNew' }]);

    expect(state.open).toBe(true);
    expect(state.editingId).toBeNull();
    expect(state.values).toEqual(EMPTY);
  });

  it('opens for an existing record with that record loaded', () => {
    const state = run([
      { type: 'openEdit', id: 7, values: { name: 'Zahra', email: 'z@x.com', commission_rate: 20 } },
    ]);

    expect(state.open).toBe(true);
    expect(state.editingId).toBe(7);
    expect(state.values.name).toBe('Zahra');
  });

  it('changes one field and leaves the rest alone', () => {
    const state = run([{ type: 'openNew' }, { type: 'set', field: 'name', value: 'Layla' }]);

    expect(state.values).toEqual({ ...EMPTY, name: 'Layla' });
  });

  it('does not mutate the values it was handed', () => {
    const empty = { ...EMPTY };
    run([{ type: 'openNew' }, { type: 'set', field: 'name', value: 'Layla' }], empty);

    expect(empty).toEqual(EMPTY);
  });

  it('forgets the edited record when closed, so the next open starts clean', () => {
    const state = run([
      { type: 'openEdit', id: 7, values: { name: 'Zahra', email: 'z@x.com', commission_rate: 20 } },
      { type: 'close' },
    ]);

    expect(state.open).toBe(false);
    expect(state.editingId).toBeNull();
    expect(state.values).toEqual(EMPTY);
  });

  it('does not carry one record edit into the next', () => {
    const state = run([
      { type: 'openEdit', id: 7, values: { name: 'Zahra', email: 'z@x.com', commission_rate: 20 } },
      { type: 'close' },
      { type: 'openNew' },
    ]);

    expect(state.editingId).toBeNull();
    expect(state.values).toEqual(EMPTY);
  });

  it('switches straight from editing one record to another', () => {
    const state = run([
      { type: 'openEdit', id: 7, values: { name: 'Zahra', email: 'z@x.com', commission_rate: 20 } },
      { type: 'openEdit', id: 9, values: { name: 'Nour', email: 'n@x.com', commission_rate: 12 } },
    ]);

    expect(state.editingId).toBe(9);
    expect(state.values.name).toBe('Nour');
  });

  it('keeps edits to an existing record against that record, not a new one', () => {
    const state = run([
      { type: 'openEdit', id: 7, values: { name: 'Zahra', email: 'z@x.com', commission_rate: 20 } },
      { type: 'set', field: 'commission_rate', value: 25 },
    ]);

    expect(state.editingId).toBe(7);
    expect(state.values.commission_rate).toBe(25);
  });

  it('treats a record with id 0 as editing, not creating', () => {
    const state = run([{ type: 'openEdit', id: 0, values: EMPTY }]);

    expect(state.editingId).toBe(0);
    expect(state.editingId !== null).toBe(true);
  });
});
