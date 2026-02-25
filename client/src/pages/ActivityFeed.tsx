import { useQuery } from '@tanstack/react-query';
import { Activity, User, ShoppingCart, Package, Truck, Settings } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { useTranslation } from '../i18n';
import api from '../services/api';

interface AuditEntry {
  id: number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

const entityIcons: Record<string, React.ReactNode> = {
  sale: <ShoppingCart className="h-4 w-4 text-emerald-500" />,
  product: <Package className="h-4 w-4 text-blue-500" />,
  delivery: <Truck className="h-4 w-4 text-orange-500" />,
  user: <User className="h-4 w-4 text-purple-500" />,
  setting: <Settings className="h-4 w-4 text-gray-500" />,
};

export default function ActivityFeedPage() {
  const { t } = useTranslation();

  const { data: entries } = useQuery<AuditEntry[]>({
    queryKey: ['activity-feed'],
    queryFn: () => api.get('/api/v1/audit-log?limit=50').then((r) => r.data.data),
  });

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('activity.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      <div className="max-w-2xl mx-auto space-y-2">
        {!entries?.length ? (
          <div className="text-center py-16">
            <Activity className="h-12 w-12 text-gold/40 mx-auto mb-3" />
            <p className="text-muted">{t('activity.noActivity')}</p>
          </div>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:border-gold/30 transition-colors"
            >
              <div className="mt-1">
                {entityIcons[e.entity_type] || <Activity className="h-4 w-4 text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{e.user_name}</span>
                  <Badge variant="gold" className="text-[10px]">
                    {e.action}
                  </Badge>
                  <span className="text-xs text-muted">
                    {e.entity_type} #{e.entity_id}
                  </span>
                </div>
                {e.details && <p className="text-xs text-muted mt-0.5 truncate">{e.details}</p>}
              </div>
              <span className="text-xs text-muted font-data whitespace-nowrap">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
