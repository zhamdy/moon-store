import { lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useAuthStore } from './store/authStore';

// Eagerly loaded (critical path)
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';

// Lazy loaded
const BarcodeTools = lazy(() => import('./pages/BarcodeTools'));
const Deliveries = lazy(() => import('./pages/Deliveries'));
const SalesHistory = lazy(() => import('./pages/SalesHistory'));
const UsersPage = lazy(() => import('./pages/Users'));
const CustomersPage = lazy(() => import('./pages/Customers'));
const DistributorsPage = lazy(() => import('./pages/Distributors'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrders'));
const AuditLogPage = lazy(() => import('./pages/AuditLog'));
const PromotionsPage = lazy(() => import('./pages/Promotions'));
const GiftCardsPage = lazy(() => import('./pages/GiftCards'));
const StockCountPage = lazy(() => import('./pages/StockCount'));
const ExportsPage = lazy(() => import('./pages/Exports'));
const CustomerDisplay = lazy(() => import('./pages/CustomerDisplay'));
const RegisterPage = lazy(() => import('./pages/Register'));
const ShiftsPage = lazy(() => import('./pages/Shifts'));
const ExpensesPage = lazy(() => import('./pages/Expenses'));
const SegmentsPage = lazy(() => import('./pages/Segments'));
const LayawayPage = lazy(() => import('./pages/Layaway'));
const CollectionsPage = lazy(() => import('./pages/Collections'));
const WarrantyPage = lazy(() => import('./pages/Warranty'));
const FeedbackPage = lazy(() => import('./pages/Feedback'));
const BackupPage = lazy(() => import('./pages/Backup'));
const ActivityFeedPage = lazy(() => import('./pages/ActivityFeed'));
const BranchesPage = lazy(() => import('./pages/Branches'));
const StorefrontPage = lazy(() => import('./pages/Storefront'));
const OnlineOrdersPage = lazy(() => import('./pages/OnlineOrders'));
const ReportBuilderPage = lazy(() => import('./pages/ReportBuilder'));
const VendorsPage = lazy(() => import('./pages/Vendors'));
const SmartPricingPage = lazy(() => import('./pages/SmartPricing'));
const AiInsightsPage = lazy(() => import('./pages/AiInsights'));

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
  { path: '/collections', component: CollectionsPage, roles: ['Admin'] },
  { path: '/warranty', component: WarrantyPage, roles: ['Admin'] },
  { path: '/feedback', component: FeedbackPage, roles: ['Admin'] },
  { path: '/backup', component: BackupPage, roles: ['Admin'] },
  { path: '/activity', component: ActivityFeedPage, roles: ['Admin'] },
  { path: '/branches', component: BranchesPage, roles: ['Admin'] },
  { path: '/storefront', component: StorefrontPage, roles: ['Admin'] },
  { path: '/online-orders', component: OnlineOrdersPage, roles: ['Admin'] },
  { path: '/report-builder', component: ReportBuilderPage, roles: ['Admin'] },
  { path: '/vendors', component: VendorsPage, roles: ['Admin'] },
  { path: '/smart-pricing', component: SmartPricingPage, roles: ['Admin'] },
  { path: '/ai-insights', component: AiInsightsPage, roles: ['Admin'] },
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
