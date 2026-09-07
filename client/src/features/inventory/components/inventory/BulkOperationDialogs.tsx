import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from '@heroui/react';
import { ConfirmDialog } from '../../../../shared';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Category, Distributor } from '../../../../shared/types/index';

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
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('inventory.discontinueProduct')}
        description={t('bulk.discontinueConfirm', { count: String(selectedCount) })}
        confirmText={t('common.confirm')}
        confirmColor="danger"
        onConfirm={() => onBulkDelete(selectedIds)}
      />

      {/* Bulk Change Category */}
      <Modal
        isOpen={bulkCategoryOpen}
        onOpenChange={setBulkCategoryOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('bulk.changeCategoryTitle')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('bulk.changeCategoryDesc', { count: String(selectedCount) })}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <Select
                  label={t('inventory.categoryCol')}
                  size="sm"
                  variant="bordered"
                  placeholder={t('inventory.selectCategory')}
                  selectedKeys={bulkCategory ? [bulkCategory] : []}
                  onChange={(e) => setBulkCategory(e.target.value)}
                >
                  {categories?.map((cat) => (
                    <SelectItem key={String(cat.id)} textValue={cat.name}>
                      {cat.name}
                    </SelectItem>
                  )) || []}
                </Select>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={() => setBulkCategoryOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  disabled={!bulkCategory}
                  isLoading={bulkUpdatePending}
                  onPress={() => onBulkCategoryUpdate(selectedIds, Number(bulkCategory))}
                >
                  {t('common.update')}
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Bulk Change Distributor */}
      <Modal
        isOpen={bulkDistributorOpen}
        onOpenChange={setBulkDistributorOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('bulk.changeDistributorTitle')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('bulk.changeDistributorDesc', { count: String(selectedCount) })}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <Select
                  label={t('inventory.distributor')}
                  size="sm"
                  variant="bordered"
                  placeholder={t('inventory.selectDistributor')}
                  selectedKeys={bulkDistributor ? [bulkDistributor] : []}
                  onChange={(e) => setBulkDistributor(e.target.value)}
                >
                  {[
                    <SelectItem key="null" textValue={t('inventory.noDistributor')}>
                      {t('inventory.noDistributor')}
                    </SelectItem>,
                    ...(distributors ?? []).map((d) => (
                      <SelectItem key={String(d.id)} textValue={d.name}>
                        {d.name}
                      </SelectItem>
                    )),
                  ]}
                </Select>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={() => setBulkDistributorOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  disabled={!bulkDistributor}
                  isLoading={bulkUpdatePending}
                  onPress={() =>
                    onBulkDistributorUpdate(
                      selectedIds,
                      bulkDistributor === 'null' ? null : Number(bulkDistributor)
                    )
                  }
                >
                  {t('common.update')}
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Bulk Price Adjust */}
      <Modal
        isOpen={bulkPriceOpen}
        onOpenChange={setBulkPriceOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('bulk.adjustPriceTitle')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('bulk.adjustPriceDesc', { count: String(selectedCount) })}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-1">
                <Input
                  type="number"
                  step="0.1"
                  label={t('bulk.pricePercent')}
                  size="sm"
                  variant="bordered"
                  value={bulkPricePercent}
                  onValueChange={setBulkPricePercent}
                  placeholder="+10 or -15"
                />
                <p className="text-xs text-muted-foreground">{t('bulk.pricePercentHint')}</p>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={() => setBulkPriceOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  disabled={!bulkPricePercent}
                  isLoading={bulkUpdatePending}
                  onPress={() => onBulkPriceUpdate(selectedIds, Number(bulkPricePercent))}
                >
                  {t('common.update')}
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Bulk Change Status */}
      <Modal
        isOpen={bulkStatusOpen}
        onOpenChange={setBulkStatusOpen}
        backdrop="blur"
        placement="center"
        size="md"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('bulk.changeStatusTitle')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('bulk.changeStatusDesc', { count: String(selectedCount) })}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <Select
                  label={t('inventory.status')}
                  size="sm"
                  variant="bordered"
                  placeholder={t('inventory.status')}
                  selectedKeys={bulkStatusValue ? [bulkStatusValue] : []}
                  onChange={(e) => setBulkStatusValue(e.target.value)}
                >
                  <SelectItem key="active" textValue={t('inventory.active')}>
                    {t('inventory.active')}
                  </SelectItem>
                  <SelectItem key="inactive" textValue={t('inventory.inactive')}>
                    {t('inventory.inactive')}
                  </SelectItem>
                  <SelectItem key="discontinued" textValue={t('inventory.discontinued')}>
                    {t('inventory.discontinued')}
                  </SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={() => setBulkStatusOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  disabled={!bulkStatusValue}
                  isLoading={bulkUpdatePending}
                  onPress={() => {
                    onBulkStatusUpdate(selectedIds, bulkStatusValue);
                    setBulkStatusOpen(false);
                  }}
                >
                  {t('common.update')}
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
