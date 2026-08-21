import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { DollarSign } from 'lucide-react';
import { renderWithProviders } from '../../tests/testUtils';
import {
  StatCard,
  StatusBadge,
  Badge,
  CardSkeleton,
  TableSkeleton,
  FormSkeleton,
  ContentSkeleton,
} from '../data-display';

describe('Unit 2: Data Display & Feedback Suite', () => {
  describe('StatCard', () => {
    it('renders title, value, and accessible delta trend label', () => {
      renderWithProviders(
        <StatCard
          title="Total Revenue"
          value="$45,231.89"
          subtitle="vs last month"
          icon={DollarSign}
          delta={{ value: '+20.1%', type: 'increase' }}
          sparklineData={[10, 20, 15, 30, 25, 40]}
        />
      );

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('$45,231.89')).toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();

      const deltaBadge = screen.getByLabelText('Increased by +20.1%');
      expect(deltaBadge).toBeInTheDocument();
    });

    it('renders skeleton loader with aria-busy when isLoading is true', () => {
      renderWithProviders(<StatCard title="Active Users" value="1,234" isLoading />);

      const loadingRegion = screen.getByRole('status', { name: 'Loading Active Users' });
      expect(loadingRegion).toHaveAttribute('aria-busy', 'true');
    });

    it('handles click and keyboard Enter interactions when onClick is provided', () => {
      const handleClick = vi.fn();
      renderWithProviders(<StatCard title="Orders" value="450" onClick={handleClick} />);

      const card = screen.getByRole('button', { name: 'Orders: 450' });
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('SkeletonLoader suite', () => {
    it('renders CardSkeleton with specified count and accessibility attributes', () => {
      renderWithProviders(<CardSkeleton count={3} />);
      const loadingStatus = screen.getByRole('status', { name: 'Loading cards' });
      expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
    });

    it('renders TableSkeleton with specified rows', () => {
      renderWithProviders(<TableSkeleton rows={4} columns={3} />);
      const tableStatus = screen.getByRole('status', { name: 'Loading table data' });
      expect(tableStatus).toHaveAttribute('aria-busy', 'true');
    });

    it('renders FormSkeleton and ContentSkeleton', () => {
      renderWithProviders(
        <div>
          <FormSkeleton fields={2} />
          <ContentSkeleton lines={4} />
        </div>
      );

      expect(screen.getByRole('status', { name: 'Loading form' })).toHaveAttribute(
        'aria-busy',
        'true'
      );
      expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute(
        'aria-busy',
        'true'
      );
    });
  });

  describe('StatusBadge and Badge', () => {
    it('renders status text and variant classes', () => {
      renderWithProviders(<StatusBadge status="Delivered" />);
      const badge = screen.getByText('Delivered');
      expect(badge).toBeInTheDocument();
    });

    it('renders with dot indicator when showDot is true', () => {
      const { container } = renderWithProviders(
        <Badge variant="success" showDot>
          Active
        </Badge>
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      const dot = container.querySelector('.rounded-full.h-1\\.5');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
