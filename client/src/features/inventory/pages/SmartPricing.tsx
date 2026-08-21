import { useState } from 'react';
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
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
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

  const { data: suggestions } = priceSuggestions.useList();
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('smartPricing.title')}>
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
      </PageHeader>

      {tab === 'suggestions' && (
        <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium text-xs">
              <tr>
                <th className="text-start p-3">{t('smartPricing.product')}</th>
                <th className="text-start p-3">{t('smartPricing.currentPrice')}</th>
                <th className="text-start p-3">{t('smartPricing.suggestedPrice')}</th>
                <th className="text-start p-3">{t('smartPricing.change')}</th>
                <th className="text-start p-3">{t('smartPricing.reason')}</th>
                <th className="text-start p-3">{t('smartPricing.confidence')}</th>
                <th className="text-start p-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {!suggestions?.length ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t('smartPricing.noSuggestions')}
                  </td>
                </tr>
              ) : (
                suggestions.map((s) => {
                  const change = (
                    ((s.suggested_price - s.current_price) / s.current_price) *
                    100
                  ).toFixed(1);
                  const isIncrease = s.suggested_price > s.current_price;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="font-medium text-foreground">{s.product_name}</div>
                        <div className="text-xs text-muted-foreground">{s.sku}</div>
                      </td>
                      <td className="p-3 font-data text-foreground">{fmt(s.current_price)}</td>
                      <td className="p-3 font-data font-semibold text-primary">
                        {fmt(s.suggested_price)}
                      </td>
                      <td className="p-3">
                        <Badge size="sm" variant={isIncrease ? 'success' : 'danger'}>
                          {isIncrease ? '+' : ''}
                          {change}%
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                        {s.reason}
                      </td>
                      <td className="p-3">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${s.confidence * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            isIconOnly
                            variant="light"
                            color="success"
                            size="sm"
                            className="h-8 w-8"
                            onClick={() => handleSuggestion.save({ id: s.id, action: 'accept' })}
                            aria-label={t('common.confirm')}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            isIconOnly
                            variant="light"
                            color="danger"
                            size="sm"
                            className="h-8 w-8"
                            onClick={() => handleSuggestion.save({ id: s.id, action: 'reject' })}
                            aria-label={t('common.cancel')}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
                  <SelectItem key="seasonal" textValue={t('smartPricing.seasonal')}>
                    {t('smartPricing.seasonal')}
                  </SelectItem>
                </Select>
                <Input
                  type="number"
                  label={t('smartPricing.priority')}
                  size="sm"
                  variant="bordered"
                  value={String(ruleForm.priority)}
                  onValueChange={(val) =>
                    setRuleForm({ ...ruleForm, priority: parseInt(val) || 0 })
                  }
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setRuleOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={createRule.isSaving}>
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
