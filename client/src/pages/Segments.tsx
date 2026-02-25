import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Heart, Star, AlertTriangle, Moon, UserX, UserPlus } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { useTranslation } from '../i18n';
import { formatCurrency } from '../lib/utils';
import api from '../services/api';

interface SegmentSummary {
  segment: string;
  count: number;
  total_revenue: number;
  avg_frequency: number;
}

interface CustomerRFM {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  recency_days: number;
  frequency: number;
  monetary: number;
  segment: string;
  loyalty_points: number;
}

const segmentIcons: Record<string, React.ReactNode> = {
  champions: <Crown className="h-5 w-5 text-yellow-500" />,
  loyal: <Heart className="h-5 w-5 text-pink-500" />,
  potential: <Star className="h-5 w-5 text-blue-500" />,
  at_risk: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  hibernating: <Moon className="h-5 w-5 text-purple-500" />,
  lost: <UserX className="h-5 w-5 text-red-500" />,
  new: <UserPlus className="h-5 w-5 text-emerald-500" />,
};

const segmentColors: Record<string, string> = {
  champions: 'bg-yellow-500/10 border-yellow-500/30',
  loyal: 'bg-pink-500/10 border-pink-500/30',
  potential: 'bg-blue-500/10 border-blue-500/30',
  at_risk: 'bg-orange-500/10 border-orange-500/30',
  hibernating: 'bg-purple-500/10 border-purple-500/30',
  lost: 'bg-red-500/10 border-red-500/30',
  new: 'bg-emerald-500/10 border-emerald-500/30',
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

  const { data, isLoading } = useQuery<{ customers: CustomerRFM[]; summary: SegmentSummary[] }>({
    queryKey: ['segments'],
    queryFn: () => api.get('/api/segments').then((r) => r.data.data),
  });

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const filteredCustomers = selectedSegment
    ? data?.customers.filter((c) => c.segment === selectedSegment)
    : data?.customers;

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('segments.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      {/* Segment cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {data?.summary.map((seg) => (
          <button
            key={seg.segment}
            onClick={() => setSelectedSegment(selectedSegment === seg.segment ? null : seg.segment)}
            className={`p-3 rounded-md border text-start transition-all ${
              segmentColors[seg.segment] || 'bg-surface border-border'
            } ${selectedSegment === seg.segment ? 'ring-2 ring-gold' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {segmentIcons[seg.segment]}
              <span className="text-xs font-medium">{t(segmentKeys[seg.segment] as never)}</span>
            </div>
            <p className="text-xl font-data font-bold">{seg.count}</p>
            <p className="text-[10px] text-muted font-data">{formatCurrency(seg.total_revenue)}</p>
          </button>
        ))}
      </div>

      {/* Customer table */}
      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-start p-3 font-medium text-muted">{t('common.name')}</th>
              <th className="text-start p-3 font-medium text-muted">{t('segments.segment')}</th>
              <th className="text-end p-3 font-medium text-muted">{t('segments.recency')}</th>
              <th className="text-end p-3 font-medium text-muted">{t('segments.frequency')}</th>
              <th className="text-end p-3 font-medium text-muted">{t('segments.monetary')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted">
                  {t('common.loading')}
                </td>
              </tr>
            ) : !filteredCustomers?.length ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted">
                  {t('common.noResults')}
                </td>
              </tr>
            ) : (
              filteredCustomers.slice(0, 100).map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-surface/50">
                  <td className="p-3">
                    <div>
                      <span className="font-medium">{c.name}</span>
                      {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="gold" className="text-[10px]">
                      {t(segmentKeys[c.segment] as never)}
                    </Badge>
                  </td>
                  <td className="p-3 text-end font-data">
                    {c.recency_days >= 999 ? '—' : `${c.recency_days}d`}
                  </td>
                  <td className="p-3 text-end font-data">{c.frequency}</td>
                  <td className="p-3 text-end font-data">{formatCurrency(c.monetary)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
