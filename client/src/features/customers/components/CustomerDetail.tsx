import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Calendar,
  Star,
  Plus,
  Minus,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
} from '@heroui/react';
import { Badge } from '../../../shared';
import { formatCurrency, formatDateTime, formatRelative } from '../../../shared/lib/utils';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { resource } from '../../../shared/lib/resource';
import { useTranslation } from '../../../shared/i18n/index';
import type { AppSettings } from '../../../shared/types/index';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

/** Reached only for reads hanging off one customer and the points adjustment. */
const customers = resource<{ id: number }>('customers');

interface CustomerDetailProps {
  customerId: number;
  customerName: string;
  onBack: () => void;
}

interface CustomerStats {
  total_spent: number;
  order_count: number;
  avg_order: number;
  last_purchase: string | null;
}

interface CustomerSale {
  id: number;
  total: number;
  payment_method: string;
  cashier_name: string;
  items_count: number;
  created_at: string;
}

interface LoyaltyTransaction {
  id: number;
  customer_id: number;
  sale_id: number | null;
  points: number;
  type: 'earned' | 'redeemed' | 'adjustment' | 'refund_deduct';
  note: string | null;
  created_at: string;
}

interface LoyaltyData {
  points: number;
  transactions: LoyaltyTransaction[];
}

export default function CustomerDetail({ customerId, customerName, onBack }: CustomerDetailProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');
  const [salesPage, setSalesPage] = useState(1);

  const { data: appSettings } = useApiQuery<AppSettings>(['settings'], 'settings', undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const loyaltyEnabled = appSettings?.loyalty_enabled === 'true';

  const { data: stats } = customers.useRead<CustomerStats>(`${customerId}/stats`);

  const {
    data: sales = [],
    meta: salesMeta,
    isLoading,
  } = customers.useRead<CustomerSale[]>(`${customerId}/sales`, { page: salesPage, pageSize: 25 });
  const salesPagination = salesMeta?.pagination as PaginationMeta | undefined;

  const { data: loyaltyData } = useApiQuery<LoyaltyData>(
    ['customer-loyalty', customerId],
    `customers/${customerId}/loyalty`,
    undefined,
    { enabled: loyaltyEnabled }
  );

  const adjustMutation = customers.useAction('loyalty/adjust', {
    message: t('loyalty.adjustSuccess'),
    fallbackMessage: t('loyalty.adjustFailed'),
    onDone: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', customerId] });
      setAdjustDialogOpen(false);
      setAdjustPoints(0);
      setAdjustNote('');
    },
  });

  const typeLabel = (type: string) => {
    switch (type) {
      case 'earned':
        return t('loyalty.earned');
      case 'redeemed':
        return t('loyalty.redeemed');
      case 'adjustment':
        return t('loyalty.adjustment');
      case 'refund_deduct':
        return t('loyalty.refundDeduct');
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" size="sm" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{customerName}</h2>
          <p className="text-sm text-muted-foreground">{t('customers.purchaseHistory')}</p>
        </div>
        {loyaltyEnabled && loyaltyData && (
          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {t('loyalty.points')}
              </p>
              <p className="text-lg font-bold text-foreground font-data flex items-center gap-1 justify-end">
                <Star className="h-4 w-4 text-warning fill-warning" />
                {loyaltyData.points}
              </p>
            </div>
            <Button variant="bordered" size="sm" onClick={() => setAdjustDialogOpen(true)}>
              {t('loyalty.adjustPoints')}
            </Button>
          </div>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4 flex flex-row items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent text-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {t('customers.totalSpent')}
                </p>
                <p className="text-lg font-bold text-foreground font-data mt-0.5">
                  {formatCurrency(stats.total_spent)}
                </p>
              </div>
            </CardBody>
          </Card>
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4 flex flex-row items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent text-foreground">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {t('customers.orderCount')}
                </p>
                <p className="text-lg font-bold font-data mt-0.5">{stats.order_count}</p>
              </div>
            </CardBody>
          </Card>
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4 flex flex-row items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent text-foreground">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {t('customers.avgOrder')}
                </p>
                <p className="text-lg font-bold font-data mt-0.5">
                  {formatCurrency(stats.avg_order)}
                </p>
              </div>
            </CardBody>
          </Card>
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4 flex flex-row items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent text-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {t('customers.lastPurchase')}
                </p>
                <p className="text-sm font-medium font-data mt-0.5">
                  {stats.last_purchase ? formatRelative(stats.last_purchase) : '-'}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Loyalty Points History */}
      {loyaltyEnabled && loyaltyData && loyaltyData.transactions.length > 0 && (
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Star className="h-4 w-4 text-warning fill-warning" />
              {t('loyalty.history')}
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('sales.dateTime')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('loyalty.points')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('customers.notes')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loyaltyData.transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-data">{formatDateTime(txn.created_at)}</td>
                      <td className="px-4 py-3">
                        <Badge size="sm" variant={txn.points > 0 ? 'primary' : 'danger'}>
                          {typeLabel(txn.type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-data font-semibold">
                        <span className={txn.points > 0 ? 'text-success' : 'text-danger'}>
                          {txn.points > 0 ? '+' : ''}
                          {txn.points}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{txn.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sales list */}
      <Card className="border border-border bg-card shadow-sm">
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('customers.noPurchases')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('sales.saleId')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('sales.dateTime')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('sales.items')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('sales.total')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider">
                      {t('sales.payment')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-data text-primary font-medium">#{sale.id}</td>
                      <td className="px-4 py-3 font-data">{formatDateTime(sale.created_at)}</td>
                      <td className="px-4 py-3 font-data">{sale.items_count}</td>
                      <td className="px-4 py-3 font-semibold font-data">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          size="sm"
                          variant={
                            sale.payment_method === 'Cash'
                              ? 'success'
                              : sale.payment_method === 'Card'
                                ? 'primary'
                                : 'default'
                          }
                        >
                          {{
                            Cash: t('cart.cash'),
                            Card: t('cart.card'),
                            Other: t('cart.other'),
                            'Gift Card': t('cart.giftCard'),
                          }[sale.payment_method] || sale.payment_method}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {salesPagination && salesPagination.totalPages > 1 && (
            <div className="flex justify-center border-t border-border p-3">
              <Pagination
                page={salesPage}
                total={salesPagination.totalPages}
                onChange={setSalesPage}
                showControls
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Adjust Points Dialog */}
      <Modal
        isOpen={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('loyalty.adjustPoints')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('loyalty.adjustDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">{t('loyalty.points')}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      variant="bordered"
                      size="sm"
                      onClick={() => setAdjustPoints((p) => p - 10)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      size="sm"
                      variant="bordered"
                      value={String(adjustPoints)}
                      onValueChange={(val) => setAdjustPoints(parseInt(val) || 0)}
                      className="w-32 text-center font-data"
                    />
                    <Button
                      isIconOnly
                      variant="bordered"
                      size="sm"
                      onClick={() => setAdjustPoints((p) => p + 10)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {adjustPoints > 0 ? `+${adjustPoints}` : adjustPoints} points
                  </p>
                </div>
                <Textarea
                  label={t('loyalty.adjustNote')}
                  size="sm"
                  variant="bordered"
                  value={adjustNote}
                  onValueChange={setAdjustNote}
                  placeholder={t('loyalty.adjustNote')}
                  isRequired
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setAdjustDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onClick={() =>
                    adjustMutation.run({
                      id: customerId,
                      body: { points: adjustPoints, note: adjustNote },
                    })
                  }
                  disabled={adjustPoints === 0 || !adjustNote}
                  isLoading={adjustMutation.isRunning}
                >
                  {t('common.confirm')}
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
