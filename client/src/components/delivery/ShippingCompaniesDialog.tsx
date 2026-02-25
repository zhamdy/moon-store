import { useState } from 'react';
import { Plus, Trash2, Phone, Globe, Building2, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useTranslation } from '../../i18n';

import type { UseMutationResult } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import type { ShippingCompany } from '../../hooks/useDeliveryData';

interface ShippingCompaniesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: ShippingCompany[] | undefined;
  companyCreateMutation: UseMutationResult<
    AxiosResponse,
    Error,
    { name: string; phone?: string; website?: string }
  >;
  companyUpdateMutation: UseMutationResult<
    AxiosResponse,
    Error,
    { id: number; data: { name: string; phone?: string; website?: string } }
  >;
  companyDeleteMutation: UseMutationResult<AxiosResponse, Error, number>;
}

export default function ShippingCompaniesDialog({
  open,
  onOpenChange,
  companies,
  companyCreateMutation,
  companyUpdateMutation,
  companyDeleteMutation,
}: ShippingCompaniesDialogProps) {
  const { t } = useTranslation();
  const [editingCompany, setEditingCompany] = useState<ShippingCompany | null>(null);
  const [companyFormOpen, setCompanyFormOpen] = useState(false);

  const handleSave = (data: { name: string; phone?: string; website?: string }) => {
    if (editingCompany) {
      companyUpdateMutation.mutate(
        { id: editingCompany.id, data },
        {
          onSuccess: () => {
            setCompanyFormOpen(false);
            setEditingCompany(null);
          },
        }
      );
    } else {
      companyCreateMutation.mutate(data, {
        onSuccess: () => {
          setCompanyFormOpen(false);
          setEditingCompany(null);
        },
      });
    }
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

        {companyFormOpen ? (
          <CompanyForm
            company={editingCompany}
            onSave={handleSave}
            onCancel={() => {
              setCompanyFormOpen(false);
              setEditingCompany(null);
            }}
            isPending={companyCreateMutation.isPending || companyUpdateMutation.isPending}
            t={t}
          />
        ) : (
          <div className="space-y-2">
            <Button
              size="sm"
              className="gap-1 w-full"
              onClick={() => {
                setEditingCompany(null);
                setCompanyFormOpen(true);
              }}
            >
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
                      onClick={() => {
                        setEditingCompany(sc);
                        setCompanyFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => companyDeleteMutation.mutate(sc.id)}
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

// Sub-component for company add/edit form
function CompanyForm({
  company,
  onSave,
  onCancel,
  isPending,
  t,
}: {
  company: ShippingCompany | null;
  onSave: (data: { name: string; phone?: string; website?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const [name, setName] = useState(company?.name || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [website, setWebsite] = useState(company?.website || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label>{t('deliveries.companyName')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{t('deliveries.companyPhone')}</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t('deliveries.companyWebsite')}</Label>
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
