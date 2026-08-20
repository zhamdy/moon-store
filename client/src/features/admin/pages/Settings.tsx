import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Switch } from '../../../shared/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { useTranslation } from '../../../shared/i18n/index';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import type { AppSettings } from '../../../shared/types/index';

export default function Settings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const transport = useTransport();

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('15');
  const [taxMode, setTaxMode] = useState('exclusive');

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState('1');
  const [loyaltyRedeemValue, setLoyaltyRedeemValue] = useState('5');

  // `['settings']` is shared with CartPanel and CustomerDetail — the key is the
  // contract that lets a save here refresh the tax rate they read.
  const { data: settings, isLoading } = useApiQuery<AppSettings>(['settings'], 'settings');

  useEffect(() => {
    if (settings) {
      setTaxEnabled(settings.tax_enabled === 'true');
      setTaxRate(settings.tax_rate || '15');
      setTaxMode(settings.tax_mode || 'exclusive');
      setLoyaltyEnabled(settings.loyalty_enabled === 'true');
      setLoyaltyEarnRate(settings.loyalty_earn_rate || '1');
      setLoyaltyRedeemValue(settings.loyalty_redeem_value || '5');
    }
  }, [settings]);

  // The settings map is written whole by a collection-level PUT, which is not a
  // shape `resource` serves, so this one goes straight to the transport.
  const saveMutation = useMutation({
    mutationFn: (values: AppSettings) =>
      transport.request({ method: 'PUT', path: 'settings', body: values }),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => toast.error(error.message || t('settings.saveFailed')),
  });

  const handleSave = () => {
    saveMutation.mutate({
      tax_enabled: taxEnabled ? 'true' : 'false',
      tax_rate: taxRate,
      tax_mode: taxMode === 'inclusive' ? 'inclusive' : 'exclusive',
      loyalty_enabled: loyaltyEnabled ? 'true' : 'false',
      loyalty_earn_rate: loyaltyEarnRate,
      loyalty_redeem_value: loyaltyRedeemValue,
    });
  };

  if (isLoading) return null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('settings.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      {/* Tax Settings */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">{t('settings.taxSettings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t('settings.taxEnabled')}</Label>
              <p className="text-xs text-muted">{t('settings.taxEnabledDesc')}</p>
            </div>
            <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
          </div>

          {taxEnabled && (
            <>
              <div className="space-y-2">
                <Label>{t('settings.taxRate')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('settings.taxMode')}</Label>
                <Select value={taxMode} onValueChange={setTaxMode}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exclusive">{t('settings.taxExclusive')}</SelectItem>
                    <SelectItem value="inclusive">{t('settings.taxInclusive')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted">
                  {taxMode === 'exclusive'
                    ? t('settings.taxExclusiveDesc')
                    : t('settings.taxInclusiveDesc')}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Loyalty Settings */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">{t('loyalty.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t('loyalty.enabled')}</Label>
              <p className="text-xs text-muted">{t('loyalty.enabledDesc')}</p>
            </div>
            <Switch checked={loyaltyEnabled} onCheckedChange={setLoyaltyEnabled} />
          </div>

          {loyaltyEnabled && (
            <>
              <div className="space-y-2">
                <Label>{t('loyalty.earnRate')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={loyaltyEarnRate}
                  onChange={(e) => setLoyaltyEarnRate(e.target.value)}
                  className="w-32"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('loyalty.redeemValue')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={loyaltyRedeemValue}
                    onChange={(e) => setLoyaltyRedeemValue(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-xs text-muted">$ / 100 pts</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="max-w-lg">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
