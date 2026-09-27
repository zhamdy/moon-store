import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';
import { errorResponse } from '../../src/http/errors';

describe('credentialed API CORS rejection', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it.each(['GET', 'OPTIONS'])('returns 403 without credentialed headers for %s', async (method) => {
    const response = await fetch(`${base}/api/health/live`, {
      method,
      headers: { Origin: 'https://evil-attacker.vercel.app' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(errorResponse('FORBIDDEN', 'Origin not allowed'));
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('preserves allowed and origin-free requests', async () => {
    const allowed = await fetch(`${base}/api/health/live`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const noOrigin = await fetch(`${base}/api/health/live`);
    expect(noOrigin.status).toBe(200);
  });
});
