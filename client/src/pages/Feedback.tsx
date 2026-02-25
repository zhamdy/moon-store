import { useQuery } from '@tanstack/react-query';
import { Star, TrendingUp, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useTranslation } from '../i18n';
import api from '../services/api';

interface FeedbackEntry {
  id: number;
  sale_id: number | null;
  customer_name: string | null;
  rating: number | null;
  nps_score: number | null;
  comment: string | null;
  created_at: string;
}
interface FeedbackStats {
  avg_rating: number | null;
  total_responses: number;
  nps_score: number | null;
}

export default function FeedbackPage() {
  const { t } = useTranslation();

  const { data } = useQuery<{ feedback: FeedbackEntry[]; stats: FeedbackStats }>({
    queryKey: ['feedback'],
    queryFn: () => api.get('/api/feedback').then((r) => r.data.data),
  });

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('feedback.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">
                {t('feedback.avgRating')}
              </span>
              <Star className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-data font-bold">
              {data?.stats.avg_rating?.toFixed(1) || '—'} / 5
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">
                {t('feedback.npsScore')}
              </span>
              <TrendingUp className="h-4 w-4 text-gold" />
            </div>
            <p className="text-2xl font-data font-bold">{data?.stats.nps_score ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">
                {t('feedback.totalResponses')}
              </span>
              <MessageSquare className="h-4 w-4 text-gold" />
            </div>
            <p className="text-2xl font-data font-bold">{data?.stats.total_responses || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {!data?.feedback.length ? (
          <p className="text-center py-12 text-muted">{t('common.noResults')}</p>
        ) : (
          data.feedback.map((f) => (
            <div key={f.id} className="p-4 rounded-md border border-border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {f.customer_name && (
                    <span className="font-medium text-sm">{f.customer_name}</span>
                  )}
                  {f.rating && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s <= f.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`}
                        />
                      ))}
                    </div>
                  )}
                  {f.nps_score !== null && (
                    <Badge variant="gold" className="text-[10px]">
                      NPS: {f.nps_score}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted font-data">
                  {new Date(f.created_at).toLocaleDateString()}
                </span>
              </div>
              {f.comment && <p className="text-sm text-muted">{f.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
