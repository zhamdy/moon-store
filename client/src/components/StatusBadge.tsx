import { Badge } from './ui/badge';

type DeliveryStatus = 'Pending' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

type BadgeVariant = 'warning' | 'info' | 'gold' | 'success' | 'destructive' | 'secondary';

const statusStyles: Record<DeliveryStatus, BadgeVariant> = {
  Pending: 'warning',
  Preparing: 'info',
  'Out for Delivery': 'gold',
  Delivered: 'success',
  Cancelled: 'destructive',
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={statusStyles[status as DeliveryStatus] || 'secondary'}>{status}</Badge>;
}
