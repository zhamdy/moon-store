/**
 * The document-number allocator (#128), on its own.
 *
 * The four modules that use it are covered against a real database, where the retry keys
 * on `err.constraint`. These cases are about the helper's own decisions -- when it
 * retries, when it refuses to, and what it throws once it gives up -- which are pure
 * control flow and need no database at all.
 */
import { describe, expect, it } from 'vitest';
import { withDocumentNumber } from '../src/database/documentNumber';
import { PublicError } from '../src/http/errors';

/** A rejection shaped like the one node-postgres raises for a unique violation. */
function uniqueViolation(constraint?: string): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint,
  });
}

const options = (overrides: Partial<Parameters<typeof withDocumentNumber>[0]> = {}) => ({
  generate: () => 'DOC-1',
  constraint: 'widgets_number_key',
  label: 'widget number',
  ...overrides,
});

describe('withDocumentNumber (#128)', () => {
  it('passes the generated number through and returns what the work returned', async () => {
    const result = await withDocumentNumber(options(), async (number) => `used ${number}`);
    expect(result).toBe('used DOC-1');
  });

  it('generates a fresh number for each attempt, not one reused across them', async () => {
    const issued: string[] = [];
    let attempts = 0;

    const result = await withDocumentNumber(
      options({ generate: () => `DOC-${issued.length + 1}` }),
      async (number) => {
        issued.push(number);
        attempts += 1;
        if (attempts < 3) throw uniqueViolation('widgets_number_key');
        return number;
      }
    );

    expect(issued).toEqual(['DOC-1', 'DOC-2', 'DOC-3']);
    expect(result).toBe('DOC-3');
  });

  it('gives up with a typed CONFLICT once the attempts are spent, never a raw 23505', async () => {
    let attempts = 0;

    const failing = withDocumentNumber(options({ maxAttempts: 3 }), async () => {
      attempts += 1;
      throw uniqueViolation('widgets_number_key');
    });

    await expect(failing).rejects.toBeInstanceOf(PublicError);
    await expect(failing).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(failing).rejects.toThrow(/widget number/);
    expect(attempts).toBe(3);
  });

  it('does not retry a unique violation on a different constraint', async () => {
    // The load-bearing narrowing: an insert can break more than one unique index, and
    // re-rolling the document number cannot fix a duplicate email.
    let attempts = 0;

    const failing = withDocumentNumber(options(), async () => {
      attempts += 1;
      throw uniqueViolation('widgets_email_key');
    });

    await expect(failing).rejects.toMatchObject({ code: '23505' });
    expect(attempts).toBe(1);
  });

  it('does not retry a unique violation that names no constraint', async () => {
    // Without a name there is nothing to say the document number is what collided, so
    // the error is surfaced rather than guessed at.
    let attempts = 0;

    const failing = withDocumentNumber(options(), async () => {
      attempts += 1;
      throw uniqueViolation(undefined);
    });

    await expect(failing).rejects.toMatchObject({ code: '23505' });
    expect(attempts).toBe(1);
  });

  it('does not retry an error that is not a unique violation at all', async () => {
    let attempts = 0;

    const failing = withDocumentNumber(options(), async () => {
      attempts += 1;
      throw new Error('connection terminated');
    });

    await expect(failing).rejects.toThrow('connection terminated');
    expect(attempts).toBe(1);
  });

  it('succeeds on the last permitted attempt rather than one short of it', async () => {
    let attempts = 0;

    const result = await withDocumentNumber(options({ maxAttempts: 3 }), async (number) => {
      attempts += 1;
      if (attempts < 3) throw uniqueViolation('widgets_number_key');
      return number;
    });

    expect(result).toBe('DOC-1');
    expect(attempts).toBe(3);
  });
});
