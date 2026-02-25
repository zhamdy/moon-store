import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Settings2, Image, Eye, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { useTranslation } from '../i18n';
import api from '../services/api';

export default function StorefrontPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'config' | 'banners' | 'preview'>('config');

  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ['storefront-config'],
    queryFn: () => api.get('/api/storefront/config').then((r) => r.data.data),
  });
  const { data: banners } = useQuery<Record<string, unknown>[]>({
    queryKey: ['storefront-banners'],
    queryFn: () => api.get('/api/storefront/banners').then((r) => r.data.data),
  });
  const { data: products } = useQuery<Record<string, unknown>[]>({
    queryKey: ['storefront-products'],
    queryFn: () => api.get('/api/storefront/products?limit=8').then((r) => r.data.data),
    enabled: tab === 'preview',
  });

  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const saveConfig = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/api/storefront/config', data),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['storefront-config'] });
    },
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
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('storefront.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'config' ? 'default' : 'outline'}
            onClick={() => setTab('config')}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" /> {t('storefront.config')}
          </Button>
          <Button
            variant={tab === 'banners' ? 'default' : 'outline'}
            onClick={() => setTab('banners')}
            className="gap-2"
          >
            <Image className="h-4 w-4" /> {t('storefront.banners')}
          </Button>
          <Button
            variant={tab === 'preview' ? 'default' : 'outline'}
            onClick={() => setTab('preview')}
            className="gap-2"
          >
            <Eye className="h-4 w-4" /> {t('storefront.preview')}
          </Button>
        </div>
      </div>

      {tab === 'config' && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={config?.storefront_enabled === 'true' ? 'gold' : 'destructive'}>
              {config?.storefront_enabled === 'true'
                ? t('storefront.enabled')
                : t('storefront.disabled')}
            </Badge>
          </div>
          {configFields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Input
                value={mergedConfig[f.key] || ''}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button
            onClick={() => saveConfig.mutate(configForm)}
            disabled={saveConfig.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />{' '}
            {saveConfig.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}

      {tab === 'banners' && (
        <div className="space-y-4">
          {!banners?.length ? (
            <div className="text-center py-16">
              <Image className="h-12 w-12 text-gold/40 mx-auto mb-3" />
              <p className="text-muted">{t('storefront.noBanners')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((b: Record<string, unknown>) => (
                <div key={b.id} className="p-4 rounded-md border border-border bg-card">
                  <h3 className="font-medium">{b.title}</h3>
                  {b.subtitle && <p className="text-sm text-muted">{b.subtitle}</p>}
                  <p className="text-xs text-muted mt-1">
                    {t('storefront.position')}: {b.position}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'preview' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-gold/10 to-gold/5 p-8 rounded-md border border-gold/20 text-center">
            <h2 className="text-3xl font-display tracking-wider mb-2">
              {mergedConfig.hero_title || 'Discover Your Style'}
            </h2>
            <p className="text-muted">
              {mergedConfig.hero_subtitle || 'Premium fashion for the modern you'}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products?.map((p: Record<string, unknown>) => (
              <div key={p.id} className="rounded-md border border-border bg-card overflow-hidden">
                <div className="h-40 bg-surface flex items-center justify-center">
                  {p.image_url ? (
                    <img
                      src={`http://localhost:3001${p.image_url}`}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Globe className="h-8 w-8 text-muted" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium truncate">{p.name}</h3>
                  <p className="text-gold font-data">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(
                      p.price
                    )}
                  </p>
                  {p.avg_rating > 0 && (
                    <p className="text-xs text-muted mt-1">
                      {'★'.repeat(Math.round(p.avg_rating))} ({p.review_count})
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
