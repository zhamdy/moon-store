import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { CartLine } from '../utils/cart-lines';
import { buildCartQuoteBody, parseCartQuote, quoteCart } from './quote-cart';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const LINES: CartLine[] = [
  { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 },
  { slug: 'leather-tote', options: {}, quantity: 1 },
];

function validQuote() {
  return {
    lines: [
      {
        index: 0,
        slug: 'silk-midi-dress',
        status: 'ok',
        product: { slug: 'silk-midi-dress', name: 'فستان', nameEn: 'Silk midi dress', image: null },
        options: [{ key: 'size', label: 'Size', value: 'M' }],
        unitPrice: 2850,
        requestedQuantity: 2,
        quantity: 2,
        maxQuantity: 5,
        lineTotal: 5700,
      },
      {
        index: 1,
        slug: 'leather-tote',
        status: 'productUnavailable',
        product: null,
        options: [],
        unitPrice: null,
        requestedQuantity: 1,
        quantity: 0,
        maxQuantity: 0,
        lineTotal: 0,
      },
    ],
    subtotal: 5700,
    itemCount: 2,
    maxLineQuantity: 10,
  };
}

function expectInvalid(mutate: (quote: ReturnType<typeof validQuote>) => unknown) {
  const quote = validQuote();
  const returned = mutate(quote);
  const data = returned === undefined ? quote : returned;
  let caught: unknown;
  try {
    parseCartQuote(data, LINES);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiError);
  expect((caught as ApiError).code).toBe('INVALID_RESPONSE');
}

describe('buildCartQuoteBody', () => {
  it('sends exactly slug, options and quantity per line, dropping anything else', () => {
    const withExtras = [
      { ...LINES[0], price: 1, name: 'x' },
      { ...LINES[1], nameEn: 'y' },
    ] as unknown as CartLine[];

    const body = buildCartQuoteBody(withExtras);

    expect(Object.keys(body)).toEqual(['lines']);
    for (const line of body.lines) {
      expect(Object.keys(line).sort()).toEqual(['options', 'quantity', 'slug']);
    }
    expect(body.lines).toEqual([
      { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 },
      { slug: 'leather-tote', options: {}, quantity: 1 },
    ]);
  });
});

describe('quoteCart', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('POSTs the body to the quote path with credentials omitted and no server token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: validQuote() }));

    const quote = await quoteCart(LINES);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/v1/catalog/cart/quote');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(Object.keys(init?.headers as Record<string, string>)).not.toContain(
      'X-Catalog-Server-Token'
    );
    expect(JSON.parse(init?.body as string)).toEqual(buildCartQuoteBody(LINES));
    expect(quote).toEqual(validQuote());
  });

  it('passes a server error through unchanged (400 VALIDATION_ERROR)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'bad' } })
    );

    await expect(quoteCart(LINES)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects a malformed 200 with INVALID_RESPONSE', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: { subtotal: 0 } }));

    await expect(quoteCart(LINES)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('parseCartQuote', () => {
  it('accepts the contract shape', () => {
    expect(parseCartQuote(validQuote(), LINES)).toEqual(validQuote());
  });

  it('rejects a missing or non-array lines', () => {
    expectInvalid((q) => ({ ...q, lines: undefined }));
    expectInvalid((q) => ({ ...q, lines: {} }));
    expectInvalid(() => null);
  });

  it('rejects a line count that does not match the request', () => {
    expectInvalid((q) => ({ ...q, lines: q.lines.slice(0, 1) }));
  });

  it('rejects lines out of request order or naming another slug', () => {
    expectInvalid((q) => {
      q.lines[0]!.index = 1;
    });
    expectInvalid((q) => {
      q.lines[1]!.slug = 'silk-midi-dress';
    });
  });

  it('rejects a non-numeric unitPrice, and null on a resolved line', () => {
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).unitPrice = '2850.00';
    });
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).unitPrice = null;
    });
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).unitPrice = Number.NaN;
    });
  });

  it('rejects a non-numeric subtotal, itemCount or lineTotal', () => {
    expectInvalid((q) => ({ ...q, subtotal: '5700' }));
    expectInvalid((q) => ({ ...q, itemCount: 1.5 }));
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).lineTotal = undefined;
    });
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).quantity = -1;
    });
  });

  it('rejects an unknown status', () => {
    expectInvalid((q) => {
      q.lines[0]!.status = 'backordered';
    });
  });

  it('rejects malformed options and a missing product on a resolved line', () => {
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).options = [{ key: 'size', value: 'M' }];
    });
    expectInvalid((q) => {
      (q.lines[0] as Record<string, unknown>).product = null;
    });
    expectInvalid((q) => {
      (q.lines[0]!.product as Record<string, unknown>).image = { url: 5 };
    });
  });
});
