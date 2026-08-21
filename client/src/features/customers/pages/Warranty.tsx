import { ShieldCheck, Plus } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Badge, type BadgeVariant, PageHeader } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';
import type { WarrantyClaim } from '../types';

const warranty = resource<WarrantyClaim>('warranty');

const emptyClaim = { sale_id: '', product_id: '', issue: '' };

const statusVariantMap: Record<string, BadgeVariant> = {
  submitted: 'primary',
  under_review: 'warning',
  approved: 'success',
  in_progress: 'secondary',
  resolved: 'success',
  rejected: 'danger',
};

const STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'in_progress',
  'resolved',
  'rejected',
] as const;

export default function WarrantyPage() {
  const { t } = useTranslation();
  const editor = useEditorDialog(emptyClaim);
  const form = editor.values;

  const { data: claims } = warranty.useList();

  const saver = warranty.useSave({
    message: t('warranty.create'),
    fallbackMessage: 'Error',
    onDone: editor.close,
  });

  const updateStatus = warranty.useAction('status', { method: 'PUT' });

  const statusKey = (s: string) => {
    const map: Record<string, string> = {
      submitted: 'warranty.submitted',
      under_review: 'warranty.underReview',
      approved: 'warranty.approved',
      in_progress: 'warranty.inProgress',
      resolved: 'warranty.resolved',
      rejected: 'warranty.rejected',
    };
    return map[s] || s;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('warranty.title')}
        actions={
          <Button
            color="primary"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={editor.openNew}
          >
            {t('warranty.create')}
          </Button>
        }
      />

      <div className="overflow-x-auto border border-border rounded-lg bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="text-start p-3 font-medium">#</th>
              <th className="text-start p-3 font-medium">{t('warranty.saleId')}</th>
              <th className="text-start p-3 font-medium">Product</th>
              <th className="text-start p-3 font-medium">{t('warranty.issue')}</th>
              <th className="text-start p-3 font-medium">{t('warranty.status')}</th>
              <th className="text-start p-3 font-medium">{t('common.date')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {!claims?.length ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  {t('warranty.noClaims')}
                </td>
              </tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 font-data text-muted-foreground">#{c.id}</td>
                  <td className="p-3 font-data font-medium">#{c.sale_id}</td>
                  <td className="p-3 font-medium text-foreground">{c.product_name}</td>
                  <td className="p-3 text-muted-foreground max-w-48 truncate">{c.issue}</td>
                  <td className="p-3">
                    <Badge size="sm" variant={statusVariantMap[c.status] || 'default'}>
                      {t(statusKey(c.status) as never)}
                    </Badge>
                  </td>
                  <td className="p-3 font-data text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 w-40">
                    <select
                      className="h-8 w-full text-xs rounded-md border border-border bg-background px-2 text-foreground"
                      value={c.status}
                      onChange={(e) =>
                        updateStatus.run({ id: c.id, body: { status: e.target.value } })
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(statusKey(s) as never)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={editor.open}
        onOpenChange={editor.setOpen}
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
                saver.save({
                  id: editor.editingId,
                  sale_id: Number(form.sale_id),
                  product_id: Number(form.product_id),
                  issue: form.issue,
                });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('warranty.create')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('warranty.title')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label={t('warranty.saleId')}
                    size="sm"
                    variant="bordered"
                    value={form.sale_id}
                    onValueChange={(val) => editor.set('sale_id', val)}
                    isRequired
                  />
                  <Input
                    type="number"
                    label="Product ID"
                    size="sm"
                    variant="bordered"
                    value={form.product_id}
                    onValueChange={(val) => editor.set('product_id', val)}
                    isRequired
                  />
                </div>
                <Input
                  label={t('warranty.issue')}
                  size="sm"
                  variant="bordered"
                  value={form.issue}
                  onValueChange={(val) => editor.set('issue', val)}
                  isRequired
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button color="primary" size="sm" type="submit" isLoading={saver.isSaving}>
                  {saver.isSaving ? t('common.loading') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
