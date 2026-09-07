import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, TrendingUp, RefreshCw, BookOpen, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../shared/lib/utils';
import {
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { Badge, PageHeader } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';

/** GET ai/predictions — sales_predictions joined onto its product */
interface SalesPrediction {
  id: number;
  product_id: number | null;
  product_name: string | null;
  sku: string | null;
  category: string | null;
  period: string;
  predicted_units: number;
  predicted_revenue: number;
  confidence: number;
}

/** GET ai/knowledge-base */
interface KnowledgeEntry {
  id: number;
  category: string;
  question: string;
  answer: string;
  keywords: string | null;
}

export default function AiInsightsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const transport = useTransport();
  const [tab, setTab] = useState<'predictions' | 'chatbot' | 'knowledge'>('predictions');
  const [kbOpen, setKbOpen] = useState(false);
  const [kbForm, setKbForm] = useState({ category: '', question: '', answer: '', keywords: '' });

  const { data: predictions } = useApiQuery<SalesPrediction[]>(
    ['predictions'],
    'ai/predictions',
    undefined,
    { enabled: tab === 'predictions' }
  );
  const { data: knowledgeBase } = useApiQuery<KnowledgeEntry[]>(
    ['knowledge-base'],
    'ai/knowledge-base',
    undefined,
    { enabled: tab === 'knowledge' }
  );

  const generatePredictions = useMutation({
    mutationFn: () =>
      transport.request<SalesPrediction[]>({ method: 'POST', path: 'ai/predictions/generate' }),
    onSuccess: (res) => {
      toast.success(`${res.data.length} ${t('aiInsights.predictionsGenerated')}`);
      qc.invalidateQueries({ queryKey: ['predictions'] });
    },
  });

  const addKbEntry = useMutation({
    mutationFn: (data: typeof kbForm) =>
      transport.request({ method: 'POST', path: 'ai/knowledge-base', body: data }),
    onSuccess: () => {
      toast.success(t('aiInsights.kbAdded'));
      qc.invalidateQueries({ queryKey: ['knowledge-base'] });
      setKbOpen(false);
      setKbForm({ category: '', question: '', answer: '', keywords: '' });
    },
  });

  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('aiInsights.title')}>
        <div className="flex gap-2">
          <Button
            variant={tab === 'predictions' ? 'flat' : 'light'}
            color={tab === 'predictions' ? 'primary' : 'default'}
            size="sm"
            onPress={() => setTab('predictions')}
            startContent={<TrendingUp className="h-4 w-4" />}
          >
            {t('aiInsights.predictions')}
          </Button>
          <Button
            variant={tab === 'knowledge' ? 'flat' : 'light'}
            color={tab === 'knowledge' ? 'primary' : 'default'}
            size="sm"
            onPress={() => setTab('knowledge')}
            startContent={<BookOpen className="h-4 w-4" />}
          >
            {t('aiInsights.knowledgeBase')}
          </Button>
        </div>
      </PageHeader>

      {tab === 'predictions' && (
        <div className="space-y-4">
          <Button
            color="primary"
            size="sm"
            onPress={() => generatePredictions.mutate()}
            isLoading={generatePredictions.isPending}
            startContent={!generatePredictions.isPending && <RefreshCw className="h-4 w-4" />}
          >
            {t('aiInsights.generatePredictions')}
          </Button>
          <div className="overflow-x-auto border border-border rounded-lg bg-card">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="text-start p-3 font-semibold">{t('aiInsights.product')}</th>
                  <th className="text-start p-3 font-semibold">{t('aiInsights.period')}</th>
                  <th className="text-start p-3 font-semibold">{t('aiInsights.predictedUnits')}</th>
                  <th className="text-start p-3 font-semibold">
                    {t('aiInsights.predictedRevenue')}
                  </th>
                  <th className="text-start p-3 font-semibold">{t('aiInsights.confidence')}</th>
                </tr>
              </thead>
              <tbody>
                {!predictions?.length ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      <Brain className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p>{t('aiInsights.noPredictions')}</p>
                    </td>
                  </tr>
                ) : (
                  predictions.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{p.product_name}</div>
                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                      </td>
                      <td className="p-3 font-data">{p.period}</td>
                      <td className="p-3 font-data">{p.predicted_units}</td>
                      <td className="p-3 font-data text-primary font-medium">
                        {fmt(p.predicted_revenue)}
                      </td>
                      <td className="p-3">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${p.confidence * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="space-y-4">
          <Button
            color="primary"
            size="sm"
            onPress={() => setKbOpen(true)}
            startContent={<Plus className="h-4 w-4" />}
          >
            {t('aiInsights.addEntry')}
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knowledgeBase?.map((entry) => (
              <div key={entry.id} className="p-5 rounded-lg border border-border bg-card shadow-sm">
                <Badge size="sm" variant="primary" className="mb-2">
                  {entry.category}
                </Badge>
                <h3 className="font-semibold text-sm mb-1 text-foreground">{entry.question}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{entry.answer}</p>
                {entry.keywords && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {entry.keywords.split(',').map((k: string, i: number) => (
                      <Badge key={i} size="sm" variant="default" className="text-[11px]">
                        {k.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={kbOpen}
        onOpenChange={setKbOpen}
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
                addKbEntry.mutate(kbForm);
              }}
            >
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">{t('aiInsights.addEntry')}</h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('aiInsights.addEntryDesc')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                <Input
                  label={t('aiInsights.category')}
                  size="sm"
                  variant="bordered"
                  value={kbForm.category}
                  onValueChange={(val) => setKbForm({ ...kbForm, category: val })}
                  isRequired
                />
                <Input
                  label={t('aiInsights.question')}
                  size="sm"
                  variant="bordered"
                  value={kbForm.question}
                  onValueChange={(val) => setKbForm({ ...kbForm, question: val })}
                  isRequired
                />
                <Textarea
                  label={t('aiInsights.answer')}
                  size="sm"
                  variant="bordered"
                  minRows={3}
                  value={kbForm.answer}
                  onValueChange={(val) => setKbForm({ ...kbForm, answer: val })}
                  isRequired
                />
                <Input
                  label={t('aiInsights.keywords')}
                  size="sm"
                  variant="bordered"
                  value={kbForm.keywords}
                  onValueChange={(val) => setKbForm({ ...kbForm, keywords: val })}
                  placeholder="comma,separated,keywords"
                />
              </ModalBody>
              <ModalFooter className="border-t border-border/50">
                <Button variant="flat" size="sm" onPress={() => setKbOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button color="primary" size="sm" type="submit" isLoading={addKbEntry.isPending}>
                  {t('common.save')}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
