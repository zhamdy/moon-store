import { Badge } from './ui/badge';

type DeliveryStatus =
  | 'Order Received'
  | 'Shipping Contacted'
  | 'In Transit'
  | 'Delivered'
  | 'Cancelled';

type BadgeVariant = 'warning' | 'info' | 'gold' | 'success' | 'destructive' | 'secondary';

const statusStyles: Record<DeliveryStatus, BadgeVariant> = {
  'Order Received': 'warning',
  'Shipping Contacted': 'info',
  'In Transit': 'gold',
  Delivered: 'success',
  Cancelled: 'destructive',
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={statusStyles[status as DeliveryStatus] || 'secondary'}>{status}</Badge>;
}
