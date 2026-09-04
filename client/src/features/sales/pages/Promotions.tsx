import { useState } from 'react';
import { Ticket, Plus, Search, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import {
  Button,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Checkbox,
  Pagination,
} from '@heroui/react';
import { Badge, PageHeader } from '../../../shared';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import type { Coupon } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

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
  const { page, pageSize, update } = useListRouteState();
  const debouncedSearch = useDebouncedValue(search, 300);
  const editor = useEditorDialog(emptyCoupon, couponToForm);
  const form = editor.values;

  const {
    data: rows,
    meta,
    isLoading,
  } = coupons.useList({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const pagination = meta?.pagination as PaginationMeta | undefined;

  useLastPageRecovery(page, pagination?.totalItems, pagination?.totalPages, update);

  const saver = coupons.useSave({
    message: editor.isEditing ? t('promotions.updated') : t('promotions.created'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const remover = coupons.useRemove({
    message: t('promotions.deactivated'),
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('promotions.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={editor.openNew}
          >
            {t('promotions.addCoupon')}
          </Button>
        }
      />

      <div className="max-w-sm">
        <Input
          size="sm"
          variant="bordered"
          placeholder={t('promotions.search')}
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            update({ page: 1 });
          }}
          startContent={<Search className="h-4 w-4 text-primary" />}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : !rows?.length ? (
        <div className="text-center py-16">
          <Ticket className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{t('promotions.noCoupons')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="text-start p-3 font-semibold">{t('promotions.code')}</th>
                <th className="text-start p-3 font-semibold">{t('promotions.type')}</th>
                <th className="text-start p-3 font-semibold">{t('promotions.value')}</th>
                <th className="text-start p-3 font-semibold">{t('promotions.minPurchase')}</th>
                <th className="text-start p-3 font-semibold">{t('promotions.maxUses')}</th>
                <th className="text-start p-3 font-semibold">{t('promotions.status')}</th>
                <th className="text-end p-3 font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-data font-semibold text-foreground">{c.code}</td>
                  <td className="p-3">
                    <Badge size="sm" variant="primary">
                      {c.type === 'percentage' ? '%' : '$'}
                    </Badge>
                  </td>
                  <td className="p-3 font-data text-foreground">
                    {c.type === 'percentage' ? `${c.value}%` : formatCurrency(c.value)}
                  </td>
                  <td className="p-3 font-data text-muted-foreground">
                    {c.min_purchase ? formatCurrency(c.min_purchase) : '—'}
                  </td>
                  <td className="p-3 font-data text-muted-foreground">
                    {c.usage_count}
                    {c.max_uses ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td className="p-3">
                    <Badge
                      size="sm"
                      variant={
                        c.status === 'active' &&
                        (!c.expires_at || new Date(c.expires_at) > new Date())
                          ? 'success'
                          : 'danger'
                      }
                    >
                      {c.status === 'active' &&
                      (!c.expires_at || new Date(c.expires_at) > new Date())
                        ? t('common.active')
                        : t('promotions.expired')}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="h-8 w-8"
                            aria-label={t('common.actions')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Coupon actions">
                          <DropdownItem
                            key="edit"
                            startContent={<Pencil className="h-4 w-4" />}
                            onPress={() => editor.openEdit(c)}
                          >
                            {t('common.edit')}
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            className="text-danger"
                            color="danger"
                            startContent={<Trash2 className="h-4 w-4" />}
                            onPress={() => remover.remove(c.id)}
                          >
                            {t('common.delete')}
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            page={page}
            total={pagination.totalPages}
            onChange={(newPage) => update({ page: newPage })}
            showControls
          />
        </div>
      )}

      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saver.save({ id: editor.editingId, ...form });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editor.isEditing ? t('promotions.edit') : t('promotions.addCoupon')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('promotions.couponDetails')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('promotions.code')}
                    size="sm"
                    variant="bordered"
                    value={form.code}
                    onValueChange={(val) => editor.set('code', val)}
                    isRequired
                  />
                  <Select
                    label={t('promotions.type')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.type]}
                    onChange={(e) => {
                      if (e.target.value)
                        editor.set('type', e.target.value as 'percentage' | 'fixed');
                    }}
                  >
                    <SelectItem key="percentage" textValue={t('promotions.percentage')}>
                      {t('promotions.percentage')}
                    </SelectItem>
                    <SelectItem key="fixed" textValue={t('promotions.fixed')}>
                      {t('promotions.fixed')}
                    </SelectItem>
                  </Select>
                  <Input
                    type="number"
                    label={t('promotions.value')}
                    size="sm"
                    variant="bordered"
                    min="0"
                    step="0.01"
                    value={String(form.value || '')}
                    onValueChange={(val) => editor.set('value', parseFloat(val) || 0)}
                    isRequired
                  />
                  <Input
                    type="number"
                    label={t('promotions.minPurchase')}
                    size="sm"
                    variant="bordered"
                    min="0"
                    step="0.01"
                    value={String(form.min_purchase || '')}
                    onValueChange={(val) => editor.set('min_purchase', parseFloat(val) || null)}
                  />
                  <Input
                    type="number"
                    label={t('promotions.maxDiscount')}
                    size="sm"
                    variant="bordered"
                    min="0"
                    step="0.01"
                    value={String(form.max_discount || '')}
                    onValueChange={(val) => editor.set('max_discount', parseFloat(val) || null)}
                  />
                  <Input
                    type="number"
                    label={t('promotions.maxUses')}
                    size="sm"
                    variant="bordered"
                    min="1"
                    value={String(form.max_uses || '')}
                    onValueChange={(val) => editor.set('max_uses', parseInt(val) || null)}
                  />
                  <Input
                    type="datetime-local"
                    label={t('promotions.startsAt')}
                    size="sm"
                    variant="bordered"
                    value={form.starts_at || ''}
                    onValueChange={(val) => editor.set('starts_at', val || null)}
                  />
                  <Input
                    type="datetime-local"
                    label={t('promotions.expiresAt')}
                    size="sm"
                    variant="bordered"
                    value={form.expires_at || ''}
                    onValueChange={(val) => editor.set('expires_at', val || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="stackable"
                    isSelected={form.stackable}
                    onValueChange={(checked) => editor.set('stackable', checked)}
                    size="sm"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {t('promotions.stackable')}
                    </span>
                  </Checkbox>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saver.isSaving}>
                  {saver.isSaving
                    ? t('common.saving')
                    : editor.isEditing
                      ? t('common.save')
                      : t('promotions.addCoupon')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
