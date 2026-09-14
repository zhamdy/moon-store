/**
 * The real app on an ephemeral port, for tests that must cross the HTTP boundary.
 *
 * Service-level tests call past the Zod schema, so a field the schema never declared
 * passes them while the API strips it (root CLAUDE.md, *Learnings*). These go through
 * `createApp()` -- routing, the global limiter, `verifyToken`, `requireRole`, the
 * contract parse -- with a signed token rather than a mocked request.
 *
 * The caller installs the pool (`setPool`) first; this opens no connection of its own.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';

/** A response row as a test reads it: indexable without `any`, with the id every row has. */
export type JsonRow = { [key: string]: unknown; id: number };

/**
 * The envelope, loosely. `data` is one row or a list depending on the route, so it is
 * typed as both; a test asserting on the wrong shape fails on the assertion, not here.
 */
export interface HttpBody {
  data: JsonRow & JsonRow[];
  error: {
    code: string;
    message: string;
    details: Array<{ field: string; code: string; message: string }>;
  };
}

export interface HttpResult {
  status: number;
  body: HttpBody;
}

export interface HttpHarness {
  request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<HttpResult>;
  /** A multipart upload of one file, the way the dashboard sends images. */
  upload(path: string, field: string, filename: string, bytes: Buffer): Promise<HttpResult>;
  close(): Promise<void>;
}

export async function startHttpApp(role: 'Admin' | 'Cashier' = 'Admin'): Promise<HttpHarness> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const token = jwt.sign(
    { id: 1, email: 'admin@moon.com', role, name: 'Test Admin' },
    process.env.JWT_SECRET as string
  );

  return {
    async request(method, path, body) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : null) as HttpBody };
    },
    async upload(path, field, filename, bytes) {
      const form = new FormData();
      form.append(field, new Blob([new Uint8Array(bytes)]), filename);
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : null) as HttpBody };
    },
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
