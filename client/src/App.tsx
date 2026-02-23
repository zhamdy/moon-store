import { useEffect } from 'react';
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
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';

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
            path="/settings"
            element={
              <ProtectedRoute roles={['Admin'] satisfies UserRole[]}>
                <ErrorBoundary>
                  <SettingsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={defaultRoute()} replace />} />
      </Routes>
      <PWAInstallPrompt />
    </>
  );
}
