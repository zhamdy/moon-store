import { useState, Fragment } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import EmptyState from './EmptyState';
import { useTranslation } from '../i18n';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  enableSearch?: boolean;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (row: TData) => string;
  renderSubComponent?: (row: TData) => React.ReactNode | null;
}

export default function DataTable<TData>({
  columns,
  data,
  isLoading,
  searchPlaceholder,
  enableSearch = true,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  renderSubComponent,
}: DataTableProps<TData>): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const { t } = useTranslation();
  const [animateParent] = useAutoAnimate();

  const table = useReactTable<TData>({
    data: data || [],
    columns,
    state: {
      sorting,
      globalFilter,
      ...(enableRowSelection && rowSelection !== undefined ? { rowSelection } : {}),
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    ...(enableRowSelection ? { enableRowSelection: true, onRowSelectionChange } : {}),
    ...(getRowId ? { getRowId } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {enableSearch && <Skeleton className="h-10 w-full sm:w-72" />}
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enableSearch && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
          <Input
            placeholder={searchPlaceholder || t('common.search')}
            value={globalFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value)}
            className="ps-9"
            aria-label={searchPlaceholder || t('common.search')}
          />
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden shadow-sm relative">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm font-data">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-table-header border-b border-border sticky top-0 z-10"
                >
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-start font-semibold text-muted tracking-widest uppercase text-[11px]"
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
                            className="flex items-center gap-2 cursor-pointer select-none"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="text-gold">
                              {sorted === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : sorted === 'desc' ? (
                                <ArrowDown className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                              )}
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody ref={animateParent}>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} role="status" aria-live="polite">
                    <EmptyState
                      icon={Search}
                      title={t('common.noResults')}
                      description={t('common.noResultsDesc')}
                    />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const subContent = renderSubComponent ? renderSubComponent(row.original) : null;
                  return (
                    <Fragment key={row.id}>
                      <tr className="group border-b border-border hover:bg-surface/50 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3.5 text-foreground">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {subContent && (
                        <tr className="bg-surface/30">
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
        {/* Fade gradient for horizontal scroll on mobile */}
        <div className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>{t('common.rowsPerPage')}</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(val: string) => table.setPageSize(Number(val))}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            {' - '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
            {` ${t('common.of')} `}
            {table.getFilteredRowModel().rows.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t('common.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
