import type { ReactNode } from 'react';
import type {
  ColumnDef,
  SortingState,
  RowSelectionState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table';

export type TableDensity = 'compact' | 'standard';

export interface BaseDataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  isFetching?: boolean;
  error?: string;
  onRetry?: () => void;
  searchPlaceholder?: string;
  searchError?: string;
  isFiltered?: boolean;
  enableSearch?: boolean;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (row: TData) => string;
  renderSubComponent?: (row: TData) => ReactNode | null;
  toolbar?: ReactNode;
  bulkActions?: (selectedRows: TData[], clearSelection: () => void) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  filteredEmptyTitle?: string;
  filteredEmptyDescription?: string;
  className?: string;
}

export interface ClientDataTableProps<TData> extends BaseDataTableProps<TData> {
  mode?: 'client';
}

export interface ServerDataTableProps<TData> extends BaseDataTableProps<TData> {
  mode: 'server';
  pageCount?: number;
  totalRows?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  search?: string;
  onSearchChange?: (search: string) => void;
}

export type DataTableProps<TData> = ClientDataTableProps<TData> | ServerDataTableProps<TData>;
