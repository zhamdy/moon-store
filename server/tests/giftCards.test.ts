/**
 * Issuing gift cards against real PostgreSQL: both minted identifiers and their
 * unique indexes (#141).
 *
 * Real PostgreSQL rather than pg-mem for the same reason the document-number suite is:
 * the retry narrows on `err.constraint`, which pg-mem does not populate, so on pg-mem
 * the narrowed branch simply never runs and the suite would prove nothing.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from './support/realPostgres';
import { GiftCardsRepository } from '../src/modules/commerce/giftCards/repository';
import { GiftCardsService } from '../src/modules/commerce/giftCards/service';

describeWithPostgres('issuing gift cards (#141)', () => {
  let harness: RealPostgresHarness;
  const repo = new GiftCardsRepository();

  beforeAll(async () => {
    harness = await setupRealPostgres('gift-cards', { maxConnections: 6 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    await harness.pool.query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES (1, 'Admin', 'admin@moon.com', 'x', 'Admin')`
    );
  });

  async function codes(): Promise<string[]> {
    const { rows } = await harness.pool.query<{ code: string }>(
      'SELECT code FROM gift_cards ORDER BY id'
    );
    return rows.map((r) => r.code);
  }

  it('re-rolls a generated code that is already taken', async () => {
    await harness.pool.query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, status)
       VALUES ('GC-TAKEN-0001', '8902000000017', 100, 100, 'active')`
    );

    let minted = 0;
    const service = new GiftCardsService(repo, () => {
      minted += 1;
      return minted === 1 ? 'GC-TAKEN-0001' : `GC-FREE-000${minted}`;
    });

    const card = await service.create({ initial_value: 250 }, 1);

    // The insert refereed it, rather than a SELECT deciding in advance.
    expect(card.code).toBe('GC-FREE-0002');
    expect(minted).toBe(2);
    expect(await codes()).toContain('GC-FREE-0002');
  });

  it('does not re-roll a code the caller chose', async () => {
    // A supplied code is the caller's; silently issuing a different one would be worse
    // than refusing. The controller maps this to CONFLICT.
    await harness.pool.query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, status)
       VALUES ('GC-MINE-0001', '8902000000017', 100, 100, 'active')`
    );

    let minted = 0;
    const service = new GiftCardsService(repo, () => {
      minted += 1;
      return 'GC-SHOULD-NOT-BE-USED';
    });

    await expect(
      service.create({ code: 'GC-MINE-0001', initial_value: 50 }, 1)
    ).rejects.toMatchObject({ code: '23505' });

    // The generator was never consulted, and no card was issued under another code.
    expect(minted).toBe(0);
    expect(await codes()).toEqual(['GC-MINE-0001']);
  });

  it('re-rolls a barcode that is already taken', async () => {
    // The barcode is MAX(barcode) + 1, so a card whose barcode is out of step with the
    // maximum -- or a concurrent issuer -- produces a collision the max-read cannot see.
    const service = new GiftCardsService(repo);
    const first = await service.create({ initial_value: 100 }, 1);

    // Occupy the number the max-read will compute next, from underneath it.
    const next = await service.generateGiftCardBarcode();
    await harness.pool.query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, status)
       VALUES ('GC-OCCUPIER-01', $1, 10, 10, 'active')`,
      [next]
    );

    const second = await service.create({ initial_value: 300 }, 1);

    expect(second.barcode).not.toBe(next);
    expect(second.barcode).not.toBe(first.barcode);
    expect(Number(second.initial_value)).toBe(300);
  });

  it('issues distinct codes and barcodes to concurrent callers', async () => {
    // The repro for the max-read race: concurrent issuers all read the same
    // MAX(barcode), all compute the same next value, and every one but the winner used
    // to lose with an unmapped 23505.
    //
    // Three, not more, because of how the retry converges: each round has exactly one
    // winner, so with N concurrent issuers the unluckiest needs N attempts, against a
    // default cap of 5. Four would pass but sit one attempt from the ceiling, which is
    // a flake waiting for a slow runner rather than a stronger assertion.
    const service = new GiftCardsService(repo);

    const outcomes = await Promise.all([
      service.create({ initial_value: 100 }, 1),
      service.create({ initial_value: 200 }, 1),
      service.create({ initial_value: 300 }, 1),
    ]);

    expect(new Set(outcomes.map((c) => c.code)).size).toBe(3);
    expect(new Set(outcomes.map((c) => c.barcode)).size).toBe(3);

    const { rows } = await harness.pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM gift_cards'
    );
    expect(rows[0].n).toBe(3);
  });
});
