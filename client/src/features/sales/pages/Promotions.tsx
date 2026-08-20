import { useState } from 'react';
import { Ticket, Plus, Search, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui/dialog';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import type { Coupon } from '../types';

const coupons = resource<Coupon>('coupons');

const emptyCoupon = {
  code: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: 0,
  min_purchase: null as number | null,
  max_discount: null as number | null,
  starts_at: null as string | null,
  expires_at: null as string | null,
  max_uses: null as number | null,
  scope: 'all' as 'all' | 'category' | 'product',
  stackable: false,
};

const couponToForm = (c: Coupon) => ({
  code: c.code,
  type: c.type,
  value: c.value,
  min_purchase: c.min_purchase,
  max_discount: c.max_discount,
  starts_at: c.starts_at,
  expires_at: c.expires_at,
  max_uses: c.max_uses,
  scope: c.scope,
  stackable: !!c.stackable,
});

export default function Promotions() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const editor = useEditorDialog(emptyCoupon, couponToForm);
  const form = editor.values;

  const { data: rows, isLoading } = coupons.useList({ search: search || undefined });

  const saver = coupons.useSave({
    message: editor.isEditing ? t('promotions.updated') : t('promotions.created'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const remover = coupons.useRemove({
    message: t('promotions.deactivated'),
  });

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('promotions.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button onClick={editor.openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t('promotions.addCoupon')}
        </Button>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
        <Input
          placeholder={t('promotions.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">{t('common.loading')}</p>
      ) : !rows?.length ? (
        <div className="text-center py-16">
          <Ticket className="h-12 w-12 text-gold/40 mx-auto mb-3" />
          <p className="text-muted">{t('promotions.noCoupons')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-start p-3 font-medium text-muted">{t('promotions.code')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('promotions.type')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('promotions.value')}</th>
                <th className="text-start p-3 font-medium text-muted">
                  {t('promotions.minPurchase')}
                </th>
                <th className="text-start p-3 font-medium text-muted">{t('promotions.maxUses')}</th>
                <th className="text-start p-3 font-medium text-muted">{t('promotions.status')}</th>
                <th className="text-end p-3 font-medium text-muted">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-surface/50">
                  <td className="p-3 font-data font-semibold">{c.code}</td>
                  <td className="p-3">
                    <Badge variant="gold">{c.type === 'percentage' ? '%' : '$'}</Badge>
                  </td>
                  <td className="p-3 font-data">
                    {c.type === 'percentage' ? `${c.value}%` : formatCurrency(c.value)}
                  </td>
                  <td className="p-3 font-data">
                    {c.min_purchase ? formatCurrency(c.min_purchase) : '—'}
                  </td>
                  <td className="p-3 font-data">
                    {c.max_uses ? `${c.usage_count}/${c.max_uses}` : c.usage_count}
                  </td>
                  <td className="p-3">
                    <Badge variant={c.status === 'active' ? 'success' : 'destructive'}>
                      {c.status === 'active' ? t('promotions.active') : t('promotions.inactive')}
                    </Badge>
                  </td>
                  <td className="p-3 text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => editor.openEdit(c)}>
                          <Pencil className="h-4 w-4 me-2 text-gold" />
                          {t('common.edit')}
                        </DropdownMenuItem>
                        {c.status === 'active' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => remover.remove(c.id)}
                            >
                              <Trash2 className="h-4 w-4 me-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editor.open} onOpenChange={editor.setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor.isEditing ? t('promotions.edit') : t('promotions.addCoupon')}
            </DialogTitle>
            <DialogDescription>{t('promotions.couponDetails')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saver.save({ id: editor.editingId, ...form });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('promotions.code')}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => editor.set('code', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.type')}</Label>
                <select
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => editor.set('type', e.target.value as 'percentage' | 'fixed')}
                >
                  <option value="percentage">{t('promotions.percentage')}</option>
                  <option value="fixed">{t('promotions.fixed')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.value')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value || ''}
                  onChange={(e) => editor.set('value', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.minPurchase')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_purchase || ''}
                  onChange={(e) => editor.set('min_purchase', parseFloat(e.target.value) || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.maxDiscount')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_discount || ''}
                  onChange={(e) => editor.set('max_discount', parseFloat(e.target.value) || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.maxUses')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_uses || ''}
                  onChange={(e) => editor.set('max_uses', parseInt(e.target.value) || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.startsAt')}</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at || ''}
                  onChange={(e) => editor.set('starts_at', e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('promotions.expiresAt')}</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at || ''}
                  onChange={(e) => editor.set('expires_at', e.target.value || null)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="stackable"
                checked={form.stackable}
                onChange={(e) => editor.set('stackable', e.target.checked)}
                className="accent-gold h-4 w-4"
              />
              <Label htmlFor="stackable">{t('promotions.stackable')}</Label>
            </div>
            <Button type="submit" className="w-full" disabled={saver.isSaving}>
              {saver.isSaving
                ? t('common.saving')
                : editor.isEditing
                  ? t('common.save')
                  : t('promotions.addCoupon')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
