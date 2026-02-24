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
  Moon,
  Sun,
  Languages,
  Ticket,
  Gift,
  PackageCheck,
  MapPin,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation } from '../i18n';
import api from '../services/api';
import moonLogo from '../assets/moon-logo.svg';
import NotificationCenter from './NotificationCenter';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['Admin'] },
  { to: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', roles: ['Admin', 'Cashier'] },
  { to: '/inventory', icon: Package, labelKey: 'nav.inventory', roles: ['Admin', 'Cashier'] },
  { to: '/barcode', icon: ScanBarcode, labelKey: 'nav.barcode', roles: ['Admin', 'Cashier'] },
  { to: '/deliveries', icon: Truck, labelKey: 'nav.deliveries', roles: ['Admin', 'Delivery'] },
  { to: '/sales', icon: History, labelKey: 'nav.sales', roles: ['Admin', 'Cashier'] },
  { to: '/users', icon: Users, labelKey: 'nav.users', roles: ['Admin'] },
  { to: '/customers', icon: UserRound, labelKey: 'nav.customers', roles: ['Admin'] },
  { to: '/distributors', icon: Building2, labelKey: 'nav.distributors', roles: ['Admin'] },
  { to: '/categories', icon: Layers, labelKey: 'nav.categories', roles: ['Admin'] },
  { to: '/purchase-orders', icon: ClipboardList, labelKey: 'nav.purchaseOrders', roles: ['Admin'] },
  { to: '/promotions', icon: Ticket, labelKey: 'nav.promotions', roles: ['Admin'] },
  { to: '/gift-cards', icon: Gift, labelKey: 'nav.giftCards', roles: ['Admin'] },
  { to: '/stock-count', icon: PackageCheck, labelKey: 'nav.stockCount', roles: ['Admin'] },
  { to: '/locations', icon: MapPin, labelKey: 'nav.locations', roles: ['Admin'] },
  { to: '/exports', icon: Download, labelKey: 'nav.exports', roles: ['Admin'] },
  { to: '/audit-log', icon: ScrollText, labelKey: 'nav.auditLog', roles: ['Admin'] },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings', roles: ['Admin'] },
];

export default function Sidebar(): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const { toggleLocale, toggleTheme, theme } = useSettingsStore();

  const filteredNav = navItems.filter((item) => item.roles.includes(user?.role ?? ''));

  const handleLogout = async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
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

        {/* Notifications + Settings toggles */}
        <div className="px-4 pb-1 flex justify-end">
          <NotificationCenter />
        </div>
        <div className="px-4 pb-2 flex gap-2">
          <button
            onClick={toggleLocale}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-data text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
          >
            <Languages className="h-3.5 w-3.5" />
            {locale === 'ar' ? 'EN' : '\u0639\u0631\u0628\u064A'}
          </button>
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-data text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
        </div>

        {/* User info + logout */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center">
              <span className="text-gold text-sm font-semibold">{user?.name?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted">{user?.role}</p>
            </div>
          </div>
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
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1 px-2 py-1 text-[10px] text-gold"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </nav>
    </>
  );
}
