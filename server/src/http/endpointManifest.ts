export type EndpointClassification = 'P' | 'B' | 'S' | 'M' | 'E';
export interface EndpointManifestEntry {
  classifications: readonly EndpointClassification[];
  authorization: {
    kind: 'public' | 'authenticated';
    roles: readonly string[];
    predicate: string | null;
  };
}

const authenticated = (
  classifications: readonly EndpointClassification[]
): EndpointManifestEntry => ({
  classifications,
  authorization: {
    kind: 'authenticated',
    roles: ['Admin', 'Cashier', 'Delivery'],
    predicate: 'endpoint-specific role/branch/record scope',
  },
});
const publicEntry = (
  classifications: readonly EndpointClassification[]
): EndpointManifestEntry => ({
  classifications,
  authorization: { kind: 'public', roles: [], predicate: null },
});

export const endpointManifest: Record<string, EndpointManifestEntry> = {
  '/api/v1/auth': publicEntry(['M', 'S']),
  '/api/v1/users': authenticated(['P', 'B', 'M']),
  '/api/v1/settings': authenticated(['S', 'M']),
  '/api/v1/audit-log': authenticated(['P', 'B']),
  '/api/v1/branches': authenticated(['B', 'P', 'S', 'M']),
  '/api/v1/sales': authenticated(['P', 'S', 'M']),
  '/api/v1/register': authenticated(['P', 'S', 'M']),
  '/api/v1/shifts': authenticated(['P', 'S', 'M']),
  '/api/v1/exchanges': authenticated(['P', 'S', 'M']),
  '/api/v1/layaway': authenticated(['P', 'S', 'M']),
  '/api/v1/reservations': authenticated(['M']),
  '/api/v1/products': authenticated(['P', 'B', 'S', 'M']),
  '/api/v1/categories': authenticated(['B', 'M']),
  '/api/v1/distributors': authenticated(['B', 'M']),
  '/api/v1/stock-counts': authenticated(['P', 'S', 'M']),
  '/api/v1/stock-adjustments': authenticated(['P']),
  '/api/v1/bundles': authenticated(['P', 'S', 'M']),
  '/api/v1/collections': authenticated(['P', 'S', 'M']),
  '/api/v1/label-templates': authenticated(['B', 'M']),
  '/api/v1/customers': authenticated(['P', 'S', 'M']),
  '/api/v1/coupons': authenticated(['P', 'M']),
  '/api/v1/gift-cards': authenticated(['P', 'S', 'M']),
  '/api/v1/feedback': authenticated(['P', 'M']),
  '/api/v1/segments': authenticated(['B', 'M']),
  '/api/v1/storefront': publicEntry(['B', 'P', 'M']),
  '/api/v1/online-orders': authenticated(['P', 'S', 'M']),
  '/api/v1/vendors': authenticated(['P', 'M']),
  '/api/v1/warranty': authenticated(['P', 'M']),
  '/api/v1/delivery': authenticated(['P', 'S', 'M']),
  '/api/v1/shipping-companies': authenticated(['B', 'M']),
  '/api/v1/purchase-orders': authenticated(['P', 'S', 'M']),
  '/api/v1/expenses': authenticated(['P', 'M']),
  '/api/v1/analytics': authenticated(['P', 'S']),
  '/api/v1/reports': authenticated(['S']),
  '/api/v1/exports': authenticated(['E']),
  '/api/v1/ai': authenticated(['S', 'M']),
  '/api/v1/notifications': authenticated(['P', 'M']),
};
