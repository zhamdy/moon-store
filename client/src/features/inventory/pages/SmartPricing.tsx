import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Zap, Check, X, RefreshCw, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../shared/lib/utils';
import {
  Button,
  Input,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from '@heroui/react';
import { Badge, PageHeader, DataTable } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import type { PriceSuggestion, PricingRule } from '../types';

const priceSuggestions = resource<PriceSuggestion>('ai/pricing/suggestions');
const pricingRules = resource<PricingRule>('ai/pricing/rules');

export default function SmartPricingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const transport = useTransport();
  const [tab, setTab] = useState<'suggestions' | 'rules'>('suggestions');
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    rule_type: 'demand_based',
    config: '{}',
    priority: 0,
    applies_to: 'all',
  });

  const { data: suggestions, isLoading } = priceSuggestions.useList();
  const { data: rules } = useApiQuery<PricingRule[]>(
    ['pricing-rules'],
    'ai/pricing/rules',
    undefined,
    { enabled: tab === 'rules' }
  );

  const generate = useMutation({
    mutationFn: () =>
      transport.request<PriceSuggestion[]>({ method: 'POST', path: 'ai/pricing/generate' }),
    onSuccess: ({ data }) => {
      toast.success(`${data.length} ${t('smartPricing.suggestionsGenerated')}`);
      qc.invalidateQueries({ queryKey: ['ai/pricing/suggestions'] });
    },
    onError: (error: Error) => toast.error(error.message || t('common.error')),
  });

  const handleSuggestion = priceSuggestions.useSave({ message: t('smartPricing.updated') });

  const createRule = pricingRules.useSave({
    message: t('smartPricing.ruleCreated'),
    onDone: () => {
      qc.invalidateQueries({ queryKey: ['pricing-rules'] });
      setRuleOpen(false);
    },
  });

  const fmt = (n: number) => formatCurrency(n);

  const suggestionColumns: ColumnDef<PriceSuggestion>[] = [
    {
      accessorKey: 'product_name',
      header: t('smartPricing.product'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.product_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.sku}</div>
        </div>
      ),
    },
    {
      accessorKey: 'current_price',
      header: t('smartPricing.currentPrice'),
      cell: ({ getValue }) => (
        <span className="font-data text-foreground">{fmt(getValue() as number)}</span>
      ),
    },
    {
      accessorKey: 'suggested_price',
      header: t('smartPricing.suggestedPrice'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold text-primary">{fmt(getValue() as number)}</span>
      ),
    },
    {
      id: 'change',
      header: t('smartPricing.change'),
      cell: ({ row }) => {
        const change = (
          ((row.original.suggested_price - row.original.current_price) /
            row.original.current_price) *
          100
        ).toFixed(1);
        const isIncrease = row.original.suggested_price > row.original.current_price;
        return (
          <Badge size="sm" variant={isIncrease ? 'success' : 'danger'}>
            {isIncrease ? '+' : ''}
            {change}%
          </Badge>
        );
      },
    },
    {
      accessorKey: 'reason',
      header: t('smartPricing.reason'),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground max-w-xs truncate block">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'confidence',
      header: t('smartPricing.confidence'),
      cell: ({ getValue }) => {
        const conf = getValue() as number;
        return (
          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${conf * 100}%` }} />
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            color="success"
            onClick={() => handleSuggestion.save({ id: row.original.id, status: 'applied' })}
            title={t('smartPricing.apply')}
            aria-label={t('smartPricing.apply')}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => handleSuggestion.save({ id: row.original.id, status: 'dismissed' })}
            title={t('smartPricing.dismiss')}
            aria-label={t('smartPricing.dismiss')}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('smartPricing.title')}
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === 'suggestions' ? 'solid' : 'bordered'}
              color={tab === 'suggestions' ? 'primary' : 'default'}
              size="sm"
              onClick={() => setTab('suggestions')}
              startContent={<Zap className="h-4 w-4" />}
            >
              {t('smartPricing.suggestions')}
            </Button>
            <Button
              variant={tab === 'rules' ? 'solid' : 'bordered'}
              color={tab === 'rules' ? 'primary' : 'default'}
              size="sm"
              onClick={() => setTab('rules')}
              startContent={<TrendingUp className="h-4 w-4" />}
            >
              {t('smartPricing.rules')}
            </Button>
            <Button
              color="primary"
              size="sm"
              onClick={() => generate.mutate()}
              isLoading={generate.isPending}
              startContent={
                <RefreshCw className={`h-4 w-4 ${generate.isPending ? 'animate-spin' : ''}`} />
              }
            >
              {t('smartPricing.generate')}
            </Button>
          </div>
        }
      />

      {tab === 'suggestions' && (
        <DataTable
          columns={suggestionColumns}
          data={suggestions ?? []}
          isLoading={isLoading}
          searchPlaceholder={t('common.search')}
          enableDensityToggle
        />
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={() => setRuleOpen(true)}
          >
            {t('smartPricing.addRule')}
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules?.map((r) => (
              <Card key={r.id} className="border border-border bg-card shadow-sm">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{r.name}</h3>
                    <Badge size="sm" variant={r.is_active ? 'success' : 'default'}>
                      {r.is_active ? t('smartPricing.active') : t('smartPricing.inactive')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('smartPricing.type')}: {r.rule_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('smartPricing.appliesTo')}: {r.applies_to}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('smartPricing.priority')}: {r.priority}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={ruleOpen}
        onOpenChange={setRuleOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRule.save({ ...ruleForm });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('smartPricing.addRule')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('smartPricing.ruleDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  label={t('smartPricing.ruleName')}
                  size="sm"
                  variant="bordered"
                  value={ruleForm.name}
                  onValueChange={(val) => setRuleForm({ ...ruleForm, name: val })}
                  isRequired
                />
                <Select
                  label={t('smartPricing.ruleType')}
                  size="sm"
                  variant="bordered"
                  selectedKeys={[ruleForm.rule_type]}
                  onChange={(e) => {
                    if (e.target.value) setRuleForm({ ...ruleForm, rule_type: e.target.value });
                  }}
                >
                  <SelectItem key="demand_based" textValue={t('smartPricing.demandBased')}>
                    {t('smartPricing.demandBased')}
                  </SelectItem>
                  <SelectItem key="time_based" textValue={t('smartPricing.timeBased')}>
                    {t('smartPricing.timeBased')}
                  </SelectItem>
                  <SelectItem key="clearance" textValue={t('smartPricing.clearance')}>
                    {t('smartPricing.clearance')}
                  </SelectItem>
                  <SelectItem key="competitor" textValue={t('smartPricing.competitor')}>
                    {t('smartPricing.competitor')}
                  </SelectItem>
                  <SelectItem key="bundle" textValue={t('smartPricing.bundleDiscount')}>
                    {t('smartPricing.bundleDiscount')}
                  </SelectItem>
                </Select>
                <Input
                  type="number"
                  label={t('smartPricing.priority')}
                  size="sm"
                  variant="bordered"
                  value={String(ruleForm.priority)}
                  onValueChange={(val) => setRuleForm({ ...ruleForm, priority: Number(val) })}
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setRuleOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button color="primary" size="sm" type="submit" isLoading={createRule.isSaving}>
                  {createRule.isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
