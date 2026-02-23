import { Badge } from './ui/badge';

const statusStyles = {
  Pending: 'warning',
  Preparing: 'info',
  'Out for Delivery': 'gold',
  Delivered: 'success',
  Cancelled: 'destructive',
};

export default function StatusBadge({ status }) {
  return (
    <Badge variant={statusStyles[status] || 'secondary'}>
      {status}
    </Badge>
  );
}
