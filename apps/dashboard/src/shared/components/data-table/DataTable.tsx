import React, { useState, Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
  type PaginationState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, AlertTriangle } from 'lucide-react';
import { TableBulkActions } from './TableBulkActions';
import { Skeleton } from '../data-display/SkeletonLoader';
import EmptyState from '../EmptyState';
import { useTranslation } from '../../i18n/index';
import type { DataTableProps } from './types';

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  isFetching,
  error,
  onRetry,
  searchPlaceholder,
  searchError,
  isFiltered = false,
  enableSearch = true,
  enableRowSelection = false,
  rowSelection: controlledRowSelection,
  onRowSelectionChange: setControlledRowSelection,
  getRowId,
  renderSubComponent,
  toolbar,
  bulkActions,
  emptyTitle,
  emptyDescription,
  filteredEmptyTitle,
  filteredEmptyDescription,
  className = '',
  ...props
}: DataTableProps<TData>): React.JSX.Element {
  const isServer = props.mode === 'server';
  const showSearch = enableSearch && (!isServer || Boolean(props.onSearchChange));
  const { t } = useTranslation();

  // Internal client state
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState<string>('');
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const activeSorting = isServer ? props.sorting || [] : internalSorting;
  const onSortingChange = isServer ? props.onSortingChange : setInternalSorting;

  const activePagination = isServer
    ? props.pagination || { pageIndex: 0, pageSize: 10 }
    : internalPagination;
  const onPaginationChange = isServer ? props.onPaginationChange : setInternalPagination;

  const activeGlobalFilter = isServer ? props.search || '' : internalGlobalFilter;
  const handleGlobalFilterChange = (val: string) => {
    if (isServer) {
      if (props.onSearchChange) props.onSearchChange(val);
    } else {
      setInternalGlobalFilter(val);
    }
  };

  const activeRowSelection =
    controlledRowSelection !== undefined ? controlledRowSelection : internalRowSelection;
  const handleRowSelectionChange = setControlledRowSelection || setInternalRowSelection;

  const table = useReactTable<TData>({
    data: data || [],
    columns,
    state: {
      sorting: activeSorting,
      globalFilter: activeGlobalFilter,
      columnVisibility,
      pagination: activePagination,
      ...(enableRowSelection ? { rowSelection: activeRowSelection } : {}),
    },
    onSortingChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    ...(enableRowSelection
      ? { enableRowSelection: true, onRowSelectionChange: handleRowSelectionChange }
      : {}),
    ...(getRowId ? { getRowId } : {}),
    manualPagination: isServer,
    manualSorting: isServer,
    manualFiltering: isServer,
    enableSorting: !isServer || Boolean(props.onSortingChange),
    pageCount: isServer ? props.pageCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    ...(!isServer
      ? {
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
        }
      : {}),
  });

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`} aria-busy="true">
        {showSearch && <Skeleton className="h-10 w-full sm:w-72 rounded-lg" />}
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const selectedRows = table.getSelectedRowModel
    ? table.getSelectedRowModel().rows.map((r) => r.original)
    : [];
  const selectedCount = Object.keys(activeRowSelection).length;

  const clearSelection = () => {
    table.resetRowSelection();
  };

  const densityPaddingClass = 'px-3 py-2 text-xs';

  const pageSize = table.getState().pagination.pageSize;
  const pageIndex = table.getState().pagination.pageIndex;
  const totalRowCount =
    isServer && props.totalRows !== undefined
      ? props.totalRows
      : table.getFilteredRowModel
        ? table.getFilteredRowModel().rows.length
        : (data || []).length;
  const startRow = totalRowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRowCount);

  const showingFiltered = Boolean(activeGlobalFilter) || isFiltered;
  const resolvedEmptyTitle =
    (showingFiltered ? filteredEmptyTitle : emptyTitle) || t('common.noResults');
  const resolvedEmptyDescription =
    (showingFiltered ? filteredEmptyDescription : emptyDescription) || t('common.noResultsDesc');
  const hasNoRows = table.getRowModel().rows.length === 0;

  /**
   * The table's single announcement source (#105).
   *
   * It lives outside the table and is mounted for the component's whole life, because a
   * live region only announces content that changes *while it is already in the DOM* —
   * one rendered alongside its own message has nothing to announce. The empty state used
   * to declare `role="status"` on the `<td>` instead, which both stripped the cell of its
   * table semantics and competed with this region for the same news.
   */
  const statusMessage = isFetching
    ? 'Loading results'
    : hasNoRows
      ? resolvedEmptyTitle
      : `${totalRowCount} results`;

  return (
    <div className={`space-y-4 ${className}`} aria-busy={isFetching || undefined}>
      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </div>
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        {showSearch && (
          <div className="w-full sm:w-72 relative">
            <div className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Search className="h-4 w-4" aria-hidden="true" />
            </div>
            <input
              type="search"
              role="searchbox"
              aria-label={searchPlaceholder || t('common.search')}
              placeholder={searchPlaceholder || t('common.search')}
              value={activeGlobalFilter}
              aria-invalid={!!searchError}
              aria-describedby={searchError ? 'data-table-search-error' : undefined}
              onChange={(e) => handleGlobalFilterChange(e.target.value)}
              className="w-full h-9 ps-9 pe-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none transition-colors hover:border-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {searchError && (
              <p id="data-table-search-error" className="mt-1 text-xs text-danger">
                {searchError}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ms-auto flex-wrap">{toolbar}</div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {enableRowSelection && selectedCount > 0 && (
        <TableBulkActions selectedCount={selectedCount} onClearSelection={clearSelection}>
          {bulkActions && bulkActions(selectedRows, clearSelection)}
        </TableBulkActions>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-danger/30 px-3 py-1.5 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm relative">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] font-data">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-card border-b border-border sticky top-0 z-10"
                >
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={`text-start font-semibold text-muted-foreground uppercase tracking-wider text-[11px] select-none ${densityPaddingClass}`}
                        aria-sort={
                          header.column.getCanSort()
                            ? sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : 'none'
                            : undefined
                        }
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 -mx-1"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span>
                              {sorted === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-primary" />
                              ) : sorted === 'desc' ? (
                                <ArrowDown className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                              )}
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-8">
                    {/* A plain cell: the announcement is the sr-only region above. */}
                    <EmptyState
                      icon={Search}
                      title={resolvedEmptyTitle}
                      description={resolvedEmptyDescription}
                      announce={false}
                    />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const subContent = renderSubComponent ? renderSubComponent(row.original) : null;
                  return (
                    <Fragment key={row.id}>
                      <tr className="group border-b border-border/60 hover:bg-muted/40 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={`text-foreground ${densityPaddingClass}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {subContent && (
                        <tr className="bg-muted/20 border-b border-border/60">
                          <td colSpan={columns.length} className="px-6 py-3">
                            {subContent}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-border pt-3 flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{t('common.rowsPerPage')}</span>
          <select
            aria-label={t('common.rowsPerPage')}
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>
            {startRow} - {endRow} {t('common.of')} {totalRowCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('common.previous')}
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('common.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
