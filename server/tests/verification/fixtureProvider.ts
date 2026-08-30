import { query } from '../../src/database/pool';

export interface SeededFixtures {
  user: { id: number; email: string };
  category: { id: number; name: string };
  product: { id: number; name: string; sku: string };
  customer: { id: number; name: string; phone: string };
  branch: { id: number; name: string };
  distributor: { id: number; name: string };
  shippingCompany: { id: number; name: string };
  coupon: { id: number; code: string };
  giftCard: { id: number; code: string };
  vendor: { id: number; name: string };
}

export async function fetchSeededFixtures(): Promise<SeededFixtures> {
  const [
    userRes,
    catRes,
    prodRes,
    custRes,
    branchRes,
    distRes,
    shipRes,
    coupRes,
    giftRes,
    vendRes,
  ] = await Promise.all([
    query<{ id: number; email: string }>('SELECT id, email FROM users ORDER BY id ASC LIMIT 1'),
    query<{ id: number; name: string }>('SELECT id, name FROM categories ORDER BY id ASC LIMIT 1'),
    query<{ id: number; name: string; sku: string }>(
      'SELECT id, name, sku FROM products ORDER BY id ASC LIMIT 1'
    ),
    query<{ id: number; name: string; phone: string }>(
      'SELECT id, name, phone FROM customers ORDER BY id ASC LIMIT 1'
    ),
    query<{ id: number; name: string }>('SELECT id, name FROM branches ORDER BY id ASC LIMIT 1'),
    query<{ id: number; name: string }>(
      'SELECT id, name FROM distributors ORDER BY id ASC LIMIT 1'
    ),
    query<{ id: number; name: string }>(
      'SELECT id, name FROM shipping_companies ORDER BY id ASC LIMIT 1'
    ),
    query<{ id: number; code: string }>('SELECT id, code FROM coupons ORDER BY id ASC LIMIT 1'),
    query<{ id: number; code: string }>('SELECT id, code FROM gift_cards ORDER BY id ASC LIMIT 1'),
    query<{ id: number; name: string }>('SELECT id, name FROM vendors ORDER BY id ASC LIMIT 1'),
  ]);

  return {
    user: userRes.rows[0] || { id: 1, email: 'admin@moon.com' },
    category: catRes.rows[0] || { id: 1, name: 'Default' },
    product: prodRes.rows[0] || { id: 1, name: 'Default Product', sku: 'SKU-001' },
    customer: custRes.rows[0] || { id: 1, name: 'Default Customer', phone: '01000000000' },
    branch: branchRes.rows[0] || { id: 1, name: 'Main Branch' },
    distributor: distRes.rows[0] || { id: 1, name: 'Default Distributor' },
    shippingCompany: shipRes.rows[0] || { id: 1, name: 'Bosta' },
    coupon: coupRes.rows[0] || { id: 1, code: 'WELCOME10' },
    giftCard: giftRes.rows[0] || { id: 1, code: 'GC-1000' },
    vendor: vendRes.rows[0] || { id: 1, name: 'Default Vendor' },
  };
}
