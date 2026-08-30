import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Switch,
  Select,
  SelectItem,
} from '@heroui/react';
import { useTranslation } from '../../../shared/i18n/index';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import PageHeader from '../../../shared/components/PageHeader';
import type { AppSettings } from '../../../shared/types/index';

export default function Settings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const transport = useTransport();

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('15');
  const [taxMode, setTaxMode] = useState('exclusive');

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  // Canonical, direct-unit loyalty settings (see AppSettings). Defaults match
  // LOYALTY_SETTINGS_DEFAULTS on the server.
  const [loyaltyPointsPerEgp, setLoyaltyPointsPerEgp] = useState('1');
  const [loyaltyEgpPerPoint, setLoyaltyEgpPerPoint] = useState('0.1');

  const { data: settings, isLoading } = useApiQuery<AppSettings>(['settings'], 'settings');

  useEffect(() => {
    if (settings) {
      setTaxEnabled(settings.tax_enabled === 'true');
      setTaxRate(settings.tax_rate || '15');
      setTaxMode(settings.tax_mode || 'exclusive');
      setLoyaltyEnabled(settings.loyalty_enabled === 'true');
      setLoyaltyPointsPerEgp(settings.loyalty_points_per_egp || '1');
      setLoyaltyEgpPerPoint(settings.loyalty_egp_per_point || '0.1');
    }
  }, [settings]);

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
      loyalty_points_per_egp: loyaltyPointsPerEgp,
      loyalty_egp_per_point: loyaltyEgpPerPoint,
    });
  };

  if (isLoading) return null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('settings.title')} />

      {/* Tax Settings */}
      <Card className="max-w-xl border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{t('settings.taxSettings')}</h2>
        </CardHeader>
        <CardBody className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t('settings.taxEnabled')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('settings.taxEnabledDesc')}</p>
            </div>
            <Switch
              isSelected={taxEnabled}
              onValueChange={setTaxEnabled}
              aria-label={t('settings.taxEnabled')}
            />
          </div>

          {taxEnabled && (
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="w-48">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  label={t('settings.taxRate')}
                  size="sm"
                  variant="bordered"
                  value={taxRate}
                  onValueChange={setTaxRate}
                  endContent={<span className="text-xs text-muted-foreground">%</span>}
                />
              </div>

              <div className="w-72">
                <Select
                  label={t('settings.taxMode')}
                  size="sm"
                  variant="bordered"
                  selectedKeys={[taxMode]}
                  onChange={(e) => setTaxMode(e.target.value || 'exclusive')}
                  description={
                    taxMode === 'exclusive'
                      ? t('settings.taxExclusiveDesc')
                      : t('settings.taxInclusiveDesc')
                  }
                >
                  <SelectItem key="exclusive" textValue={t('settings.taxExclusive')}>
                    {t('settings.taxExclusive')}
                  </SelectItem>
                  <SelectItem key="inclusive" textValue={t('settings.taxInclusive')}>
                    {t('settings.taxInclusive')}
                  </SelectItem>
                </Select>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Loyalty Settings */}
      <Card className="max-w-xl border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{t('loyalty.title')}</h2>
        </CardHeader>
        <CardBody className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t('loyalty.enabled')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('loyalty.enabledDesc')}</p>
            </div>
            <Switch
              isSelected={loyaltyEnabled}
              onValueChange={setLoyaltyEnabled}
              aria-label={t('loyalty.enabled')}
            />
          </div>

          {loyaltyEnabled && (
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="w-48">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  label={t('loyalty.earnRate')}
                  size="sm"
                  variant="bordered"
                  value={loyaltyPointsPerEgp}
                  onValueChange={setLoyaltyPointsPerEgp}
                  endContent={
                    <span className="text-xs text-muted-foreground font-data">pts / EGP</span>
                  }
                />
              </div>

              <div className="w-48">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label={t('loyalty.redeemValue')}
                  size="sm"
                  variant="bordered"
                  value={loyaltyEgpPerPoint}
                  onValueChange={setLoyaltyEgpPerPoint}
                  endContent={
                    <span className="text-xs text-muted-foreground font-data">EGP / pt</span>
                  }
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* API Reference & Developer Tools */}
      <Card className="max-w-xl border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">API Reference & Documentation</h2>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Explore interactive API endpoints, test requests in real-time, and view OpenAPI schemas
            powered by Scalar.
          </p>
          <div className="flex gap-3">
            <Button
              as="a"
              href="http://localhost:3001/reference"
              target="_blank"
              rel="noopener noreferrer"
              variant="flat"
              color="primary"
            >
              Open Scalar API Docs ↗
            </Button>
            <Button
              as="a"
              href="http://localhost:3001/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              variant="bordered"
            >
              View OpenAPI JSON ↗
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="max-w-xl">
        <Button color="primary" onClick={handleSave} isLoading={saveMutation.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
