import { Plus, Trash2, Phone, Globe, Building2, Pencil } from 'lucide-react';
import { Button, Input, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { useTranslation } from '../../../../shared/i18n/index';
import { resource } from '../../../../shared/lib/resource';
import { useEditorDialog } from '../../../../shared/lib/editorDialog';

import type { ShippingCompany } from '../../types';

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
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="md"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t('deliveries.manageCompanies')}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('deliveries.manageCompanies')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4">
              {editor.open ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    label={t('deliveries.companyName')}
                    size="sm"
                    variant="bordered"
                    value={form.name}
                    onValueChange={(val) => editor.set('name', val)}
                    isRequired
                  />
                  <Input
                    label={t('deliveries.companyPhone')}
                    size="sm"
                    variant="bordered"
                    value={form.phone}
                    onValueChange={(val) => editor.set('phone', val)}
                  />
                  <Input
                    label={t('deliveries.companyWebsite')}
                    size="sm"
                    variant="bordered"
                    value={form.website}
                    onValueChange={(val) => editor.set('website', val)}
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="flat" size="sm" onClick={editor.close}>
                      {t('common.cancel')}
                    </Button>
                    <Button color="primary" type="submit" size="sm" isLoading={saver.isSaving}>
                      {t('common.save')}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<Plus className="h-4 w-4" />}
                    className="w-full"
                    onClick={editor.openNew}
                  >
                    {t('deliveries.addCompany')}
                  </Button>
                  {companies && companies.length > 0 ? (
                    companies.map((sc) => (
                      <div
                        key={sc.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{sc.name}</p>
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
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => editor.openEdit(sc)}
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            variant="light"
                            color="danger"
                            size="sm"
                            className="h-8 w-8"
                            onClick={() => remover.remove(sc.id)}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
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
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
