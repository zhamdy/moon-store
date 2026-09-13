import { useMemo } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Crown, Heart, Star, AlertTriangle, Moon, UserX, UserPlus, X } from 'lucide-react';
import { Button } from '@heroui/react';
import { Badge, type BadgeVariant, PageHeader, DataTable } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import {
  CUSTOMER_SEGMENTS,
  type CustomerSegmentKey,
  type SegmentsResponse,
  type CustomerRFM,
} from '../types';

const segmentIcons: Record<CustomerSegmentKey, React.ReactNode> = {
  champions: <Crown className="h-5 w-5 text-amber-500" aria-hidden="true" />,
  loyal: <Heart className="h-5 w-5 text-rose-500" aria-hidden="true" />,
  potential: <Star className="h-5 w-5 text-blue-500" aria-hidden="true" />,
  at_risk: <AlertTriangle className="h-5 w-5 text-orange-500" aria-hidden="true" />,
  hibernating: <Moon className="h-5 w-5 text-purple-500" aria-hidden="true" />,
  lost: <UserX className="h-5 w-5 text-red-500" aria-hidden="true" />,
  new: <UserPlus className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
};

const segmentColors: Record<CustomerSegmentKey, string> = {
  champions: 'bg-amber-500/10 border-amber-500/30',
  loyal: 'bg-rose-500/10 border-rose-500/30',
  potential: 'bg-blue-500/10 border-blue-500/30',
  at_risk: 'bg-orange-500/10 border-orange-500/30',
  hibernating: 'bg-purple-500/10 border-purple-500/30',
  lost: 'bg-red-500/10 border-red-500/30',
  new: 'bg-emerald-500/10 border-emerald-500/30',
};

const segmentVariant: Record<CustomerSegmentKey, BadgeVariant> = {
  champions: 'warning',
  loyal: 'danger',
  potential: 'secondary',
  at_risk: 'warning',
  hibernating: 'default',
  lost: 'danger',
  new: 'success',
};

const segmentKeys: Record<CustomerSegmentKey, string> = {
  champions: 'segments.champions',
  loyal: 'segments.loyal',
  potential: 'segments.potential',
  at_risk: 'segments.atRisk',
  hibernating: 'segments.hibernating',
  lost: 'segments.lost',
  new: 'segments.new',
};

export default function SegmentsPage() {
  const { t } = useTranslation();
  const { search: routeSearch, page, pageSize, update } = useListRouteState();

  const selectedSegment = CUSTOMER_SEGMENTS.includes(routeSearch.segment as CustomerSegmentKey)
    ? (routeSearch.segment as CustomerSegmentKey)
    : null;

  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
  };
  if (selectedSegment) params.segment = selectedSegment;

  const { data, meta, isLoading, isFetching, error, refetch } = useApiQuery<SegmentsResponse>(
    ['analytics', 'customer-segments'],
    'analytics/customer-segments',
    params
  );

  useLastPageRecovery(page, meta?.pagination?.totalItems, meta?.pagination?.totalPages, update);

  // The roll-up covers every scored customer, so the tiles keep their counts
  // while a filter is on — which is what makes them a usable way back out.
  const summary = data?.summary ?? [];
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };

  const toggleSegment = (segment: CustomerSegmentKey) =>
    update({ segment: selectedSegment === segment ? undefined : segment, page: 1 });

  const columns: ColumnDef<CustomerRFM>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-foreground">{row.original.name}</span>
            {row.original.phone && (
              <p className="text-xs text-muted-foreground">{row.original.phone}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'segment',
        header: t('segments.segment'),
        cell: ({ row }) => (
          <Badge size="sm" variant={segmentVariant[row.original.segment] || 'default'}>
            {t(segmentKeys[row.original.segment] as never)}
          </Badge>
        ),
      },
      {
        accessorKey: 'recency_days',
        header: t('segments.recency'),
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className="font-data text-muted-foreground">{val >= 999 ? '—' : `${val}d`}</span>
          );
        },
      },
      {
        accessorKey: 'frequency',
        header: t('segments.frequency'),
        cell: ({ getValue }) => <span className="font-data">{getValue() as number}</span>,
      },
      {
        accessorKey: 'monetary',
        header: t('segments.monetary'),
        cell: ({ getValue }) => (
          <span className="font-data font-medium text-primary">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('segments.title')}
        actions={
          selectedSegment && (
            <Button
              size="sm"
              variant="flat"
              startContent={<X className="h-4 w-4" aria-hidden="true" />}
              onPress={() => update({ segment: undefined, page: 1 })}
            >
              {t('common.clearFilters')}
            </Button>
          )
        }
      />

      {/* The tiles are the filter control, so each one is a toggle rather than a card. */}
      <div
        role="group"
        aria-label={t('segments.title')}
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3"
      >
        {isLoading
          ? CUSTOMER_SEGMENTS.map((segment) => (
              <div
                key={segment}
                className="h-[104px] rounded-lg border border-border bg-card animate-pulse"
              />
            ))
          : summary.map((seg) => (
              <button
                type="button"
                key={seg.segment}
                aria-pressed={selectedSegment === seg.segment}
                onClick={() => toggleSegment(seg.segment)}
                className={`p-3.5 rounded-lg border text-start transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  segmentColors[seg.segment] || 'bg-card border-border'
                } ${selectedSegment === seg.segment ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {segmentIcons[seg.segment]}
                  <span className="text-xs font-semibold">
                    {t(segmentKeys[seg.segment] as never)}
                  </span>
                </div>
                <p className="text-xl font-data font-bold text-foreground">{seg.count}</p>
                <p className="text-[11px] text-muted-foreground font-data mt-0.5">
                  {formatCurrency(seg.total_revenue)}
                </p>
              </button>
            ))}
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={data?.customers ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
        enableSearch={false}
        isFiltered={selectedSegment !== null}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          update({ page: next.pageIndex + 1, pageSize: next.pageSize });
        }}
        pageCount={meta?.pagination?.totalPages ?? 0}
        totalRows={meta?.pagination?.totalItems ?? 0}
      />
    </div>
  );
}
