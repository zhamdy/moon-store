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
  ['/api/auth', auth],
  ['/api/products', products],
  ['/api/sales', sales],
  ['/api/delivery', delivery],
  ['/api/analytics', analytics],
  ['/api/users', users],
  ['/api/customers', customers],
  ['/api/distributors', distributors],
  ['/api/categories', categories],
  ['/api/stock-adjustments', stockAdjustments],
  ['/api/settings', settings],
  ['/api/purchase-orders', purchaseOrders],
  ['/api/audit-log', auditLog],
  ['/api/notifications', notifications],
  ['/api/coupons', coupons],
  ['/api/gift-cards', giftCards],
  ['/api/bundles', bundles],
  ['/api/stock-counts', stockCounts],
  ['/api/reservations', reservations],
  ['/api/label-templates', labelTemplates],
  ['/api/exports', exports],
  ['/api/register', register],
  ['/api/exchanges', exchanges],
  ['/api/shifts', shifts],
  ['/api/expenses', expenses],
  ['/api/segments', segments],
  ['/api/layaway', layaway],
  ['/api/collections', collections],
  ['/api/warranty', warranty],
  ['/api/feedback', feedback],
  ['/api/branches', branches],
  ['/api/storefront', storefront],
  ['/api/online-orders', onlineOrders],
  ['/api/reports', reports],
  ['/api/vendors', vendors],
  ['/api/ai', ai],
  ['/api/shipping-companies', shippingCompanies],
];

export { cleanupExpiredReservations } from './reservations';
