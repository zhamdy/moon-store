import { useState, useEffect, useCallback, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Package, ShoppingCart, Truck, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { useTranslation } from '../shared/i18n/index';
import { cn } from '../shared/lib/utils';
import { resource } from '../shared/lib/resource';
import { useTransport } from '../shared/lib/transport/index';

interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  read: number;
  created_at: string;
}

/** Only the per-notification read action hangs off a record, so no row surfaces. */
const notifications = resource<Notification>('notifications');

function timeAgo(
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t('notifications.justNow');
  if (diffMin < 60) return t('notifications.minutesAgo', { count: diffMin });
  if (diffHr < 24) return t('notifications.hoursAgo', { count: diffHr });
  return t('notifications.daysAgo', { count: diffDay });
}

function typeIcon(type: string) {
  switch (type) {
    case 'low_stock':
      return <Package className="h-4 w-4 text-amber-500" />;
    case 'new_sale':
      return <ShoppingCart className="h-4 w-4 text-green-500" />;
    case 'delivery_overdue':
      return <Truck className="h-4 w-4 text-red-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted" />;
  }
}

export default function NotificationCenter(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const [animateParent] = useAutoAnimate();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const transport = useTransport();

  // Both reads poll: the badge has to notice a new notification without the
  // reader navigating, and the open panel has to keep up with it. Polling is
  // the whole point of these two, and `useApiQuery` deliberately carries no
  // `refetchInterval`, so they stay on the transport with a query of their own
  // rather than widening it for a case only this component has.
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () =>
      (
        await transport.request<{ count: number }>({
          method: 'GET',
          path: 'notifications/unread-count',
        })
      ).data,
    refetchInterval: 30000,
  });

  const { data: notificationList } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () =>
      (
        await transport.request<Notification[]>({
          method: 'GET',
          path: 'notifications',
          params: { page: 1, pageSize: 25 },
        })
      ).data,
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });

  // `useAction` refreshes ['notifications'] itself; the badge's count lives
  // under a key of its own, so that one is still invalidated by hand.
  const markReadMutation = notifications.useAction('read', {
    method: 'PUT',
    onDone: () => queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
  });

  // Marking everything read acts on the collection rather than on one
  // notification, which `resource` has no shape for.
  const markAllReadMutation = useMutation({
    mutationFn: () => transport.request({ method: 'PUT', path: 'notifications/read-all' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
    onError: (error: Error) => toast.error(error.message || t('common.error')),
  });

  const unreadCount = unreadData?.count || 0;

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    },
    [open]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markReadMutation.run({ id: notif.id });
    }
    if (notif.link) {
      try {
        navigate({ to: notif.link as never });
      } catch {
        navigate({ to: '/' });
      }
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-9 w-9 rounded-md text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
        aria-label={t('notifications.title')}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">{t('notifications.title')}</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface"
                  title={t('notifications.markAllRead')}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t('notifications.markAllRead')}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground transition-colors p-1 rounded hover:bg-surface"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div ref={animateParent} className="max-h-96 overflow-y-auto">
            {!notificationList || notificationList.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                {t('notifications.noNotifications')}
              </div>
            ) : (
              notificationList.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'w-full text-start px-4 py-3 border-b border-border/50 hover:bg-surface transition-colors flex gap-3',
                    !notif.read && 'bg-gold/5'
                  )}
                >
                  <div className="mt-0.5 shrink-0">{typeIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'text-sm truncate',
                          !notif.read ? 'font-semibold text-foreground' : 'text-muted'
                        )}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && <span className="h-2 w-2 rounded-full bg-gold shrink-0" />}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-muted truncate mt-0.5">{notif.message}</p>
                    )}
                    <p className="text-[10px] text-muted/60 mt-1">{timeAgo(notif.created_at, t)}</p>
                  </div>
                  {!notif.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.run({ id: notif.id });
                      }}
                      className="shrink-0 mt-0.5 p-1 text-muted hover:text-foreground rounded hover:bg-background transition-colors"
                      title="Mark as read"
                      aria-label={t('notifications.markAllRead')}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
