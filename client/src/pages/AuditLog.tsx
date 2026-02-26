import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LogIn,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Package,
  Truck,
  User,
  Settings,
  Receipt,
  Vault,
  Ticket,
  Gift,
  PackageCheck,
  CalendarClock,
  ArrowLeftRight,
  Ban,
  CheckCircle,
  RefreshCw,
  Barcode,
  Activity,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { LucideIcon } from 'lucide-react';

interface AuditEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_display_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string;
  ip_address: string | null;
  created_at: string;
}

interface UserEntry {
  id: number;
  name: string;
}

const ACTION_CONFIG: Record<string, { color: string; icon: LucideIcon }> = {
  create: { color: 'text-emerald-400', icon: Plus },
  update: { color: 'text-blue-400', icon: Pencil },
  delete: { color: 'text-destructive', icon: Trash2 },
  login: { color: 'text-gold', icon: LogIn },
  refund: { color: 'text-amber-400', icon: RotateCcw },
  exchange: { color: 'text-purple-400', icon: ArrowLeftRight },
  cancel: { color: 'text-destructive', icon: Ban },
  approve: { color: 'text-emerald-400', icon: CheckCircle },
  register_open: { color: 'text-amber-400', icon: Vault },
  register_close: { color: 'text-muted', icon: Vault },
  register_force_close: { color: 'text-destructive', icon: Vault },
  status_change: { color: 'text-blue-400', icon: RefreshCw },
  discontinue: { color: 'text-destructive', icon: Ban },
  redeem: { color: 'text-teal-400', icon: Gift },
  batch_barcode: { color: 'text-cyan-400', icon: Barcode },
};

const ENTITY_ICONS: Record<string, LucideIcon> = {
  sale: ShoppingCart,
  product: Package,
  delivery: Truck,
  user: User,
  setting: Settings,
  auth: LogIn,
  expense: Receipt,
  register_session: Vault,
  coupon: Ticket,
  gift_card: Gift,
  stock_count: PackageCheck,
  layaway: CalendarClock,
};

/** Translation key map for detail fields */
const DETAIL_KEY_MAP: Record<string, string> = {
  total: 'activity.detail.total',
  deposit: 'activity.detail.deposit',
  name: 'activity.detail.name',
  email: 'activity.detail.email',
  role: 'activity.detail.role',
  status: 'activity.detail.status',
  field: 'activity.detail.field',
  old: 'activity.detail.old',
  new: 'activity.detail.new',
  amount: 'activity.detail.amount',
  category: 'activity.detail.category',
  refund_amount: 'activity.detail.refundAmount',
  opening_float: 'activity.detail.openingFloat',
  counted_cash: 'activity.detail.countedCash',
  variance: 'activity.detail.variance',
  code: 'activity.detail.code',
  count: 'activity.detail.count',
  balance: 'activity.detail.balance',
};

function parseDetails(
  details: string,
  t: (key: string) => string
): { key: string; label: string; value: string }[] {
  try {
    const obj = JSON.parse(details);
    if (typeof obj !== 'object' || obj === null) return [];
    return Object.entries(obj).map(([k, v]) => ({
      key: k,
      label: DETAIL_KEY_MAP[k] ? t(DETAIL_KEY_MAP[k]) : k,
      value: String(v),
    }));
  } catch {
    return [];
  }
}

export default function AuditLog() {
  const { t } = useTranslation();

  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const tAction = (action: string) => t(`activity.action.${action}`) || action;
  const tEntity = (entity: string) => t(`activity.entity.${entity}`) || entity;

  const { data, isLoading } = useQuery<{ data: AuditEntry[]; meta: { total: number } }>({
    queryKey: [
      'audit-log',
      { page, actionFilter, entityFilter, userFilter, dateFrom, dateTo, search },
    ],
    queryFn: () =>
      api
        .get('/api/v1/audit-log', {
          params: {
            page,
            limit: 50,
            action: actionFilter === 'all' ? undefined : actionFilter,
            entity_type: entityFilter === 'all' ? undefined : entityFilter,
            user_id: userFilter === 'all' ? undefined : userFilter,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            search: search || undefined,
          },
        })
        .then((r) => ({ data: r.data.data, meta: r.data.meta })),
  });

  const { data: actions } = useQuery<string[]>({
    queryKey: ['audit-actions'],
    queryFn: () => api.get('/api/v1/audit-log/actions').then((r) => r.data.data),
  });

  const { data: entityTypes } = useQuery<string[]>({
    queryKey: ['audit-entity-types'],
    queryFn: () => api.get('/api/v1/audit-log/entity-types').then((r) => r.data.data),
  });

  const { data: users } = useQuery<UserEntry[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/api/v1/users').then((r) => r.data.data),
  });

  const entries = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  const getActionConfig = (action: string) =>
    ACTION_CONFIG[action] || { color: 'text-muted', icon: Activity };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display tracking-wider text-foreground">{t('audit.title')}</h1>
        <div className="gold-divider mt-2" />
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted">{t('audit.action')}</Label>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allActions')}</SelectItem>
              {actions?.map((a) => (
                <SelectItem key={a} value={a}>
                  {tAction(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted">{t('audit.entityType')}</Label>
          <Select
            value={entityFilter}
            onValueChange={(v) => {
              setEntityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allEntities')}</SelectItem>
              {entityTypes?.map((e) => (
                <SelectItem key={e} value={e}>
                  {tEntity(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted">{t('audit.user')}</Label>
          <Select
            value={userFilter}
            onValueChange={(v) => {
              setUserFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allUsers')}</SelectItem>
              {users?.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted">{t('audit.dateFrom')}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-36"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted">{t('audit.dateTo')}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-36"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted">{t('common.search')}</Label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('common.search')}
            className="w-48"
          />
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-1">
        {isLoading ? (
          <div className="text-center py-8 text-muted">{t('common.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted">{t('audit.noEntries')}</div>
        ) : (
          entries.map((entry) => {
            const config = getActionConfig(entry.action);
            const EntityIcon = ENTITY_ICONS[entry.entity_type] || Activity;
            const details = parseDetails(entry.details, t);
            const hasDetails = details.length > 0;
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className="border border-border rounded-md transition-colors hover:border-border/80"
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-start"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <EntityIcon className="h-4 w-4 shrink-0 text-gold/70" />
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${config.color}`}>
                    {tAction(entry.action)}
                  </Badge>
                  <Badge variant="gold" className="text-[10px] shrink-0">
                    {tEntity(entry.entity_type)}
                  </Badge>
                  {entry.entity_id && (
                    <span className="text-xs text-muted font-data">#{entry.entity_id}</span>
                  )}
                  <span className="text-sm text-foreground flex-1 truncate">
                    {entry.user_name || entry.user_display_name || 'System'}
                  </span>
                  <span className="text-xs text-muted font-data shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  {hasDetails &&
                    (isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                    ))}
                </button>
                {isExpanded && hasDetails && (
                  <div className="px-4 pb-3 border-t border-border/50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {details.map((d) => (
                        <span key={d.key} className="text-xs text-muted">
                          <span className="text-muted/70">{d.label}:</span>{' '}
                          <span className="font-data text-foreground">{d.value}</span>
                        </span>
                      ))}
                    </div>
                    {entry.ip_address && (
                      <p className="text-xs text-muted mt-1.5">
                        {t('audit.ipAddress')}:{' '}
                        <span className="font-data">{entry.ip_address}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded text-sm border border-border disabled:opacity-50 hover:border-gold/50"
          >
            &laquo;
          </button>
          <span className="text-sm text-muted font-data">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded text-sm border border-border disabled:opacity-50 hover:border-gold/50"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
