import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTranslation } from '../../i18n';
import type { Category, Distributor } from '@/types';

interface BulkOperationDialogsProps {
  selectedCount: number;
  selectedIds: number[];
  categories: Category[] | undefined;
  distributors: Distributor[] | undefined;

  // Bulk delete
  bulkDeleteOpen: boolean;
  setBulkDeleteOpen: (open: boolean) => void;
  onBulkDelete: (ids: number[]) => void;

  // Bulk category
  bulkCategoryOpen: boolean;
  setBulkCategoryOpen: (open: boolean) => void;
  bulkCategory: string;
  setBulkCategory: (value: string) => void;
  onBulkCategoryUpdate: (ids: number[], categoryId: number) => void;
  bulkUpdatePending: boolean;

  // Bulk distributor
  bulkDistributorOpen: boolean;
  setBulkDistributorOpen: (open: boolean) => void;
  bulkDistributor: string;
  setBulkDistributor: (value: string) => void;
  onBulkDistributorUpdate: (ids: number[], distributorId: number | null) => void;

  // Bulk price
  bulkPriceOpen: boolean;
  setBulkPriceOpen: (open: boolean) => void;
  bulkPricePercent: string;
  setBulkPricePercent: (value: string) => void;
  onBulkPriceUpdate: (ids: number[], pricePercent: number) => void;

  // Bulk status
  bulkStatusOpen: boolean;
  setBulkStatusOpen: (open: boolean) => void;
  bulkStatusValue: string;
  setBulkStatusValue: (value: string) => void;
  onBulkStatusUpdate: (ids: number[], status: string) => void;
}

export default function BulkOperationDialogs({
  selectedCount,
  selectedIds,
  categories,
  distributors,
  bulkDeleteOpen,
  setBulkDeleteOpen,
  onBulkDelete,
  bulkCategoryOpen,
  setBulkCategoryOpen,
  bulkCategory,
  setBulkCategory,
  onBulkCategoryUpdate,
  bulkUpdatePending,
  bulkDistributorOpen,
  setBulkDistributorOpen,
  bulkDistributor,
  setBulkDistributor,
  onBulkDistributorUpdate,
  bulkPriceOpen,
  setBulkPriceOpen,
  bulkPricePercent,
  setBulkPricePercent,
  onBulkPriceUpdate,
  bulkStatusOpen,
  setBulkStatusOpen,
  bulkStatusValue,
  setBulkStatusValue,
  onBulkStatusUpdate,
}: BulkOperationDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Bulk Discontinue Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.discontinueProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulk.discontinueConfirm', { count: String(selectedCount) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onBulkDelete(selectedIds)}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Change Category */}
      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.changeCategoryTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.changeCategoryDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t('inventory.selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!bulkCategory || bulkUpdatePending}
              onClick={() => onBulkCategoryUpdate(selectedIds, Number(bulkCategory))}
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Distributor */}
      <Dialog open={bulkDistributorOpen} onOpenChange={setBulkDistributorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.changeDistributorTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.changeDistributorDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkDistributor} onValueChange={setBulkDistributor}>
            <SelectTrigger>
              <SelectValue placeholder={t('inventory.selectDistributor')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">{t('inventory.noDistributor')}</SelectItem>
              {distributors?.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!bulkDistributor || bulkUpdatePending}
              onClick={() =>
                onBulkDistributorUpdate(
                  selectedIds,
                  bulkDistributor === 'null' ? null : Number(bulkDistributor)
                )
              }
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Price Adjust */}
      <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.adjustPriceTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.adjustPriceDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('bulk.pricePercent')}</Label>
            <Input
              type="number"
              step="0.1"
              value={bulkPricePercent}
              onChange={(e) => setBulkPricePercent(e.target.value)}
              placeholder="+10 or -15"
            />
            <p className="text-xs text-muted">{t('bulk.pricePercentHint')}</p>
          </div>
          <DialogFooter>
            <Button
              disabled={!bulkPricePercent || bulkUpdatePending}
              onClick={() => onBulkPriceUpdate(selectedIds, Number(bulkPricePercent))}
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Status */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.changeStatusTitle')}</DialogTitle>
            <DialogDescription>
              {t('bulk.changeStatusDesc', { count: String(selectedCount) })}
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
            <SelectTrigger>
              <SelectValue placeholder={t('inventory.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('inventory.active')}</SelectItem>
              <SelectItem value="inactive">{t('inventory.inactive')}</SelectItem>
              <SelectItem value="discontinued">{t('inventory.discontinued')}</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!bulkStatusValue || bulkUpdatePending}
              onClick={() => {
                onBulkStatusUpdate(selectedIds, bulkStatusValue);
                setBulkStatusOpen(false);
              }}
            >
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
