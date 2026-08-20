import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Zap, Check, X, RefreshCw, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../shared/lib/utils';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui/dialog';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import type { PriceSuggestion, PricingRule } from '@/types';

// Two nested collections under the AI route, each with its own CRUD surface.
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
  // Rules are only worth fetching once their tab is showing, and `useList` has
  // no way to say that.
  const { data: rules } = useApiQuery<PricingRule[]>(
    ['pricing-rules'],
    'ai/pricing/rules',
    undefined,
    { enabled: tab === 'rules' }
  );

  // The toast counts what came back, which no `resource` write reports, so the
  // generate run is taken straight off the transport.
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
      // The tab-gated read lives under its own key, so `useSave` cannot reach it.
      qc.invalidateQueries({ queryKey: ['pricing-rules'] });
      setRuleOpen(false);
    },
  });

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('smartPricing.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'suggestions' ? 'default' : 'outline'}
            onClick={() => setTab('suggestions')}
            className="gap-2"
          >
            <Zap className="h-4 w-4" /> {t('smartPricing.suggestions')}
          </Button>
          <Button
            variant={tab === 'rules' ? 'default' : 'outline'}
            onClick={() => setTab('rules')}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" /> {t('smartPricing.rules')}
          </Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${generate.isPending ? 'animate-spin' : ''}`} />{' '}
            {t('smartPricing.generate')}
          </Button>
        </div>
      </div>

      {tab === 'suggestions' && (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-start p-3 font-medium text-muted">
                  {t('smartPricing.product')}
                </th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('smartPricing.currentPrice')}
                </th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('smartPricing.suggestedPrice')}
                </th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('smartPricing.change')}
                </th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('smartPricing.reason')}
                </th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('smartPricing.confidence')}
                </th>
                <th className="text-start p-3 font-medium text-muted">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {!suggestions?.length ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
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
                    <tr key={s.id} className="border-b border-border hover:bg-surface/50">
                      <td className="p-3">
                        <div className="font-medium">{s.product_name}</div>
                        <div className="text-xs text-muted">{s.sku}</div>
                      </td>
                      <td className="p-3 font-data">{fmt(s.current_price)}</td>
                      <td className="p-3 font-data font-medium text-gold">
                        {fmt(s.suggested_price)}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={
                            isIncrease
                              ? 'bg-green-500/20 text-green-600'
                              : 'bg-red-500/20 text-red-600'
                          }
                        >
                          {isIncrease ? '+' : ''}
                          {change}%
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted max-w-xs truncate">{s.reason}</td>
                      <td className="p-3">
                        <div className="w-16 h-2 bg-surface rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold"
                            style={{ width: `${s.confidence * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-500"
                            onClick={() => handleSuggestion.save({ id: s.id, action: 'accept' })}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500"
                            onClick={() => handleSuggestion.save({ id: s.id, action: 'reject' })}
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
          <Button onClick={() => setRuleOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('smartPricing.addRule')}
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules?.map((r) => (
              <div key={r.id} className="p-4 rounded-md border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{r.name}</h3>
                  <Badge variant={r.is_active ? 'gold' : 'outline'}>
                    {r.is_active ? t('smartPricing.active') : t('smartPricing.inactive')}
                  </Badge>
                </div>
                <p className="text-xs text-muted">
                  {t('smartPricing.type')}: {r.rule_type}
                </p>
                <p className="text-xs text-muted">
                  {t('smartPricing.appliesTo')}: {r.applies_to}
                </p>
                <p className="text-xs text-muted">
                  {t('smartPricing.priority')}: {r.priority}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('smartPricing.addRule')}</DialogTitle>
            <DialogDescription>{t('smartPricing.ruleDesc')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createRule.save({ ...ruleForm });
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>{t('smartPricing.ruleName')}</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('smartPricing.ruleType')}</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={ruleForm.rule_type}
                onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
              >
                <option value="demand_based">{t('smartPricing.demandBased')}</option>
                <option value="time_based">{t('smartPricing.timeBased')}</option>
                <option value="clearance">{t('smartPricing.clearance')}</option>
                <option value="seasonal">{t('smartPricing.seasonal')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t('smartPricing.priority')}</Label>
              <Input
                type="number"
                value={ruleForm.priority}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={createRule.isSaving}>
              {createRule.isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
