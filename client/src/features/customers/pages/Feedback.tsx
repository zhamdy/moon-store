import { Star, TrendingUp, MessageSquare } from 'lucide-react';
import { Pagination } from '@heroui/react';
import { Badge, PageHeader, StatCard } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import type { FeedbackEntry, FeedbackStats } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

const feedback = resource<FeedbackEntry, { stats: FeedbackStats }>('feedback');

export default function FeedbackPage() {
  const { t } = useTranslation();
  const { page, pageSize, update } = useListRouteState();

  const { data = [], meta, isLoading } = feedback.useList({ page, pageSize });
  const stats = meta?.stats;
  const pagination = meta?.pagination as PaginationMeta | undefined;

  useLastPageRecovery(page, pagination?.total, pagination?.totalPages, update);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('feedback.title')} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={t('feedback.avgRating')}
          value={`${stats?.avg_rating?.toFixed(1) || '—'} / 5`}
          icon={Star}
          isLoading={isLoading}
        />
        <StatCard
          title={t('feedback.npsScore')}
          value={stats?.nps_score ?? '—'}
          icon={TrendingUp}
          isLoading={isLoading}
        />
        <StatCard
          title={t('feedback.totalResponses')}
          value={stats?.total_responses || 0}
          icon={MessageSquare}
          isLoading={isLoading}
        />
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {!data.length ? (
          <p className="text-center py-12 text-muted-foreground text-sm">{t('common.noResults')}</p>
        ) : (
          data.map((f) => (
            <div key={f.id} className="p-4 rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {f.customer_name && (
                    <span className="font-semibold text-sm text-foreground">{f.customer_name}</span>
                  )}
                  {f.rating && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s <= f.rating! ? 'text-warning fill-warning' : 'text-muted-foreground/30'}`}
                        />
                      ))}
                    </div>
                  )}
                  {f.nps_score !== null && (
                    <Badge size="sm" variant="primary">
                      NPS: {f.nps_score}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-data">
                  {new Date(f.created_at).toLocaleDateString()}
                </span>
              </div>
              {f.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed">{f.comment}</p>
              )}
            </div>
          ))
        )}
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            page={page}
            total={pagination.totalPages}
            onChange={(newPage) => update({ page: newPage })}
            showControls
          />
        </div>
      )}
    </div>
  );
}
