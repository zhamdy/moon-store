import { Link, useNavigate } from '@tanstack/react-router';
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
  Star,
  Database,
  GitBranch,
  Globe,
  ShoppingBag,
  BarChart3,
  Store,
  Zap,
  Brain,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerHeader,
  DrawerFooter,
  Button,
} from '@heroui/react';
import { useAuthStore } from '../features/auth/store/authStore';
import { useTranslation } from '../shared/i18n/index';
import { useTransport } from '../shared/lib/transport/index';
import moonLogo from '../shared/assets/moon-logo.svg';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  roles: string[];
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    labelKey: 'nav.sectionOperations',
    items: [
      { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['Admin'] },
      { to: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', roles: ['Admin', 'Cashier'] },
      { to: '/sales', icon: History, labelKey: 'nav.sales', roles: ['Admin', 'Cashier'] },
      { to: '/register', icon: Vault, labelKey: 'nav.register', roles: ['Admin', 'Cashier'] },
      {
        to: '/shifts',
        icon: Clock,
        labelKey: 'nav.shifts',
        roles: ['Admin', 'Cashier', 'Delivery'],
      },
      { to: '/expenses', icon: Receipt, labelKey: 'nav.expenses', roles: ['Admin'] },
      { to: '/segments', icon: PieChart, labelKey: 'nav.segments', roles: ['Admin'] },
      { to: '/layaway', icon: CalendarClock, labelKey: 'nav.layaway', roles: ['Admin', 'Cashier'] },
      { to: '/feedback', icon: Star, labelKey: 'nav.feedback', roles: ['Admin'] },
      { to: '/backup', icon: Database, labelKey: 'nav.backup', roles: ['Admin'] },
    ],
  },
  {
    labelKey: 'nav.sectionProducts',
    items: [
      { to: '/inventory', icon: Package, labelKey: 'nav.inventory', roles: ['Admin', 'Cashier'] },
      { to: '/categories', icon: Layers, labelKey: 'nav.categories', roles: ['Admin'] },
      { to: '/barcode', icon: ScanBarcode, labelKey: 'nav.barcode', roles: ['Admin', 'Cashier'] },
      {
        to: '/purchase-orders',
        icon: ClipboardList,
        labelKey: 'nav.purchaseOrders',
        roles: ['Admin'],
      },
      { to: '/promotions', icon: Ticket, labelKey: 'nav.promotions', roles: ['Admin'] },
      { to: '/gift-cards', icon: Gift, labelKey: 'nav.giftCards', roles: ['Admin'] },
      { to: '/bundles', icon: Gift, labelKey: 'nav.bundles', roles: ['Admin'] },
      { to: '/stock-count', icon: PackageCheck, labelKey: 'nav.stockCount', roles: ['Admin'] },
      { to: '/distributors', icon: Building2, labelKey: 'nav.distributors', roles: ['Admin'] },
    ],
  },
  {
    labelKey: 'nav.sectionOrders',
    items: [
      { to: '/deliveries', icon: Truck, labelKey: 'nav.deliveries', roles: ['Admin', 'Delivery'] },
      { to: '/customers', icon: UserRound, labelKey: 'nav.customers', roles: ['Admin'] },
    ],
  },
  {
    labelKey: 'nav.sectionAdmin',
    items: [
      { to: '/users', icon: Users, labelKey: 'nav.users', roles: ['Admin'] },
      { to: '/exports', icon: Download, labelKey: 'nav.exports', roles: ['Admin'] },
      { to: '/branches', icon: GitBranch, labelKey: 'nav.branches', roles: ['Admin'] },
      { to: '/storefront', icon: Globe, labelKey: 'nav.storefront', roles: ['Admin'] },
      { to: '/online-orders', icon: ShoppingBag, labelKey: 'nav.onlineOrders', roles: ['Admin'] },
      { to: '/report-builder', icon: BarChart3, labelKey: 'nav.reportBuilder', roles: ['Admin'] },
      { to: '/vendors', icon: Store, labelKey: 'nav.vendors', roles: ['Admin'] },
      { to: '/smart-pricing', icon: Zap, labelKey: 'nav.smartPricing', roles: ['Admin'] },
      { to: '/ai-insights', icon: Brain, labelKey: 'nav.aiInsights', roles: ['Admin'] },
      { to: '/analytics', icon: TrendingUp, labelKey: 'nav.advancedAnalytics', roles: ['Admin'] },
      { to: '/audit-log', icon: ScrollText, labelKey: 'nav.auditLog', roles: ['Admin'] },
      { to: '/settings', icon: Settings, labelKey: 'nav.settings', roles: ['Admin'] },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export default function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const transport = useTransport();

  const userRole = user?.role ?? '';

  const handleLogout = async (): Promise<void> => {
    try {
      await transport.request({ method: 'POST', path: 'auth/logout' });
    } catch {
      // Continue logout even if API fails
    }
    logout();
    navigate({ to: '/login' });
  };

  const renderNavContent = (onItemClick?: () => void) => (
    <nav className="flex-1 p-3 space-y-4 overflow-y-auto" aria-label={t('nav.mainNav')}>
      {navSections.map((section) => {
        const visibleItems = section.items.filter((item) => item.roles.includes(userRole));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.labelKey} className="space-y-1">
            <div className="px-3 py-1">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                {t(section.labelKey)}
              </span>
            </div>
            {visibleItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onItemClick}
                activeOptions={{ exact: item.to === '/' }}
                activeProps={{
                  className: 'bg-primary text-primary-foreground font-medium shadow-sm',
                }}
                inactiveProps={{
                  className: 'text-muted-foreground hover:text-foreground hover:bg-accent',
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-e border-border h-screen fixed start-0 top-0 z-40">
        {/* Logo */}
        <div className="h-16 px-6 border-b border-border flex items-center">
          <img src={moonLogo} alt="MOON Fashion & Style" className="h-9" />
        </div>

        {/* Navigation */}
        {renderNavContent()}

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <Button
            variant="light"
            onClick={handleLogout}
            className="w-full justify-start gap-3 px-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <Drawer
        isOpen={mobileOpen}
        onOpenChange={onMobileOpenChange}
        placement={locale === 'ar' ? 'right' : 'left'}
        backdrop="blur"
        size="xs"
        classNames={{
          base: 'bg-card text-card-foreground',
          header: 'border-b border-border p-4 flex items-center justify-between',
          body: 'p-0 overflow-y-auto',
          footer: 'border-t border-border p-3',
        }}
      >
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader>
                <img src={moonLogo} alt="MOON Fashion & Style" className="h-8" />
              </DrawerHeader>
              <DrawerBody>{renderNavContent(onClose)}</DrawerBody>
              <DrawerFooter>
                <Button
                  variant="light"
                  onClick={() => {
                    onClose();
                    handleLogout();
                  }}
                  className="w-full justify-start gap-3 px-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
