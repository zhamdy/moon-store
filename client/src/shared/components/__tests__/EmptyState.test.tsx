import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { renderWithProviders } from '../../tests/testUtils';
import EmptyState from '../EmptyState';

/**
 * #105: DataTable owns a persistent live region, so the EmptyState it renders inside a
 * table cell must not be one as well. Every other caller mounts this component *as* the
 * news and keeps the announcement.
 */
describe('EmptyState announcement mode', () => {
  it('is its own live region by default, for callers that have no other', () => {
    renderWithProviders(<EmptyState icon={Search} title="No users yet" />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('No users yet');
  });

  it('renders the same content with no live region when the caller owns one', () => {
    renderWithProviders(<EmptyState icon={Search} title="No users yet" announce={false} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('No users yet')).toBeInTheDocument();
  });
});
