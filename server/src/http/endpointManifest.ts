export type EndpointClassification = 'P' | 'B' | 'S' | 'M' | 'E';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface EndpointManifestEntry {
  classifications: readonly EndpointClassification[];
  authorization: {
    kind: 'public' | 'authenticated';
    roles: readonly string[];
    predicate: string | null;
  };
}

export interface DetailedEndpointEntry {
  method: HttpMethod;
  path: string;
  classification: EndpointClassification;
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
  '/api/v1/analytics': authenticated(['P', 'S', 'M']),
  '/api/v1/reports': authenticated(['S']),
  '/api/v1/exports': authenticated(['E']),
  '/api/v1/ai': authenticated(['S', 'M']),
  '/api/v1/notifications': authenticated(['P', 'M']),
};

const adminOnly = { kind: 'authenticated' as const, roles: ['Admin'], predicate: null };
const allAuthenticated = {
  kind: 'authenticated' as const,
  roles: ['Admin', 'Cashier', 'Delivery'],
  predicate: null,
};
const adminOrCashier = {
  kind: 'authenticated' as const,
  roles: ['Admin', 'Cashier'],
  predicate: null,
};
const adminOrDelivery = {
  kind: 'authenticated' as const,
  roles: ['Admin', 'Delivery'],
  predicate: null,
};
const publicAuth = { kind: 'public' as const, roles: [], predicate: null };

/**
 * Authoritative endpoint-level classification and authorization inventory
 * representing the full matrix from the refactor plan.
 */
export const endpointDetailsManifest: readonly DetailedEndpointEntry[] = [
  // Core / Auth
  { method: 'POST', path: '/api/v1/auth/login', classification: 'M', authorization: publicAuth },
  { method: 'POST', path: '/api/v1/auth/refresh', classification: 'M', authorization: publicAuth },
  {
    method: 'POST',
    path: '/api/v1/auth/logout',
    classification: 'M',
    authorization: allAuthenticated,
  },
  { method: 'GET', path: '/api/v1/auth/me', classification: 'S', authorization: allAuthenticated },

  // Core / Users
  { method: 'GET', path: '/api/v1/users', classification: 'P', authorization: adminOnly },
  { method: 'GET', path: '/api/v1/users/delivery', classification: 'B', authorization: adminOnly },
  { method: 'POST', path: '/api/v1/users', classification: 'M', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/users/me/favorites',
    classification: 'B',
    authorization: allAuthenticated,
  },
  {
    method: 'PUT',
    path: '/api/v1/users/me/favorites',
    classification: 'M',
    authorization: allAuthenticated,
  },
  { method: 'PUT', path: '/api/v1/users/:id', classification: 'M', authorization: adminOnly },
  { method: 'DELETE', path: '/api/v1/users/:id', classification: 'M', authorization: adminOnly },

  // Core / Settings
  { method: 'GET', path: '/api/v1/settings', classification: 'S', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/settings', classification: 'M', authorization: adminOnly },

  // Core / Audit Log
  { method: 'GET', path: '/api/v1/audit-log', classification: 'P', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/audit-log/actions',
    classification: 'B',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/audit-log/entity-types',
    classification: 'B',
    authorization: adminOnly,
  },

  // Core / Branches
  { method: 'GET', path: '/api/v1/branches', classification: 'B', authorization: allAuthenticated },
  { method: 'POST', path: '/api/v1/branches', classification: 'M', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/branches/consolidated',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/branches/transfers',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/branches/transfers',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/branches/transfers/:id/status',
    classification: 'M',
    authorization: adminOnly,
  },
  { method: 'PUT', path: '/api/v1/branches/:id', classification: 'M', authorization: adminOnly },

  // POS / Sales
  { method: 'GET', path: '/api/v1/sales', classification: 'P', authorization: adminOrCashier },
  { method: 'POST', path: '/api/v1/sales', classification: 'M', authorization: adminOrCashier },
  { method: 'GET', path: '/api/v1/sales/:id', classification: 'S', authorization: adminOrCashier },
  {
    method: 'POST',
    path: '/api/v1/sales/:id/refund',
    classification: 'M',
    authorization: adminOrCashier,
  },

  // POS / Register
  {
    method: 'GET',
    path: '/api/v1/register/current',
    classification: 'S',
    authorization: adminOrCashier,
  },
  {
    method: 'POST',
    path: '/api/v1/register/open',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'POST',
    path: '/api/v1/register/movement',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'POST',
    path: '/api/v1/register/close',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'GET',
    path: '/api/v1/register/history',
    classification: 'P',
    authorization: adminOrCashier,
  },
  {
    method: 'GET',
    path: '/api/v1/register/:id/report',
    classification: 'S',
    authorization: adminOrCashier,
  },
  {
    method: 'POST',
    path: '/api/v1/register/:id/force-close',
    classification: 'M',
    authorization: adminOnly,
  },

  // POS / Shifts
  {
    method: 'GET',
    path: '/api/v1/shifts/current',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/shifts/clock-in',
    classification: 'M',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/shifts/clock-out',
    classification: 'M',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/shifts/break/start',
    classification: 'M',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/shifts/break/end',
    classification: 'M',
    authorization: allAuthenticated,
  },
  { method: 'GET', path: '/api/v1/shifts', classification: 'P', authorization: adminOrCashier },

  // POS / Exchanges
  { method: 'POST', path: '/api/v1/exchanges', classification: 'M', authorization: adminOrCashier },
  { method: 'GET', path: '/api/v1/exchanges', classification: 'P', authorization: adminOrCashier },
  {
    method: 'GET',
    path: '/api/v1/exchanges/:id',
    classification: 'S',
    authorization: adminOrCashier,
  },

  // POS / Layaway
  { method: 'POST', path: '/api/v1/layaway', classification: 'M', authorization: adminOrCashier },
  { method: 'GET', path: '/api/v1/layaway', classification: 'P', authorization: adminOrCashier },
  {
    method: 'GET',
    path: '/api/v1/layaway/:id',
    classification: 'S',
    authorization: adminOrCashier,
  },
  {
    method: 'POST',
    path: '/api/v1/layaway/:id/pay',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'POST',
    path: '/api/v1/layaway/:id/cancel',
    classification: 'M',
    authorization: adminOrCashier,
  },

  // POS / Reservations
  {
    method: 'POST',
    path: '/api/v1/reservations',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'DELETE',
    path: '/api/v1/reservations/:id',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'DELETE',
    path: '/api/v1/reservations/source/:sourceId',
    classification: 'M',
    authorization: adminOrCashier,
  },

  // Inventory / Products
  { method: 'GET', path: '/api/v1/products', classification: 'P', authorization: allAuthenticated },
  {
    method: 'GET',
    path: '/api/v1/products/categories',
    classification: 'B',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/products/lookup',
    classification: 'B',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/products/generate-sku/:categoryId',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/products/generate-barcode',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/products/barcode/:barcode',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/products/batch-generate-barcodes',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/products/bulk-update',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/products/bulk-delete',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/products/import',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/products/:id',
    classification: 'S',
    authorization: allAuthenticated,
  },
  { method: 'POST', path: '/api/v1/products', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/products/:id', classification: 'M', authorization: adminOnly },
  {
    method: 'PUT',
    path: '/api/v1/products/:id/status',
    classification: 'M',
    authorization: adminOnly,
  },
  { method: 'DELETE', path: '/api/v1/products/:id', classification: 'M', authorization: adminOnly },
  {
    method: 'POST',
    path: '/api/v1/products/:id/adjust-stock',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/products/:id/stock-history',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/products/:id/image',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/products/:id/image',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/products/:id/variants',
    classification: 'B',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/products/:id/variants',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/products/:id/variants/:variantId',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/products/:id/variants/:variantId',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/products/:id/price-history',
    classification: 'P',
    authorization: adminOnly,
  },

  // Inventory / Categories
  {
    method: 'GET',
    path: '/api/v1/categories',
    classification: 'B',
    authorization: allAuthenticated,
  },
  { method: 'POST', path: '/api/v1/categories', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/categories/:id', classification: 'M', authorization: adminOnly },
  {
    method: 'DELETE',
    path: '/api/v1/categories/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Inventory / Distributors
  {
    method: 'GET',
    path: '/api/v1/distributors',
    classification: 'B',
    authorization: allAuthenticated,
  },
  { method: 'POST', path: '/api/v1/distributors', classification: 'M', authorization: adminOnly },
  {
    method: 'PUT',
    path: '/api/v1/distributors/:id',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/distributors/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Inventory / Stock Counts
  { method: 'GET', path: '/api/v1/stock-counts', classification: 'P', authorization: adminOnly },
  { method: 'POST', path: '/api/v1/stock-counts', classification: 'M', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/stock-counts/:id',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/stock-counts/:id/items/:itemId',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/stock-counts/:id/complete',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/stock-counts/:id/cancel',
    classification: 'M',
    authorization: adminOnly,
  },

  // Inventory / Stock Adjustments
  {
    method: 'GET',
    path: '/api/v1/stock-adjustments',
    classification: 'P',
    authorization: adminOnly,
  },

  // Inventory / Bundles
  { method: 'GET', path: '/api/v1/bundles', classification: 'P', authorization: allAuthenticated },
  {
    method: 'GET',
    path: '/api/v1/bundles/:id',
    classification: 'S',
    authorization: allAuthenticated,
  },
  { method: 'POST', path: '/api/v1/bundles', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/bundles/:id', classification: 'M', authorization: adminOnly },
  { method: 'DELETE', path: '/api/v1/bundles/:id', classification: 'M', authorization: adminOnly },

  // Inventory / Collections
  {
    method: 'GET',
    path: '/api/v1/collections',
    classification: 'P',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/collections/:id',
    classification: 'S',
    authorization: allAuthenticated,
  },
  { method: 'POST', path: '/api/v1/collections', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/collections/:id', classification: 'M', authorization: adminOnly },
  {
    method: 'DELETE',
    path: '/api/v1/collections/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Inventory / Label Templates
  { method: 'GET', path: '/api/v1/label-templates', classification: 'B', authorization: adminOnly },
  {
    method: 'POST',
    path: '/api/v1/label-templates',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/label-templates/:id',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/label-templates/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Commerce / Customers
  {
    method: 'GET',
    path: '/api/v1/customers',
    classification: 'P',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/customers',
    classification: 'M',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/customers/:id',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'PUT',
    path: '/api/v1/customers/:id',
    classification: 'M',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/customers/:id/stats',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/customers/:id/sales',
    classification: 'P',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/customers/:id/loyalty',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/customers/:id/loyalty/adjust',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/customers/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Commerce / Coupons
  { method: 'GET', path: '/api/v1/coupons', classification: 'P', authorization: allAuthenticated },
  { method: 'POST', path: '/api/v1/coupons', classification: 'M', authorization: adminOnly },
  {
    method: 'POST',
    path: '/api/v1/coupons/validate',
    classification: 'M',
    authorization: allAuthenticated,
  },
  { method: 'PUT', path: '/api/v1/coupons/:id', classification: 'M', authorization: adminOnly },
  { method: 'DELETE', path: '/api/v1/coupons/:id', classification: 'M', authorization: adminOnly },

  // Commerce / Gift Cards
  {
    method: 'GET',
    path: '/api/v1/gift-cards',
    classification: 'P',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/gift-cards',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'GET',
    path: '/api/v1/gift-cards/:code/balance',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'POST',
    path: '/api/v1/gift-cards/:code/redeem',
    classification: 'M',
    authorization: adminOrCashier,
  },
  {
    method: 'GET',
    path: '/api/v1/gift-cards/:id/transactions',
    classification: 'P',
    authorization: allAuthenticated,
  },
  { method: 'PUT', path: '/api/v1/gift-cards/:id', classification: 'M', authorization: adminOnly },

  // Commerce / Feedback
  {
    method: 'POST',
    path: '/api/v1/feedback',
    classification: 'M',
    authorization: allAuthenticated,
  },
  { method: 'GET', path: '/api/v1/feedback', classification: 'P', authorization: adminOnly },

  // Commerce / Segments
  { method: 'GET', path: '/api/v1/segments', classification: 'B', authorization: adminOnly },
  { method: 'POST', path: '/api/v1/segments', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/segments/:id', classification: 'M', authorization: adminOnly },
  { method: 'DELETE', path: '/api/v1/segments/:id', classification: 'M', authorization: adminOnly },

  // Commerce / Storefront
  {
    method: 'GET',
    path: '/api/v1/storefront/banners',
    classification: 'B',
    authorization: publicAuth,
  },
  {
    method: 'GET',
    path: '/api/v1/storefront/banners/all',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/storefront/banners',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/storefront/banners/:id',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/storefront/banners/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Commerce / Online Orders
  { method: 'POST', path: '/api/v1/online-orders', classification: 'M', authorization: publicAuth },
  {
    method: 'GET',
    path: '/api/v1/online-orders',
    classification: 'P',
    authorization: adminOrDelivery,
  },
  {
    method: 'GET',
    path: '/api/v1/online-orders/:id',
    classification: 'S',
    authorization: adminOrDelivery,
  },
  {
    method: 'PUT',
    path: '/api/v1/online-orders/:id/status',
    classification: 'M',
    authorization: adminOrDelivery,
  },

  // Commerce / Vendors
  { method: 'GET', path: '/api/v1/vendors', classification: 'P', authorization: adminOnly },
  { method: 'POST', path: '/api/v1/vendors', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/vendors/:id', classification: 'M', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/vendors/:id/payouts',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/vendors/:id/payouts',
    classification: 'M',
    authorization: adminOnly,
  },

  // Commerce / Warranty
  { method: 'GET', path: '/api/v1/warranty', classification: 'P', authorization: allAuthenticated },
  {
    method: 'POST',
    path: '/api/v1/warranty',
    classification: 'M',
    authorization: allAuthenticated,
  },
  { method: 'PUT', path: '/api/v1/warranty/:id', classification: 'M', authorization: adminOnly },

  // Fulfillment / Delivery
  { method: 'GET', path: '/api/v1/delivery', classification: 'P', authorization: adminOrDelivery },
  {
    method: 'GET',
    path: '/api/v1/delivery/analytics/performance',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/delivery/:id',
    classification: 'S',
    authorization: adminOrDelivery,
  },
  { method: 'POST', path: '/api/v1/delivery', classification: 'M', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/delivery/:id', classification: 'M', authorization: adminOnly },
  {
    method: 'PUT',
    path: '/api/v1/delivery/:id/status',
    classification: 'M',
    authorization: adminOrDelivery,
  },
  {
    method: 'GET',
    path: '/api/v1/delivery/:id/history',
    classification: 'P',
    authorization: adminOrDelivery,
  },

  // Fulfillment / Shipping Companies
  {
    method: 'GET',
    path: '/api/v1/shipping-companies',
    classification: 'B',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/shipping-companies',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/shipping-companies/:id',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/shipping-companies/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Fulfillment / Purchase Orders
  { method: 'GET', path: '/api/v1/purchase-orders', classification: 'P', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/purchase-orders/:id',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/purchase-orders',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'PUT',
    path: '/api/v1/purchase-orders/:id/status',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/purchase-orders/:id/receive',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'DELETE',
    path: '/api/v1/purchase-orders/:id',
    classification: 'M',
    authorization: adminOnly,
  },

  // Fulfillment / Expenses
  { method: 'GET', path: '/api/v1/expenses', classification: 'P', authorization: adminOnly },
  { method: 'POST', path: '/api/v1/expenses', classification: 'M', authorization: adminOnly },
  { method: 'GET', path: '/api/v1/expenses/pnl', classification: 'S', authorization: adminOnly },
  { method: 'PUT', path: '/api/v1/expenses/:id', classification: 'M', authorization: adminOnly },
  { method: 'DELETE', path: '/api/v1/expenses/:id', classification: 'M', authorization: adminOnly },

  // Intelligence / Analytics
  {
    method: 'GET',
    path: '/api/v1/analytics/dashboard-all',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/dashboard',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/revenue',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/top-products',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/payment-methods',
    classification: 'B',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/orders-per-day',
    classification: 'B',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/cashier-performance',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/sales-by-category',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/sales-by-distributor',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/dead-stock',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/customer-ltv',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/hourly-heatmap',
    classification: 'B',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/abc-classification',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/reorder-suggestions',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'POST',
    path: '/api/v1/analytics/inventory-snapshot',
    classification: 'M',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/analytics/inventory-snapshots',
    classification: 'P',
    authorization: adminOnly,
  },

  // Intelligence / Reports
  { method: 'GET', path: '/api/v1/reports/sales', classification: 'S', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/reports/inventory',
    classification: 'S',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/reports/profit-loss',
    classification: 'S',
    authorization: adminOnly,
  },

  // Intelligence / Exports
  {
    method: 'GET',
    path: '/api/v1/exports/products',
    classification: 'E',
    authorization: adminOnly,
  },
  { method: 'GET', path: '/api/v1/exports/sales', classification: 'E', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/exports/customers',
    classification: 'E',
    authorization: adminOnly,
  },

  // Intelligence / AI
  { method: 'GET', path: '/api/v1/ai/forecast', classification: 'S', authorization: adminOnly },
  {
    method: 'GET',
    path: '/api/v1/ai/recommendations',
    classification: 'P',
    authorization: adminOnly,
  },
  {
    method: 'GET',
    path: '/api/v1/ai/pricing-suggestions',
    classification: 'P',
    authorization: adminOnly,
  },
  { method: 'GET', path: '/api/v1/ai/churn-risk', classification: 'P', authorization: adminOnly },
  { method: 'GET', path: '/api/v1/ai/anomalies', classification: 'P', authorization: adminOnly },

  // Intelligence / Notifications
  {
    method: 'GET',
    path: '/api/v1/notifications',
    classification: 'P',
    authorization: allAuthenticated,
  },
  {
    method: 'GET',
    path: '/api/v1/notifications/unread-count',
    classification: 'S',
    authorization: allAuthenticated,
  },
  {
    method: 'PUT',
    path: '/api/v1/notifications/:id/read',
    classification: 'M',
    authorization: allAuthenticated,
  },
  {
    method: 'PUT',
    path: '/api/v1/notifications/read-all',
    classification: 'M',
    authorization: allAuthenticated,
  },
];
