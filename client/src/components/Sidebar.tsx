import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ScanBarcode,
  Truck,
  History,
  Users,
  UserRound,
  Building2,
  Layers,
  ClipboardList,
  ScrollText,
  Settings,
  LogOut,
  Ticket,
  Gift,
  PackageCheck,
  Download,
  Vault,
  Clock,
  Receipt,
  PieChart,
  CalendarClock,
  Palette,
  ShieldCheck,
  Star,
  Database,
  Activity,
  GitBranch,
  Globe,
  ShoppingBag,
  BarChart3,
  Store,
  Zap,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import api from '../services/api';
import moonLogo from '../assets/moon-logo.svg';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  roles: string[];
}

const navItems: NavItem[] = [
  // Daily Operations
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['Admin'] },
  { to: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', roles: ['Admin', 'Cashier'] },
  { to: '/sales', icon: History, labelKey: 'nav.sales', roles: ['Admin', 'Cashier'] },
  { to: '/register', icon: Vault, labelKey: 'nav.register', roles: ['Admin', 'Cashier'] },
  { to: '/shifts', icon: Clock, labelKey: 'nav.shifts', roles: ['Admin', 'Cashier', 'Delivery'] },
  { to: '/expenses', icon: Receipt, labelKey: 'nav.expenses', roles: ['Admin'] },
  { to: '/segments', icon: PieChart, labelKey: 'nav.segments', roles: ['Admin'] },
  { to: '/layaway', icon: CalendarClock, labelKey: 'nav.layaway', roles: ['Admin', 'Cashier'] },
  { to: '/collections', icon: Palette, labelKey: 'nav.collections', roles: ['Admin'] },
  { to: '/warranty', icon: ShieldCheck, labelKey: 'nav.warranty', roles: ['Admin'] },
  { to: '/feedback', icon: Star, labelKey: 'nav.feedback', roles: ['Admin'] },
  { to: '/backup', icon: Database, labelKey: 'nav.backup', roles: ['Admin'] },
  { to: '/activity', icon: Activity, labelKey: 'nav.activity', roles: ['Admin'] },
  // Products & Stock
  { to: '/inventory', icon: Package, labelKey: 'nav.inventory', roles: ['Admin', 'Cashier'] },
  { to: '/categories', icon: Layers, labelKey: 'nav.categories', roles: ['Admin'] },
  { to: '/barcode', icon: ScanBarcode, labelKey: 'nav.barcode', roles: ['Admin', 'Cashier'] },
  { to: '/purchase-orders', icon: ClipboardList, labelKey: 'nav.purchaseOrders', roles: ['Admin'] },
  { to: '/promotions', icon: Ticket, labelKey: 'nav.promotions', roles: ['Admin'] },
  { to: '/gift-cards', icon: Gift, labelKey: 'nav.giftCards', roles: ['Admin'] },
  { to: '/stock-count', icon: PackageCheck, labelKey: 'nav.stockCount', roles: ['Admin'] },
  { to: '/distributors', icon: Building2, labelKey: 'nav.distributors', roles: ['Admin'] },
  // Orders & Customers
  { to: '/deliveries', icon: Truck, labelKey: 'nav.deliveries', roles: ['Admin', 'Delivery'] },
  { to: '/customers', icon: UserRound, labelKey: 'nav.customers', roles: ['Admin'] },
  // Administration
  { to: '/users', icon: Users, labelKey: 'nav.users', roles: ['Admin'] },
  { to: '/exports', icon: Download, labelKey: 'nav.exports', roles: ['Admin'] },
  { to: '/branches', icon: GitBranch, labelKey: 'nav.branches', roles: ['Admin'] },
  { to: '/storefront', icon: Globe, labelKey: 'nav.storefront', roles: ['Admin'] },
  { to: '/online-orders', icon: ShoppingBag, labelKey: 'nav.onlineOrders', roles: ['Admin'] },
  { to: '/report-builder', icon: BarChart3, labelKey: 'nav.reportBuilder', roles: ['Admin'] },
  { to: '/vendors', icon: Store, labelKey: 'nav.vendors', roles: ['Admin'] },
  { to: '/smart-pricing', icon: Zap, labelKey: 'nav.smartPricing', roles: ['Admin'] },
  { to: '/ai-insights', icon: Brain, labelKey: 'nav.aiInsights', roles: ['Admin'] },
  { to: '/audit-log', icon: ScrollText, labelKey: 'nav.auditLog', roles: ['Admin'] },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings', roles: ['Admin'] },
];

export default function Sidebar(): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const filteredNav = navItems.filter((item) => item.roles.includes(user?.role ?? ''));

  const handleLogout = async (): Promise<void> => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Continue logout even if API fails
    }
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-background border-e border-border h-screen fixed start-0 top-0 z-40">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <img src={moonLogo} alt="MOON Fashion & Style" className="h-12" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-data tracking-wider transition-all ${
                  isActive
                    ? 'text-gold border-s-2 border-gold bg-gold/5 shadow-glow'
                    : 'text-muted hover:text-foreground hover:bg-surface'
                }`
              }
            >
              <item.icon className="h-5 w-5 text-gold" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 w-full text-sm text-muted hover:text-destructive transition-colors rounded-md"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 flex items-center justify-around py-2 px-1">
        {filteredNav.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-1 text-[10px] transition-colors ${
                isActive ? 'text-gold' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{t(item.labelKey).split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
