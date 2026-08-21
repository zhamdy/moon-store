import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Plus, Play, Trash2, Clock, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../shared/lib/utils';
import {
  Button,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Badge, type BadgeVariant } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useTransport } from '../../../shared/lib/transport/index';

type ReportRow = Record<string, unknown>;

interface SavedReport {
  id: number;
  name: string;
  description: string;
  report_type: string;
  config: string;
  chart_type: string;
  is_public: number;
  is_favorite: number;
  last_run_at: string | null;
  created_by_name: string;
  created_at: string;
}

const reportTypeVariant: Record<string, BadgeVariant> = {
  sales: 'success',
  inventory: 'primary',
  customers: 'secondary',
  financial: 'warning',
  custom: 'default',
};

const reports = resource<SavedReport>('reports');

export default function ReportBuilderPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const transport = useTransport();
  const [tab, setTab] = useState<'saved' | 'builder' | 'quick'>('saved');
  const [createOpen, setCreateOpen] = useState(false);
  const [resultData, setResultData] = useState<ReportRow[] | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    report_type: 'sales' as string,
    config: '{}',
    chart_type: 'table' as string,
    is_public: false,
  });
  const [quickForm, setQuickForm] = useState({
    type: 'revenue_by_date',
    date_from: '',
    date_to: '',
  });

  const { data: savedReports } = reports.useList();

  const createReport = reports.useSave({
    message: t('reportBuilder.created'),
    onDone: () => setCreateOpen(false),
  });

  const deleteReport = reports.useRemove({ message: t('reportBuilder.deleted') });

  const runReport = useMutation({
    mutationFn: (id: number) =>
      transport
        .request<ReportRow[]>({ method: 'POST', path: `reports/${id}/run` })
        .then((r) => r.data),
    onSuccess: (data) => {
      setResultData(data);
      toast.success(t('reportBuilder.runSuccess'));
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const runQuick = useMutation({
    mutationFn: (data: typeof quickForm) =>
      transport
        .request<ReportRow[]>({ method: 'POST', path: 'reports/quick', body: data })
        .then((r) => r.data),
    onSuccess: (data) => {
      setResultData(data);
      toast.success(t('reportBuilder.runSuccess'));
    },
  });

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('reportBuilder.title')}>
        <div className="flex items-center gap-2">
          <Button
            variant={tab === 'saved' ? 'flat' : 'light'}
            color={tab === 'saved' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setTab('saved')}
            startContent={<FileText className="h-4 w-4" />}
          >
            {t('reportBuilder.saved')}
          </Button>
          <Button
            variant={tab === 'quick' ? 'flat' : 'light'}
            color={tab === 'quick' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setTab('quick')}
            startContent={<Play className="h-4 w-4" />}
          >
            {t('reportBuilder.quickReport')}
          </Button>
          <Button
            color="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            startContent={<Plus className="h-4 w-4" />}
          >
            {t('reportBuilder.create')}
          </Button>
        </div>
      </PageHeader>

      {tab === 'saved' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!savedReports?.length ? (
            <div className="col-span-full text-center py-16">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('reportBuilder.noReports')}</p>
            </div>
          ) : (
            savedReports.map((r) => (
              <Card
                key={r.id}
                className="border border-border bg-card shadow-sm hover:border-border/80 transition-colors"
              >
                <CardBody className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm truncate text-foreground">{r.name}</h3>
                    <div className="flex gap-1">
                      <Button
                        isIconOnly
                        variant="light"
                        color="success"
                        size="sm"
                        className="h-7 w-7"
                        onClick={() => runReport.mutate(r.id)}
                        aria-label={t('reportBuilder.run')}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        variant="light"
                        color="danger"
                        size="sm"
                        className="h-7 w-7"
                        onClick={() => deleteReport.remove(r.id)}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Badge size="sm" variant={reportTypeVariant[r.report_type] || 'default'}>
                    {r.report_type}
                  </Badge>
                  {r.description && (
                    <p className="text-xs text-muted-foreground mt-2">{r.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {r.last_run_at
                        ? new Date(r.last_run_at).toLocaleDateString()
                        : t('reportBuilder.neverRun')}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'quick' && (
        <Card className="max-w-2xl border border-border bg-card shadow-sm">
          <CardBody className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label={t('reportBuilder.reportType')}
                size="sm"
                variant="bordered"
                selectedKeys={[quickForm.type]}
                onChange={(e) => setQuickForm({ ...quickForm, type: e.target.value })}
              >
                <SelectItem key="revenue_by_date" textValue={t('reportBuilder.revenueByDate')}>
                  {t('reportBuilder.revenueByDate')}
                </SelectItem>
                <SelectItem
                  key="revenue_by_category"
                  textValue={t('reportBuilder.revenueByCategory')}
                >
                  {t('reportBuilder.revenueByCategory')}
                </SelectItem>
                <SelectItem key="top_products" textValue={t('reportBuilder.topProducts')}>
                  {t('reportBuilder.topProducts')}
                </SelectItem>
              </Select>
              <Input
                type="date"
                label={t('reportBuilder.dateFrom')}
                size="sm"
                variant="bordered"
                value={quickForm.date_from}
                onValueChange={(val) => setQuickForm({ ...quickForm, date_from: val })}
              />
              <Input
                type="date"
                label={t('reportBuilder.dateTo')}
                size="sm"
                variant="bordered"
                value={quickForm.date_to}
                onValueChange={(val) => setQuickForm({ ...quickForm, date_to: val })}
              />
            </div>
            <Button
              color="primary"
              size="sm"
              onClick={() => runQuick.mutate(quickForm)}
              isLoading={runQuick.isPending}
              startContent={!runQuick.isPending && <Play className="h-4 w-4" />}
            >
              {t('reportBuilder.run')}
            </Button>
          </CardBody>
        </Card>
      )}

      {resultData && resultData.length > 0 && (
        <div className="mt-6 overflow-x-auto border border-border rounded-lg bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {Object.keys(resultData[0]).map((k) => (
                  <th key={k} className="text-start p-3 font-medium">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultData.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="p-3 font-data">
                      {typeof v === 'number' && v > 100 ? fmt(v) : String(v ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
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
                createReport.save(form);
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('reportBuilder.create')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('reportBuilder.createDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  label={t('reportBuilder.name')}
                  size="sm"
                  variant="bordered"
                  value={form.name}
                  onValueChange={(val) => setForm({ ...form, name: val })}
                  isRequired
                />
                <Input
                  label={t('reportBuilder.description')}
                  size="sm"
                  variant="bordered"
                  value={form.description}
                  onValueChange={(val) => setForm({ ...form, description: val })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label={t('reportBuilder.reportType')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.report_type]}
                    onChange={(e) => setForm({ ...form, report_type: e.target.value })}
                  >
                    <SelectItem key="sales" textValue={t('reportBuilder.sales')}>
                      {t('reportBuilder.sales')}
                    </SelectItem>
                    <SelectItem key="inventory" textValue={t('reportBuilder.inventory')}>
                      {t('reportBuilder.inventory')}
                    </SelectItem>
                    <SelectItem key="customers" textValue={t('reportBuilder.customers')}>
                      {t('reportBuilder.customers')}
                    </SelectItem>
                    <SelectItem key="financial" textValue={t('reportBuilder.financial')}>
                      {t('reportBuilder.financial')}
                    </SelectItem>
                  </Select>
                  <Select
                    label={t('reportBuilder.chartType')}
                    size="sm"
                    variant="bordered"
                    selectedKeys={[form.chart_type]}
                    onChange={(e) => setForm({ ...form, chart_type: e.target.value })}
                  >
                    <SelectItem key="table" textValue={t('reportBuilder.table')}>
                      {t('reportBuilder.table')}
                    </SelectItem>
                    <SelectItem key="bar" textValue={t('reportBuilder.bar')}>
                      {t('reportBuilder.bar')}
                    </SelectItem>
                    <SelectItem key="line" textValue={t('reportBuilder.line')}>
                      {t('reportBuilder.line')}
                    </SelectItem>
                    <SelectItem key="pie" textValue={t('reportBuilder.pie')}>
                      {t('reportBuilder.pie')}
                    </SelectItem>
                  </Select>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onClick={() => setCreateOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button color="primary" size="sm" type="submit" isLoading={createReport.isSaving}>
                  {createReport.isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
