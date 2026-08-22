import { useState, Fragment } from 'react';
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
  X,
  type LucideIcon,
} from 'lucide-react';
import { Input, Select, SelectItem, Button, Pagination } from '@heroui/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge, type BadgeVariant, PageHeader } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import type { PaginationMeta } from '../../../shared/lib/transport';
import type { User as UserRecord } from '../../../shared/types/index';
import type { AuditEntry } from '../types';

/** Pagination figures the audit-log list carries beside its rows. */
interface AuditMeta {
  pagination: PaginationMeta;
}

const auditLog = resource<AuditEntry, AuditMeta>('audit-log');

const ACTION_CONFIG: Record<
  string,
  {
    color: 'success' | 'primary' | 'danger' | 'warning' | 'secondary' | 'default';
    icon: LucideIcon;
  }
> = {
  create: { color: 'success', icon: Plus },
  update: { color: 'primary', icon: Pencil },
  delete: { color: 'danger', icon: Trash2 },
  login: { color: 'primary', icon: LogIn },
  refund: { color: 'warning', icon: RotateCcw },
  exchange: { color: 'secondary', icon: ArrowLeftRight },
  cancel: { color: 'danger', icon: Ban },
  approve: { color: 'success', icon: CheckCircle },
  register_open: { color: 'warning', icon: Vault },
  register_close: { color: 'default', icon: Vault },
  register_force_close: { color: 'danger', icon: Vault },
  status_change: { color: 'primary', icon: RefreshCw },
  discontinue: { color: 'danger', icon: Ban },
  redeem: { color: 'success', icon: Gift },
  batch_barcode: { color: 'primary', icon: Barcode },
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
  const transport = useTransport();

  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const tAction = (action: string) => t(`activity.action.${action}`) || action;
  const tEntity = (entity: string) => t(`activity.entity.${entity}`) || entity;

  const {
    data: entries = [],
    isLoading,
    meta,
  } = auditLog.useList({
    page,
    pageSize: 50,
    action: actionFilter === 'all' ? undefined : actionFilter,
    entityType: entityFilter === 'all' ? undefined : entityFilter,
    userId: userFilter === 'all' ? undefined : userFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: debouncedSearch || undefined,
  });

  const { data: actions = [] } = auditLog.useRead<string[]>('actions');
  const { data: entityTypes = [] } = auditLog.useRead<string[]>('entity-types');
  const usersQuery = useInfiniteQuery({
    queryKey: ['users', 'audit-filter'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      transport.request<Pick<UserRecord, 'id' | 'name'>[]>({
        method: 'GET',
        path: 'users',
        params: { page: pageParam, pageSize: 25, sortBy: 'name', sortOrder: 'asc' },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta?.pagination?.hasNextPage ? lastPage.meta.pagination.page + 1 : undefined,
  });
  const users = usersQuery.data?.pages.flatMap((response) => response.data) ?? [];

  const totalPages = meta?.pagination.totalPages ?? 0;

  const getActionConfig = (action: string) =>
    ACTION_CONFIG[action] || { color: 'default' as const, icon: Activity };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('audit.title')} />

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap bg-card p-4 rounded-lg border border-border">
        <div className="w-40">
          <Select
            label={t('audit.action')}
            size="sm"
            variant="bordered"
            selectedKeys={[actionFilter]}
            onChange={(e) => {
              setActionFilter(e.target.value || 'all');
              setPage(1);
            }}
          >
            {[
              <SelectItem key="all" textValue={t('audit.allActions')}>
                {t('audit.allActions')}
              </SelectItem>,
              ...actions.map((a) => (
                <SelectItem key={a} textValue={tAction(a)}>
                  {tAction(a)}
                </SelectItem>
              )),
            ]}
          </Select>
        </div>

        <div className="w-40">
          <Select
            label={t('audit.entityType')}
            size="sm"
            variant="bordered"
            selectedKeys={[entityFilter]}
            onChange={(e) => {
              setEntityFilter(e.target.value || 'all');
              setPage(1);
            }}
          >
            {[
              <SelectItem key="all" textValue={t('audit.allEntities')}>
                {t('audit.allEntities')}
              </SelectItem>,
              ...entityTypes.map((e) => (
                <SelectItem key={e} textValue={tEntity(e)}>
                  {tEntity(e)}
                </SelectItem>
              )),
            ]}
          </Select>
        </div>

        <div className="w-40">
          <Select
            label={t('audit.user')}
            size="sm"
            variant="bordered"
            selectedKeys={[userFilter]}
            onChange={(e) => {
              setUserFilter(e.target.value || 'all');
              setPage(1);
            }}
          >
            {[
              <SelectItem key="all" textValue={t('audit.allUsers')}>
                {t('audit.allUsers')}
              </SelectItem>,
              ...users.map((u) => (
                <SelectItem key={String(u.id)} textValue={u.name}>
                  {u.name}
                </SelectItem>
              )),
            ]}
          </Select>
          {usersQuery.hasNextPage && (
            <Button
              fullWidth
              size="sm"
              variant="light"
              isLoading={usersQuery.isFetchingNextPage}
              onPress={() => void usersQuery.fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </div>

        <div className="w-36">
          <Input
            type="date"
            label={t('audit.dateFrom')}
            size="sm"
            variant="bordered"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-36">
          <Input
            type="date"
            label={t('audit.dateTo')}
            size="sm"
            variant="bordered"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-48">
          <Input
            label={t('common.search')}
            placeholder={t('common.search')}
            size="sm"
            variant="bordered"
            value={search}
            onValueChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            isClearable
            onClear={() => {
              setSearch('');
              setPage(1);
            }}
          />
        </div>

        {(actionFilter !== 'all' ||
          entityFilter !== 'all' ||
          userFilter !== 'all' ||
          dateFrom ||
          dateTo ||
          search) && (
          <Button
            size="sm"
            variant="flat"
            onClick={() => {
              setActionFilter('all');
              setEntityFilter('all');
              setUserFilter('all');
              setDateFrom('');
              setDateTo('');
              setSearch('');
              setPage(1);
            }}
            startContent={<X className="h-3.5 w-3.5" />}
            className="self-end"
          >
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      {/* Log entries */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">{t('audit.noEntries')}</div>
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
                className="border border-border rounded-lg bg-card transition-colors hover:border-border/80"
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-start"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <EntityIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Badge size="sm" variant={config.color as BadgeVariant} className="shrink-0">
                    {tAction(entry.action)}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-data">
                    {tEntity(entry.entity_type)}
                  </span>
                  {entry.entity_id && (
                    <span className="text-xs text-muted-foreground font-data">
                      #{entry.entity_id}
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground flex-1 truncate">
                    {entry.user_name || entry.user_display_name || t('audit.system')}
                  </span>
                  <span className="text-xs text-muted-foreground font-data shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  {hasDetails &&
                    (isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    ))}
                </button>
                {isExpanded && hasDetails && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 mt-3">
                      {details.map((d) => (
                        <Fragment key={d.key}>
                          <span className="text-xs text-muted-foreground">{d.label}</span>
                          <span className="text-xs font-data text-foreground font-medium">
                            {d.value}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                    {entry.ip_address && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">
                          {t('audit.ipAddress')}
                        </span>
                        <span className="text-xs font-data text-foreground">
                          {entry.ip_address}
                        </span>
                      </div>
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
        <div className="flex items-center justify-center pt-4">
          <Pagination total={totalPages} page={page} onChange={setPage} size="sm" variant="flat" />
        </div>
      )}
    </div>
  );
}
