import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import BarcodeTools from './pages/BarcodeTools';
import Deliveries from './pages/Deliveries';
import SalesHistory from './pages/SalesHistory';
import UsersPage from './pages/Users';
import CustomersPage from './pages/Customers';
import DistributorsPage from './pages/Distributors';
import CategoriesPage from './pages/Categories';
import SettingsPage from './pages/Settings';
import PurchaseOrdersPage from './pages/PurchaseOrders';
import AuditLogPage from './pages/AuditLog';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';

const PromotionsPage = lazy(() => import('./pages/Promotions'));
const GiftCardsPage = lazy(() => import('./pages/GiftCards'));
const StockCountPage = lazy(() => import('./pages/StockCount'));
const LocationsPage = lazy(() => import('./pages/Locations'));
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

type UserRole = 'Admin' | 'Cashier' | 'Delivery';

export default function App(): React.ReactElement {
  const { isAuthenticated, user } = useAuthStore();
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
          <Route
            path="/"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Dashboard />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <POS />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Inventory />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/barcode"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <BarcodeTools />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deliveries"
            element={
              <ProtectedRoute roles={['Admin', 'Delivery'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Deliveries />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <SalesHistory />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <UsersPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <CustomersPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/distributors"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <DistributorsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <CategoriesPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <PurchaseOrdersPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-log"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <AuditLogPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <SettingsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/promotions"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <PromotionsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gift-cards"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <GiftCardsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-count"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <StockCountPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/locations"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <LocationsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/shifts"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier', 'Delivery'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <ShiftsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <ExpensesPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/segments"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <SegmentsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/layaway"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <LayawayPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute roles={['Admin', 'Cashier'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <RegisterPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/exports"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <ExportsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/collections"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <CollectionsPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/warranty"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <WarrantyPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <FeedbackPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/backup"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <BackupPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
                    <ActivityFeedPage />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Customer-facing display (no auth required) */}
        <Route
          path="/customer-display"
          element={
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
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
