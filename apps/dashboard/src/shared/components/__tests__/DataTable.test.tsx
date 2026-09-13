import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { renderWithProviders } from '../../tests/testUtils';
import { DataTable } from '../data-table';

interface TestUser {
  id: string;
  name: string;
  role: string;
}

const testData: TestUser[] = [
  { id: '1', name: 'Alice Smith', role: 'Admin' },
  { id: '2', name: 'Bob Jones', role: 'Cashier' },
  { id: '3', name: 'Charlie Brown', role: 'Manager' },
];

const columns: ColumnDef<TestUser, unknown>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    enableSorting: true,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
  },
  {
    accessorKey: 'role',
    header: 'Role',
    enableSorting: true,
  },
];

describe('Unit 4: Enterprise DataTable Suite', () => {
  describe('Client Mode', () => {
    it('renders rows, performs search filtering and updates aria-sort on click', () => {
      renderWithProviders(
        <DataTable<TestUser>
          data={testData}
          columns={columns}
          enableSearch
          searchPlaceholder="Filter users..."
        />
      );

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

      // Search filter
      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();

      // Sort column header
      const nameHeader = screen.getByRole('button', { name: /Name/i });
      fireEvent.click(nameHeader);

      const nameTh = nameHeader.closest('th');
      expect(nameTh).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.click(nameHeader);
      expect(nameTh).toHaveAttribute('aria-sort', 'descending');
    });

    it('renders empty state when no records match filter', () => {
      renderWithProviders(<DataTable<TestUser> data={testData} columns={columns} enableSearch />);

      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

      expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    });
  });

  describe('Server Mode', () => {
    it('delegates sorting and pagination to external handlers', () => {
      const handleSortingChange = vi.fn();
      const handleSearchChange = vi.fn();

      renderWithProviders(
        <DataTable<TestUser>
          mode="server"
          data={testData}
          columns={columns}
          onSortingChange={handleSortingChange}
          onSearchChange={handleSearchChange}
          pageCount={5}
        />
      );

      const nameHeader = screen.getByRole('button', { name: /Name/i });
      fireEvent.click(nameHeader);
      expect(handleSortingChange).toHaveBeenCalled();

      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(handleSearchChange).toHaveBeenCalledWith('test');
    });

    it('retains rows while refetching and exposes an accessible status', () => {
      renderWithProviders(
        <DataTable<TestUser>
          mode="server"
          data={testData}
          columns={columns}
          isFetching
          totalRows={3}
          pageCount={1}
        />
      );

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      // `status` takes no name from its content, so the region is nameless by design
      // and its text is the announcement. One region, one source (#105).
      expect(screen.getByRole('status')).toHaveTextContent('Loading results');
    });

    it('shows a retryable error without removing stale rows', () => {
      const retry = vi.fn();
      renderWithProviders(
        <DataTable<TestUser>
          mode="server"
          data={testData}
          columns={columns}
          error="Unable to load results"
          onRetry={retry}
        />
      );

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(retry).toHaveBeenCalledOnce();
    });

    it('distinguishes a filtered empty result from an empty dataset', () => {
      renderWithProviders(
        <DataTable<TestUser>
          mode="server"
          data={[]}
          columns={columns}
          search="missing"
          filteredEmptyTitle="No matching users"
          emptyTitle="No users yet"
        />
      );

      // Twice on purpose since #105: once visibly in the cell, once in the live region.
      expect(screen.getAllByText('No matching users')).toHaveLength(2);
      expect(screen.queryByText('No users yet')).not.toBeInTheDocument();
    });
  });

  describe('Bulk Actions & Selection', () => {
    it('renders bulk action toolbar when rows are selected', () => {
      renderWithProviders(
        <DataTable<TestUser>
          data={testData}
          columns={columns}
          enableRowSelection
          rowSelection={{ '0': true, '1': true }}
          bulkActions={(selected) => (
            <button data-testid="bulk-delete">Delete {selected.length} items</button>
          )}
        />
      );

      const toolbar = screen.getByRole('toolbar', { name: 'Bulk actions toolbar' });
      expect(toolbar).toBeInTheDocument();
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-delete')).toBeInTheDocument();
    });
  });
});

/**
 * #105: the empty state used to declare `role="status" aria-live="polite"` on the `<td>`
 * itself, which overrode the cell's table semantics — and, being mounted at the same
 * moment as its own message, was the pattern that announces least reliably.
 */
describe('DataTable empty-state announcements', () => {
  const renderTable = (props: Partial<Parameters<typeof DataTable<TestUser>>[0]> = {}) =>
    renderWithProviders(
      <DataTable<TestUser> mode="server" data={testData} columns={columns} {...props} />
    );

  it('leaves the empty row a real cell, with no table element carrying a status role', () => {
    renderTable({ data: [], emptyTitle: 'No users yet' });

    expect(document.querySelector('td[role]')).toBeNull();
    expect(document.querySelector('table [role="status"]')).toBeNull();
    // The cell is still a cell: the row it sits in still describes a table structure.
    expect(screen.getByRole('cell')).toBeInTheDocument();
  });

  it('announces from one region that was already mounted when the rows were there', () => {
    const { rerender } = renderTable({ totalRows: 3 });

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('3 results');
    expect(screen.getAllByRole('status')).toHaveLength(1);

    rerender(
      <DataTable<TestUser>
        mode="server"
        data={[]}
        columns={columns}
        totalRows={0}
        search="zzz"
        filteredEmptyTitle="No matching users"
      />
    );

    // The same node, updated — not a new one mounted alongside the message.
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('No matching users');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('keeps announcing when rows come back and go away again', () => {
    const { rerender } = renderTable({ data: [], totalRows: 0, emptyTitle: 'No users yet' });
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('No users yet');

    rerender(<DataTable<TestUser> mode="server" data={testData} columns={columns} totalRows={3} />);
    expect(region).toHaveTextContent('3 results');

    rerender(
      <DataTable<TestUser>
        mode="server"
        data={[]}
        columns={columns}
        totalRows={0}
        emptyTitle="No users yet"
      />
    );
    expect(region).toHaveTextContent('No users yet');
  });

  it('does not claim there are no results while the request is still out', () => {
    renderTable({ data: [], totalRows: 0, isFetching: true, emptyTitle: 'No users yet' });

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Loading results');
    expect(region).not.toHaveTextContent('No users yet');
  });
});
