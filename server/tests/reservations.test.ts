import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ReservationsController } from '../src/modules/pos/reservations/controller';
import type { IReservationsService } from '../src/modules/pos/reservations/service';
import reservationsRouter from '../src/modules/pos/reservations/routes';

describe('Reservations contract', () => {
  it('declares source release before the dynamic id route', () => {
    const deletePaths = (
      reservationsRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: { delete?: boolean } } }>;
      }
    ).stack
      .filter((layer) => layer.route?.methods.delete)
      .map((layer) => layer.route!.path);
    expect(deletePaths).toEqual(['/source/:sourceId', '/:id']);
  });

  it('returns a canonical create response', async () => {
    const reservation = {
      id: 1,
      product_id: 2,
      variant_id: null,
      quantity: 1,
      source_type: 'cart',
      source_id: null,
      expires_at: '2026-08-22T12:00:00Z',
    };
    const service = {
      createReservation: vi.fn().mockResolvedValue(reservation),
    } as unknown as IReservationsService;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    await new ReservationsController(service).createReservation(
      { body: { product_id: 2, quantity: 1, source_type: 'cart' } } as Request,
      { status, json } as unknown as Response,
      vi.fn()
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ data: reservation });
  });

  it('returns 204 when releasing one reservation', async () => {
    const service = {
      releaseReservation: vi.fn().mockResolvedValue(undefined),
    } as unknown as IReservationsService;
    const sendStatus = vi.fn();
    await new ReservationsController(service).deleteReservation(
      { params: { id: '4' } } as unknown as Request,
      { sendStatus } as unknown as Response,
      vi.fn()
    );
    expect(sendStatus).toHaveBeenCalledWith(204);
  });
});
