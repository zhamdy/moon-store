import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Crown, Heart, Star, AlertTriangle, Moon, UserX, UserPlus } from 'lucide-react';
import { Badge, type BadgeVariant, PageHeader, DataTable } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import type { SegmentsResponse, CustomerRFM } from '../types';

const segmentIcons: Record<string, React.ReactNode> = {
  champions: <Crown className="h-5 w-5 text-amber-500" />,
  loyal: <Heart className="h-5 w-5 text-rose-500" />,
  potential: <Star className="h-5 w-5 text-blue-500" />,
  at_risk: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  hibernating: <Moon className="h-5 w-5 text-purple-500" />,
  lost: <UserX className="h-5 w-5 text-red-500" />,
  new: <UserPlus className="h-5 w-5 text-emerald-500" />,
};

const segmentColors: Record<string, string> = {
  champions: 'bg-amber-500/10 border-amber-500/30',
  loyal: 'bg-rose-500/10 border-rose-500/30',
  potential: 'bg-blue-500/10 border-blue-500/30',
  at_risk: 'bg-orange-500/10 border-orange-500/30',
  hibernating: 'bg-purple-500/10 border-purple-500/30',
  lost: 'bg-red-500/10 border-red-500/30',
  new: 'bg-emerald-500/10 border-emerald-500/30',
};

const segmentVariant: Record<string, BadgeVariant> = {
  champions: 'warning',
  loyal: 'danger',
  potential: 'secondary',
  at_risk: 'warning',
  hibernating: 'default',
  lost: 'danger',
  new: 'success',
};

const segmentKeys: Record<string, string> = {
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

  const { data, isLoading } = useApiQuery<SegmentsResponse>(['segments'], 'segments');

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    return selectedSegment
      ? data.customers.filter((c) => c.segment === selectedSegment)
      : data.customers;
  }, [data?.customers, selectedSegment]);

  const columns: ColumnDef<CustomerRFM>[] = [
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
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('segments.title')} />

      {/* Segment cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {data?.summary.map((seg) => (
          <button
            key={seg.segment}
            onClick={() => setSelectedSegment(selectedSegment === seg.segment ? null : seg.segment)}
            className={`p-3.5 rounded-lg border text-start transition-all shadow-sm ${
              segmentColors[seg.segment] || 'bg-card border-border'
            } ${selectedSegment === seg.segment ? 'ring-2 ring-primary' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {segmentIcons[seg.segment]}
              <span className="text-xs font-semibold">{t(segmentKeys[seg.segment] as never)}</span>
            </div>
            <p className="text-xl font-data font-bold text-foreground">{seg.count}</p>
            <p className="text-[11px] text-muted-foreground font-data mt-0.5">
              {formatCurrency(seg.total_revenue)}
            </p>
          </button>
        ))}
      </div>

      {/* Customer table */}
      <DataTable
        columns={columns}
        data={filteredCustomers}
        isLoading={isLoading}
        searchPlaceholder={t('common.search')}
      />
    </div>
  );
}
