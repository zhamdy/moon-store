import { Plus, Trash2, Phone, Globe, Building2, Pencil } from 'lucide-react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../shared/ui/dialog';
import { useTranslation } from '../../shared/i18n/index';
import { resource } from '../../shared/lib/resource';
import { useEditorDialog } from '../../shared/lib/editorDialog';

import type { ShippingCompany } from '@/types';

const shippingCompanies = resource<ShippingCompany>('shipping-companies');

const emptyCompany = { name: '', phone: '', website: '' };

const companyToForm = (company: ShippingCompany) => ({
  name: company.name,
  phone: company.phone || '',
  website: company.website || '',
});

interface ShippingCompaniesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: ShippingCompany[] | undefined;
}

/**
 * Shipping companies are edited from inside the delivery page rather than on a
 * page of their own, so this dialog owns its own writes: the delivery page has
 * no reason to carry three mutations it never calls.
 */
export default function ShippingCompaniesDialog({
  open,
  onOpenChange,
  companies,
}: ShippingCompaniesDialogProps) {
  const { t } = useTranslation();
  const editor = useEditorDialog(emptyCompany, companyToForm);
  const form = editor.values;

  const saver = shippingCompanies.useSave({
    message: t('deliveries.companySaved'),
    fallbackMessage: editor.isEditing ? t('deliveries.updateFailed') : t('deliveries.createFailed'),
    onDone: editor.close,
  });

  const remover = shippingCompanies.useRemove({
    message: t('deliveries.companyDeleted'),
    fallbackMessage: t('deliveries.companyDeleteFailed'),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    saver.save({
      id: editor.editingId,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('deliveries.manageCompanies')}
          </DialogTitle>
          <DialogDescription>{t('deliveries.manageCompanies')}</DialogDescription>
        </DialogHeader>

        {editor.open ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label>{t('deliveries.companyName')}</Label>
              <Input
                value={form.name}
                onChange={(e) => editor.set('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveries.companyPhone')}</Label>
              <Input value={form.phone} onChange={(e) => editor.set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveries.companyWebsite')}</Label>
              <Input value={form.website} onChange={(e) => editor.set('website', e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={editor.close}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={saver.isSaving}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <Button size="sm" className="gap-1 w-full" onClick={editor.openNew}>
              <Plus className="h-3.5 w-3.5" />
              {t('deliveries.addCompany')}
            </Button>
            {companies && companies.length > 0 ? (
              companies.map((sc) => (
                <div
                  key={sc.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sc.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {sc.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {sc.phone}
                        </span>
                      )}
                      {sc.website && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {sc.website}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => editor.openEdit(sc)}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remover.remove(sc.id)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('common.noResults')}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
