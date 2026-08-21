import { Router } from 'express';
import {
  authRouter,
  usersRouter,
  settingsRouter,
  auditLogRouter,
  branchesRouter,
  salesRouter,
  registerRouter,
  shiftsRouter,
  exchangesRouter,
  layawayRouter,
  reservationsRouter,
  cleanupExpiredReservations,
  productsRouter,
  categoriesRouter,
  distributorsRouter,
  stockCountsRouter,
  stockAdjustmentsRouter,
  bundlesRouter,
  collectionsRouter,
  labelTemplatesRouter,
  customersRouter,
  couponsRouter,
  giftCardsRouter,
  feedbackRouter,
  segmentsRouter,
  storefrontRouter,
  onlineOrdersRouter,
  vendorsRouter,
  warrantyRouter,
  deliveryRouter,
  shippingCompaniesRouter,
  purchaseOrdersRouter,
  expensesRouter,
  analyticsRouter,
  reportsRouter,
  exportsRouter,
  aiRouter,
  notificationsRouter,
} from './modules';

export { cleanupExpiredReservations };

// Route table: [apiPath, router]
export const routeTable: [string, Router][] = [
  // Core Domain
  ['/api/v1/auth', authRouter],
  ['/api/v1/users', usersRouter],
  ['/api/v1/settings', settingsRouter],
  ['/api/v1/audit-log', auditLogRouter],
  ['/api/v1/branches', branchesRouter],

  // POS Domain
  ['/api/v1/sales', salesRouter],
  ['/api/v1/register', registerRouter],
  ['/api/v1/shifts', shiftsRouter],
  ['/api/v1/exchanges', exchangesRouter],
  ['/api/v1/layaway', layawayRouter],
  ['/api/v1/reservations', reservationsRouter],

  // Inventory Domain
  ['/api/v1/products', productsRouter],
  ['/api/v1/categories', categoriesRouter],
  ['/api/v1/distributors', distributorsRouter],
  ['/api/v1/stock-counts', stockCountsRouter],
  ['/api/v1/stock-adjustments', stockAdjustmentsRouter],
  ['/api/v1/bundles', bundlesRouter],
  ['/api/v1/collections', collectionsRouter],
  ['/api/v1/label-templates', labelTemplatesRouter],

  // Commerce Domain
  ['/api/v1/customers', customersRouter],
  ['/api/v1/coupons', couponsRouter],
  ['/api/v1/gift-cards', giftCardsRouter],
  ['/api/v1/feedback', feedbackRouter],
  ['/api/v1/segments', segmentsRouter],
  ['/api/v1/storefront', storefrontRouter],
  ['/api/v1/online-orders', onlineOrdersRouter],
  ['/api/v1/vendors', vendorsRouter],
  ['/api/v1/warranty', warrantyRouter],

  // Fulfillment Domain
  ['/api/v1/delivery', deliveryRouter],
  ['/api/v1/shipping-companies', shippingCompaniesRouter],
  ['/api/v1/purchase-orders', purchaseOrdersRouter],
  ['/api/v1/expenses', expensesRouter],

  // Intelligence Domain
  ['/api/v1/analytics', analyticsRouter],
  ['/api/v1/reports', reportsRouter],
  ['/api/v1/exports', exportsRouter],
  ['/api/v1/ai', aiRouter],
  ['/api/v1/notifications', notificationsRouter],
];
