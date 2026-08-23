import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Settings2, Image, Eye, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../shared/lib/utils';
import { Button, Input, Card, CardBody } from '@heroui/react';
import { Badge, PageHeader } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import type { StorefrontBanner, StorefrontConfig, StorefrontProduct } from '../types';

export default function StorefrontPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const transport = useTransport();
  const [tab, setTab] = useState<'config' | 'banners' | 'preview'>('config');

  const { data: config } = useApiQuery<StorefrontConfig>(
    ['storefront-config'],
    'storefront/config'
  );
  const { data: banners } = useApiQuery<StorefrontBanner[]>(
    ['storefront-banners'],
    'storefront/banners'
  );
  const { data: products } = useApiQuery<StorefrontProduct[]>(
    ['products', { page: 1, pageSize: 10, status: 'active' }],
    'products',
    { page: 1, pageSize: 10, status: 'active' },
    { enabled: tab === 'preview' }
  );

  const [configForm, setConfigForm] = useState<StorefrontConfig>({});

  const saveConfig = useMutation({
    mutationFn: (values: StorefrontConfig) =>
      transport.request({ method: 'PUT', path: 'storefront/config', body: values }),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      queryClient.invalidateQueries({ queryKey: ['storefront-config'] });
    },
    onError: (error: Error) => toast.error(error.message || t('common.error')),
  });

  const configFields = [
    { key: 'store_name', label: t('storefront.storeName') },
    { key: 'store_description', label: t('storefront.storeDescription') },
    { key: 'hero_title', label: t('storefront.heroTitle') },
    { key: 'hero_subtitle', label: t('storefront.heroSubtitle') },
    { key: 'shipping_free_threshold', label: t('storefront.freeShippingThreshold') },
    { key: 'shipping_standard_rate', label: t('storefront.standardShipping') },
    { key: 'shipping_express_rate', label: t('storefront.expressShipping') },
    { key: 'return_policy_days', label: t('storefront.returnDays') },
    { key: 'featured_category', label: t('storefront.featuredCategory') },
  ];

  const mergedConfig = { ...config, ...configForm };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('storefront.title')}
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === 'config' ? 'solid' : 'bordered'}
              color={tab === 'config' ? 'primary' : 'default'}
              size="sm"
              onClick={() => setTab('config')}
              startContent={<Settings2 className="h-4 w-4" />}
            >
              {t('storefront.config')}
            </Button>
            <Button
              variant={tab === 'banners' ? 'solid' : 'bordered'}
              color={tab === 'banners' ? 'primary' : 'default'}
              size="sm"
              onClick={() => setTab('banners')}
              startContent={<Image className="h-4 w-4" />}
            >
              {t('storefront.banners')}
            </Button>
            <Button
              variant={tab === 'preview' ? 'solid' : 'bordered'}
              color={tab === 'preview' ? 'primary' : 'default'}
              size="sm"
              onClick={() => setTab('preview')}
              startContent={<Eye className="h-4 w-4" />}
            >
              {t('storefront.preview')}
            </Button>
          </div>
        }
      />

      {tab === 'config' && (
        <Card className="max-w-2xl border border-border bg-card shadow-sm">
          <CardBody className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                size="sm"
                variant={config?.storefront_enabled === 'true' ? 'success' : 'danger'}
              >
                {config?.storefront_enabled === 'true'
                  ? t('storefront.enabled')
                  : t('storefront.disabled')}
              </Badge>
            </div>
            {configFields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                size="sm"
                variant="bordered"
                value={mergedConfig[f.key] || ''}
                onValueChange={(val) => setConfigForm((prev) => ({ ...prev, [f.key]: val }))}
              />
            ))}
            <div className="pt-2">
              <Button
                color="primary"
                size="sm"
                onClick={() => saveConfig.mutate(configForm)}
                isLoading={saveConfig.isPending}
                startContent={<Save className="h-4 w-4" />}
              >
                {saveConfig.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'banners' && (
        <div className="space-y-4">
          {!banners?.length ? (
            <div className="text-center py-16">
              <Image className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('storefront.noBanners')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((b) => (
                <Card key={b.id} className="border border-border bg-card shadow-sm">
                  <CardBody className="p-4">
                    <h3 className="font-semibold text-foreground">{b.title}</h3>
                    {b.subtitle && (
                      <p className="text-sm text-muted-foreground mt-0.5">{b.subtitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 font-data">
                      {t('storefront.position')}: {b.position}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'preview' && (
        <div className="space-y-6">
          <div className="bg-accent/40 p-8 rounded-xl border border-border text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
              {mergedConfig.hero_title || 'Discover Your Style'}
            </h2>
            <p className="text-muted-foreground">
              {mergedConfig.hero_subtitle || 'Premium fashion for the modern you'}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products?.map((p) => (
              <Card key={p.id} className="border border-border bg-card overflow-hidden shadow-sm">
                <div className="h-40 bg-muted/30 flex items-center justify-center">
                  {p.image_url ? (
                    <img
                      src={`http://localhost:3001${p.image_url}`}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Globe className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <CardBody className="p-3">
                  <h3 className="text-sm font-medium truncate text-foreground">{p.name}</h3>
                  <p className="text-primary font-data font-semibold mt-0.5">
                    {formatCurrency(p.price)}
                  </p>
                  {p.avg_rating > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {'★'.repeat(Math.round(p.avg_rating))} ({p.review_count})
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
