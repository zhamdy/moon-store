import { Star, TrendingUp, MessageSquare } from 'lucide-react';
import { Card, CardBody } from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import type { FeedbackResponse } from '../types';

export default function FeedbackPage() {
  const { t } = useTranslation();

  const { data } = useApiQuery<FeedbackResponse>(['feedback'], 'feedback');

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('feedback.title')} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border bg-card shadow-sm">
          <CardBody className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {t('feedback.avgRating')}
              </span>
              <Star className="h-4 w-4 text-warning fill-warning" />
            </div>
            <p className="text-2xl font-data font-bold text-foreground">
              {data?.stats.avg_rating?.toFixed(1) || '—'} / 5
            </p>
          </CardBody>
        </Card>
        <Card className="border border-border bg-card shadow-sm">
          <CardBody className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {t('feedback.npsScore')}
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-data font-bold text-foreground">
              {data?.stats.nps_score ?? '—'}
            </p>
          </CardBody>
        </Card>
        <Card className="border border-border bg-card shadow-sm">
          <CardBody className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {t('feedback.totalResponses')}
              </span>
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-data font-bold text-foreground">
              {data?.stats.total_responses || 0}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {!data?.feedback.length ? (
          <p className="text-center py-12 text-muted-foreground text-sm">{t('common.noResults')}</p>
        ) : (
          data.feedback.map((f) => (
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
    </div>
  );
}
