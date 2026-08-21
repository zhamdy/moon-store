import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../tests/testUtils';
import { Breadcrumbs, TabsNav, PageHeader } from '../navigation';

describe('Unit 5: Navigation & Global Utilities Suite', () => {
  describe('Breadcrumbs', () => {
    it('renders accessible list with aria-current="page" on current leaf', () => {
      renderWithProviders(
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Inventory', href: '/inventory' },
            { label: 'Product Details', isCurrent: true },
          ]}
        />
      );

      const nav = screen.getByRole('navigation', { name: 'Breadcrumbs' });
      expect(nav).toBeInTheDocument();

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveAttribute('href', '/');

      const currentItem = screen.getByText('Product Details');
      expect(currentItem).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('TabsNav', () => {
    it('renders tabs with role="tablist" and role="tab", supporting keyboard navigation', () => {
      const handleChange = vi.fn();
      renderWithProviders(
        <TabsNav
          activeTab="overview"
          onChange={handleChange}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'analytics', label: 'Analytics', count: 5 },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();

      const overviewTab = screen.getByRole('tab', { name: /Overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      expect(overviewTab).toHaveAttribute('tabIndex', '0');

      const analyticsTab = screen.getByRole('tab', { name: /Analytics/i });
      expect(analyticsTab).toHaveAttribute('aria-selected', 'false');
      expect(analyticsTab).toHaveAttribute('tabIndex', '-1');
      expect(screen.getByText('5')).toBeInTheDocument();

      // Arrow navigation
      fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });
      expect(handleChange).toHaveBeenCalledWith('analytics');
    });
  });

  describe('PageHeader', () => {
    it('renders title, description, breadcrumbs slot, badge, and actions', () => {
      renderWithProviders(
        <PageHeader
          title="Inventory Items"
          description="Manage all stock units"
          badge={<span data-testid="test-badge">Active</span>}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory' }]}
          actions={<button data-testid="add-btn">Add Product</button>}
          tabs={<div data-testid="sub-tabs">Sub tabs</div>}
        />
      );

      expect(
        screen.getByRole('heading', { level: 1, name: 'Inventory Items' })
      ).toBeInTheDocument();
      expect(screen.getByText('Manage all stock units')).toBeInTheDocument();
      expect(screen.getByTestId('test-badge')).toBeInTheDocument();
      expect(screen.getByTestId('add-btn')).toBeInTheDocument();
      expect(screen.getByTestId('sub-tabs')).toBeInTheDocument();
    });
  });
});
