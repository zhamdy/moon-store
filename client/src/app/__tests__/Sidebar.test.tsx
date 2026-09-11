import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useAuthStore } from '@/features/auth';
import { useSettingsStore } from '@/shared/store/settingsStore';
import { renderWithRouter } from '@/shared/tests/routerTestUtils';
import Sidebar from '../Sidebar';

type Role = 'Admin' | 'Cashier' | 'Delivery';

const USERS = {
  Admin: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
  Cashier: { id: 2, name: 'Cashier User', email: 'cashier@moon.com', role: 'Cashier' },
  Delivery: { id: 3, name: 'Delivery User', email: 'delivery@moon.com', role: 'Delivery' },
} as const;

function renderSidebarAs(role: Role, props: { mobileOpen?: boolean } = {}) {
  const user = USERS[role];
  useAuthStore.setState({ user, isAuthenticated: true });
  return renderWithRouter(<Sidebar {...props} />, {
    initialRoute: role === 'Delivery' ? '/shifts' : role === 'Cashier' ? '/pos' : '/',
    authState: { isAuthenticated: true, user },
  });
}

function readSections(nav: HTMLElement): Array<[string, string[]]> {
  return Array.from(nav.children).map((section) => [
    section.querySelector('span')?.textContent?.trim() ?? '',
    within(section as HTMLElement)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim() ?? ''),
  ]);
}

describe('Sidebar navigation', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('groups the Admin sidebar into six sections, in order', async () => {
    renderSidebarAs('Admin');

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(readSections(nav)).toEqual([
      [
        'Daily Operations',
        ['Dashboard', 'Point of Sale', 'Sales History', 'Register', 'Shifts', 'Deliveries'],
      ],
      ['Catalog', ['Inventory', 'Categories', 'Collections', 'Stock Count', 'Barcode Tools']],
      ['Customers & Marketing', ['Customers', 'Segments', 'Promotions', 'Gift Cards']],
      ['Purchasing', ['Purchase Orders', 'Distributors', 'Expenses']],
      ['Insights', ['Advanced Analytics', 'Export Center']],
      ['Administration', ['Users', 'Audit Log', 'Settings']],
    ]);

    expect(screen.queryByText(/Branches/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bundles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Online Orders/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Storefront/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Warranty/i)).not.toBeInTheDocument();
  });

  it('shows the Cashier only Operations and Catalog, with no empty section labels', async () => {
    renderSidebarAs('Cashier');

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(readSections(nav)).toEqual([
      ['Daily Operations', ['Point of Sale', 'Sales History', 'Register', 'Shifts']],
      ['Catalog', ['Inventory', 'Barcode Tools']],
    ]);

    for (const label of ['Customers & Marketing', 'Purchasing', 'Insights', 'Administration']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Users/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Settings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Branches/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bundles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Online Orders/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Storefront/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Warranty/i)).not.toBeInTheDocument();
  });

  it('renders no label for a section the role has nothing in', async () => {
    renderSidebarAs('Delivery');

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(readSections(nav)).toEqual([['Daily Operations', ['Shifts', 'Deliveries']]]);

    for (const label of [
      'Catalog',
      'Customers & Marketing',
      'Purchasing',
      'Insights',
      'Administration',
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('calls logout when logout button is clicked', async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    renderSidebarAs('Admin');

    const logoutBtns = await screen.findAllByRole('button', { name: /Logout/i });
    fireEvent.click(logoutBtns[0]);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  it('opens the mobile drawer from the left in English', async () => {
    renderSidebarAs('Admin', { mobileOpen: true });

    const dashboards = await screen.findAllByText(/Dashboard/i);
    expect(dashboards.length).toBeGreaterThan(1);

    // HeroUI's Drawer never forwards `placement` to the dialog, whose data-placement
    // always reads "right"; the side is only visible in the placement variant's class.
    const drawer = await screen.findByRole('dialog');
    expect(drawer).toHaveClass('left-0');
    expect(drawer).not.toHaveClass('right-0');
  });

  it('translates the section labels in Arabic and opens the drawer from the right', async () => {
    useSettingsStore.setState({ locale: 'ar' });
    renderSidebarAs('Admin', { mobileOpen: true });

    const drawer = await screen.findByRole('dialog');
    expect(drawer).toHaveClass('right-0');
    expect(drawer).not.toHaveClass('left-0');

    const nav = within(drawer).getByRole('navigation', { name: 'التنقل الرئيسي' });
    expect(readSections(nav).map(([label]) => label)).toEqual([
      'العمليات اليومية',
      'الكتالوج',
      'العملاء والتسويق',
      'المشتريات',
      'الرؤى',
      'الإدارة',
    ]);
  });
});
