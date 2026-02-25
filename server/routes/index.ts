import { Router } from 'express';

import auth from './auth';
import products from './products';
import sales from './sales';
import delivery from './delivery';
import analytics from './analytics';
import users from './users';
import customers from './customers';
import distributors from './distributors';
import categories from './categories';
import stockAdjustments from './stockAdjustments';
import settings from './settings';
import purchaseOrders from './purchaseOrders';
import auditLog from './auditLog';
import notifications from './notifications';
import coupons from './coupons';
import giftCards from './giftCards';
import bundles from './bundles';
import stockCounts from './stockCounts';
import reservations from './reservations';
import labelTemplates from './labelTemplates';
import exports from './exports';
import register from './register';
import exchanges from './exchanges';
import shifts from './shifts';
import expenses from './expenses';
import segments from './segments';
import layaway from './layaway';
import collections from './collections';
import warranty from './warranty';
import feedback from './feedback';
import branches from './branches';
import storefront from './storefront';
import onlineOrders from './onlineOrders';
import reports from './reports';
import vendors from './vendors';
import ai from './ai';
import shippingCompanies from './shippingCompanies';

// Route table: [apiPath, router]
// Adding a new route = 1 import + 1 line here
export const routeTable: [string, Router][] = [
  ['/api/v1/auth', auth],
  ['/api/v1/products', products],
  ['/api/v1/sales', sales],
  ['/api/v1/delivery', delivery],
  ['/api/v1/analytics', analytics],
  ['/api/v1/users', users],
  ['/api/v1/customers', customers],
  ['/api/v1/distributors', distributors],
  ['/api/v1/categories', categories],
  ['/api/v1/stock-adjustments', stockAdjustments],
  ['/api/v1/settings', settings],
  ['/api/v1/purchase-orders', purchaseOrders],
  ['/api/v1/audit-log', auditLog],
  ['/api/v1/notifications', notifications],
  ['/api/v1/coupons', coupons],
  ['/api/v1/gift-cards', giftCards],
  ['/api/v1/bundles', bundles],
  ['/api/v1/stock-counts', stockCounts],
  ['/api/v1/reservations', reservations],
  ['/api/v1/label-templates', labelTemplates],
  ['/api/v1/exports', exports],
  ['/api/v1/register', register],
  ['/api/v1/exchanges', exchanges],
  ['/api/v1/shifts', shifts],
  ['/api/v1/expenses', expenses],
  ['/api/v1/segments', segments],
  ['/api/v1/layaway', layaway],
  ['/api/v1/collections', collections],
  ['/api/v1/warranty', warranty],
  ['/api/v1/feedback', feedback],
  ['/api/v1/branches', branches],
  ['/api/v1/storefront', storefront],
  ['/api/v1/online-orders', onlineOrders],
  ['/api/v1/reports', reports],
  ['/api/v1/vendors', vendors],
  ['/api/v1/ai', ai],
  ['/api/v1/shipping-companies', shippingCompanies],
];

export { cleanupExpiredReservations } from './reservations';
