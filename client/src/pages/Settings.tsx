import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useTranslation } from '../i18n';
import api from '../services/api';
import type { AxiosError } from 'axios';

interface AllSettings {
  tax_enabled: string;
  tax_rate: string;
  tax_mode: string;
  loyalty_enabled: string;
  loyalty_earn_rate: string;
  loyalty_redeem_value: string;
}

export default function Settings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('15');
  const [taxMode, setTaxMode] = useState('exclusive');

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState('1');
  const [loyaltyRedeemValue, setLoyaltyRedeemValue] = useState('5');

  const { data: settings, isLoading } = useQuery<AllSettings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings').then((r) => r.data.data),
  });

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

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/api/settings', data),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: AxiosError<{ error?: string }>) =>
      toast.error(err.response?.data?.error || t('settings.saveFailed')),
  });

  const handleSave = () => {
    saveMutation.mutate({
      tax_enabled: String(taxEnabled),
      tax_rate: taxRate,
      tax_mode: taxMode,
      loyalty_enabled: String(loyaltyEnabled),
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
