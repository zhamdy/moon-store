import { useState } from 'react';
import { Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useEditorDialog } from '../../../shared/lib/editorDialog';

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  recurring: string;
  user_name: string;
}

interface PnLData {
  period: { from: string; to: string };
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  expenses_by_category: { category: string; total: number }[];
  net_profit: number;
}

const categories = ['rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other'] as const;
const recurrences = ['one_time', 'daily', 'weekly', 'monthly', 'yearly'] as const;

const expenses = resource<Expense, { total: number; total_amount: number }>('expenses');

const emptyExpense = () => ({
  category: 'other' as string,
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  recurring: 'one_time',
});

const expenseToForm = (exp: Expense) => ({
  category: exp.category,
  amount: String(exp.amount),
  description: exp.description || '',
  date: exp.date,
  recurring: exp.recurring,
});

export default function ExpensesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'list' | 'pnl'>('list');
  const editor = useEditorDialog(emptyExpense, expenseToForm);
  const form = editor.values;

  const { data: rows, meta } = expenses.useList({ limit: 100 });
  const { data: pnl } = expenses.useRead<PnLData>('pnl', undefined, tab === 'pnl');

  const saver = expenses.useSave({
    message: editor.isEditing ? t('expenses.updated') : t('expenses.created'),
    fallbackMessage: t('expenses.saveFailed'),
    onDone: editor.close,
  });

  const remover = expenses.useRemove({
    message: t('expenses.deleted'),
    fallbackMessage: t('expenses.deleteFailed'),
  });

  const categoryKey = (cat: string) => `expenses.${cat}` as const;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('expenses.title')}>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus className="h-4 w-4" />}
          onClick={editor.openNew}
        >
          {t('expenses.addExpense')}
        </Button>
      </PageHeader>

      {/* Tabs */}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as 'list' | 'pnl')}
        color="primary"
        variant="bordered"
        size="sm"
      >
        <Tab key="list" title={t('expenses.title')} />
        <Tab key="pnl" title={t('expenses.pnl')} />
      </Tabs>

      {tab === 'list' && (
        <>
          {/* Summary card */}
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4 flex flex-row items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  {t('expenses.totalExpenses')}
                </span>
                <p className="text-2xl font-data font-bold text-danger mt-1">
                  {formatCurrency(meta?.total_amount ?? 0)}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-primary/30" />
            </CardBody>
          </Card>

          {/* Expense table */}
          <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs">
                <tr>
                  <th className="text-start p-3 font-semibold">{t('expenses.date')}</th>
                  <th className="text-start p-3 font-semibold">{t('expenses.category')}</th>
                  <th className="text-start p-3 font-semibold">{t('expenses.description')}</th>
                  <th className="text-start p-3 font-semibold">{t('expenses.recurrence')}</th>
                  <th className="text-end p-3 font-semibold">{t('expenses.amount')}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {!rows?.length ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      {t('common.noResults')}
                    </td>
                  </tr>
                ) : (
                  rows.map((exp) => (
                    <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-data text-xs text-muted-foreground">{exp.date}</td>
                      <td className="p-3">
                        <Badge size="sm" variant="primary">
                          {t(categoryKey(exp.category))}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{exp.description || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {t(
                          `expenses.${exp.recurring === 'one_time' ? 'oneTime' : exp.recurring}` as never
                        )}
                      </td>
                      <td className="p-3 text-end font-data font-semibold text-danger">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="h-7 w-7"
                            onClick={() => editor.openEdit(exp)}
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button
                            isIconOnly
                            variant="light"
                            color="danger"
                            size="sm"
                            className="h-7 w-7"
                            onClick={() => {
                              if (window.confirm(t('expenses.deleteConfirm')))
                                remover.remove(exp.id);
                            }}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'pnl' && pnl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t('expenses.revenue')}
                  </span>
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <p className="text-2xl font-data font-bold text-success">
                  {formatCurrency(pnl.revenue)}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t('expenses.operatingExpenses')}
                  </span>
                  <TrendingDown className="h-4 w-4 text-danger" />
                </div>
                <p className="text-2xl font-data font-bold text-danger">
                  {formatCurrency(pnl.operating_expenses)}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {t('expenses.netProfit')}
                  </span>
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <p
                  className={`text-2xl font-data font-bold ${pnl.net_profit >= 0 ? 'text-success' : 'text-danger'}`}
                >
                  {formatCurrency(pnl.net_profit)}
                </p>
              </CardBody>
            </Card>
          </div>

          {/* P&L breakdown */}
          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-border text-foreground font-semibold">
                <span>{t('expenses.revenue')}</span>
                <span className="font-data">{formatCurrency(pnl.revenue)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border text-muted-foreground">
                <span>- {t('expenses.cogs')}</span>
                <span className="font-data">{formatCurrency(pnl.cogs)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border font-semibold text-foreground">
                <span>{t('expenses.grossProfit')}</span>
                <span className="font-data">{formatCurrency(pnl.gross_profit)}</span>
              </div>
              {pnl.expenses_by_category.map((cat) => (
                <div
                  key={cat.category}
                  className="flex justify-between py-1 text-sm text-muted-foreground ps-4"
                >
                  <span>- {t(categoryKey(cat.category))}</span>
                  <span className="font-data">{formatCurrency(cat.total)}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg text-foreground">
                <span>{t('expenses.netProfit')}</span>
                <span
                  className={`font-data ${pnl.net_profit >= 0 ? 'text-success' : 'text-danger'}`}
                >
                  {formatCurrency(pnl.net_profit)}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Add/Edit Expense Dialog */}
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
                saver.save({
                  id: editor.editingId,
                  category: form.category,
                  amount: Number(form.amount),
                  description: form.description || undefined,
                  date: form.date,
                  recurring: form.recurring,
                });
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {editor.isEditing ? t('expenses.editExpense') : t('expenses.addExpense')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('expenses.title')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label={t('expenses.category')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.category]}
                    onChange={(e) => {
                      if (e.target.value) editor.set('category', e.target.value);
                    }}
                  >
                    {categories.map((c) => (
                      <SelectItem key={c} textValue={t(categoryKey(c))}>
                        {t(categoryKey(c))}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    label={t('expenses.amount')}
                    size="sm"
                    variant="bordered"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onValueChange={(val) => editor.set('amount', val)}
                    isRequired
                  />
                </div>
                <Input
                  label={t('expenses.description')}
                  size="sm"
                  variant="bordered"
                  value={form.description}
                  onValueChange={(val) => editor.set('description', val)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label={t('expenses.date')}
                    size="sm"
                    variant="bordered"
                    value={form.date}
                    onValueChange={(val) => editor.set('date', val)}
                  />
                  <Select
                    label={t('expenses.recurrence')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.recurring]}
                    onChange={(e) => {
                      if (e.target.value) editor.set('recurring', e.target.value);
                    }}
                  >
                    {recurrences.map((r) => (
                      <SelectItem
                        key={r}
                        textValue={t(`expenses.${r === 'one_time' ? 'oneTime' : r}` as never)}
                      >
                        {t(`expenses.${r === 'one_time' ? 'oneTime' : r}` as never)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={editor.close}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" color="primary" size="sm" isLoading={saver.isSaving}>
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
