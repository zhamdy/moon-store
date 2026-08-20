import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import ErrorBoundary from '../shared/components/ErrorBoundary';
import Login from '../features/auth/pages/Login';
import PWAInstallPrompt from '../shared/components/PWAInstallPrompt';
import { useAuthStore } from '../features/auth/store/authStore';

// Eagerly loaded (critical path)
import Dashboard from '../features/analytics/pages/Dashboard';
import POS from '../features/pos/pages/POS';
import Inventory from '../features/inventory/pages/Inventory';

// Lazy loaded
const BarcodeTools = lazy(() => import('../features/pos/pages/BarcodeTools'));
const Deliveries = lazy(() => import('../features/fulfillment/pages/Deliveries'));
const SalesHistory = lazy(() => import('../features/sales/pages/SalesHistory'));
const UsersPage = lazy(() => import('../features/admin/pages/Users'));
const CustomersPage = lazy(() => import('../features/customers/pages/Customers'));
const DistributorsPage = lazy(() => import('../features/purchasing/pages/Distributors'));
const CategoriesPage = lazy(() => import('../features/inventory/pages/Categories'));
const SettingsPage = lazy(() => import('../features/admin/pages/Settings'));
const PurchaseOrdersPage = lazy(() => import('../features/purchasing/pages/PurchaseOrders'));
const AuditLogPage = lazy(() => import('../features/admin/pages/AuditLog'));
const PromotionsPage = lazy(() => import('../features/sales/pages/Promotions'));
const GiftCardsPage = lazy(() => import('../features/sales/pages/GiftCards'));
const StockCountPage = lazy(() => import('../features/inventory/pages/StockCount'));
const ExportsPage = lazy(() => import('../features/analytics/pages/Exports'));
const CustomerDisplay = lazy(() => import('../features/pos/pages/CustomerDisplay'));
const RegisterPage = lazy(() => import('../features/pos/pages/Register'));
const ShiftsPage = lazy(() => import('../features/pos/pages/Shifts'));
const ExpensesPage = lazy(() => import('../features/purchasing/pages/Expenses'));
const SegmentsPage = lazy(() => import('../features/customers/pages/Segments'));
const LayawayPage = lazy(() => import('../features/sales/pages/Layaway'));
const BundlesPage = lazy(() => import('../features/inventory/pages/Bundles'));
const FeedbackPage = lazy(() => import('../features/customers/pages/Feedback'));
const BackupPage = lazy(() => import('../features/admin/pages/Backup'));
const BranchesPage = lazy(() => import('../features/admin/pages/Branches'));
const StorefrontPage = lazy(() => import('../features/fulfillment/pages/Storefront'));
const OnlineOrdersPage = lazy(() => import('../features/fulfillment/pages/OnlineOrders'));
const ReportBuilderPage = lazy(() => import('../features/analytics/pages/ReportBuilder'));
const VendorsPage = lazy(() => import('../features/purchasing/pages/Vendors'));
const SmartPricingPage = lazy(() => import('../features/inventory/pages/SmartPricing'));
const AiInsightsPage = lazy(() => import('../features/analytics/pages/AiInsights'));
const AdvancedAnalyticsPage = lazy(() => import('../features/analytics/pages/AdvancedAnalytics'));

type UserRole = 'Admin' | 'Cashier' | 'Delivery';

interface RouteConfig {
  path: string;
  component: ComponentType;
  roles: UserRole[];
}

const routes: RouteConfig[] = [
  { path: '/', component: Dashboard, roles: ['Admin'] },
  { path: '/pos', component: POS, roles: ['Admin', 'Cashier'] },
  { path: '/inventory', component: Inventory, roles: ['Admin', 'Cashier'] },
  { path: '/barcode', component: BarcodeTools, roles: ['Admin', 'Cashier'] },
  { path: '/deliveries', component: Deliveries, roles: ['Admin', 'Delivery'] },
  { path: '/sales', component: SalesHistory, roles: ['Admin', 'Cashier'] },
  { path: '/users', component: UsersPage, roles: ['Admin'] },
  { path: '/customers', component: CustomersPage, roles: ['Admin'] },
  { path: '/distributors', component: DistributorsPage, roles: ['Admin'] },
  { path: '/categories', component: CategoriesPage, roles: ['Admin'] },
  { path: '/purchase-orders', component: PurchaseOrdersPage, roles: ['Admin'] },
  { path: '/audit-log', component: AuditLogPage, roles: ['Admin'] },
  { path: '/settings', component: SettingsPage, roles: ['Admin'] },
  { path: '/promotions', component: PromotionsPage, roles: ['Admin'] },
  { path: '/gift-cards', component: GiftCardsPage, roles: ['Admin'] },
  { path: '/stock-count', component: StockCountPage, roles: ['Admin'] },
  { path: '/shifts', component: ShiftsPage, roles: ['Admin', 'Cashier', 'Delivery'] },
  { path: '/expenses', component: ExpensesPage, roles: ['Admin'] },
  { path: '/segments', component: SegmentsPage, roles: ['Admin'] },
  { path: '/layaway', component: LayawayPage, roles: ['Admin', 'Cashier'] },
  { path: '/register', component: RegisterPage, roles: ['Admin', 'Cashier'] },
  { path: '/exports', component: ExportsPage, roles: ['Admin'] },
  { path: '/bundles', component: BundlesPage, roles: ['Admin'] },
  { path: '/feedback', component: FeedbackPage, roles: ['Admin'] },
  { path: '/backup', component: BackupPage, roles: ['Admin'] },
  { path: '/branches', component: BranchesPage, roles: ['Admin'] },
  { path: '/storefront', component: StorefrontPage, roles: ['Admin'] },
  { path: '/online-orders', component: OnlineOrdersPage, roles: ['Admin'] },
  { path: '/report-builder', component: ReportBuilderPage, roles: ['Admin'] },
  { path: '/vendors', component: VendorsPage, roles: ['Admin'] },
  { path: '/smart-pricing', component: SmartPricingPage, roles: ['Admin'] },
  { path: '/ai-insights', component: AiInsightsPage, roles: ['Admin'] },
  { path: '/analytics', component: AdvancedAnalyticsPage, roles: ['Admin'] },
];

const LazyFallback = <div className="p-8 text-center text-muted">Loading...</div>;

export default function App(): React.ReactElement {
  const { isAuthenticated, user } = useAuthStore();

  const defaultRoute = (): string => {
    if (!isAuthenticated) return '/login';
    if (user?.role === 'Admin') return '/';
    if (user?.role === 'Cashier') return '/pos';
    return '/deliveries';
  };

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={defaultRoute()} replace /> : <Login />}
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {routes.map(({ path, component: Component, roles }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute roles={roles satisfies UserRole[]}>
                  <ErrorBoundary>
                    <Suspense fallback={LazyFallback}>
                      <Component />
                    </Suspense>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
          ))}
          <Route path="/locations" element={<Navigate to="/branches" replace />} />
        </Route>

        {/* Customer-facing display (no auth required) */}
        <Route
          path="/customer-display"
          element={
            <Suspense fallback={LazyFallback}>
              <CustomerDisplay />
            </Suspense>
          }
        />

        <Route path="*" element={<Navigate to={defaultRoute()} replace />} />
      </Routes>
      <PWAInstallPrompt />
    </>
  );
}
