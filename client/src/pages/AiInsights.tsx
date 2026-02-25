import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, TrendingUp, RefreshCw, BookOpen, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { useTranslation } from '../i18n';
import api from '../services/api';

export default function AiInsightsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'predictions' | 'chatbot' | 'knowledge'>('predictions');
  const [kbOpen, setKbOpen] = useState(false);
  const [kbForm, setKbForm] = useState({ category: '', question: '', answer: '', keywords: '' });

  const { data: predictions } = useQuery<Record<string, unknown>[]>({
    queryKey: ['predictions'],
    queryFn: () => api.get('/api/ai/predictions').then((r) => r.data.data),
    enabled: tab === 'predictions',
  });
  const { data: knowledgeBase } = useQuery<Record<string, unknown>[]>({
    queryKey: ['knowledge-base'],
    queryFn: () => api.get('/api/ai/knowledge-base').then((r) => r.data.data),
    enabled: tab === 'knowledge',
  });

  const generatePredictions = useMutation({
    mutationFn: () => api.post('/api/ai/predictions/generate'),
    onSuccess: (res) => {
      toast.success(`${res.data.data.length} ${t('aiInsights.predictionsGenerated')}`);
      qc.invalidateQueries({ queryKey: ['predictions'] });
    },
  });

  const addKbEntry = useMutation({
    mutationFn: (data: typeof kbForm) => api.post('/api/ai/knowledge-base', data),
    onSuccess: () => {
      toast.success(t('aiInsights.kbAdded'));
      qc.invalidateQueries({ queryKey: ['knowledge-base'] });
      setKbOpen(false);
      setKbForm({ category: '', question: '', answer: '', keywords: '' });
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(n);

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('aiInsights.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'predictions' ? 'default' : 'outline'}
            onClick={() => setTab('predictions')}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" /> {t('aiInsights.predictions')}
          </Button>
          <Button
            variant={tab === 'knowledge' ? 'default' : 'outline'}
            onClick={() => setTab('knowledge')}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" /> {t('aiInsights.knowledgeBase')}
          </Button>
        </div>
      </div>

      {tab === 'predictions' && (
        <div className="space-y-4">
          <Button
            onClick={() => generatePredictions.mutate()}
            disabled={generatePredictions.isPending}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${generatePredictions.isPending ? 'animate-spin' : ''}`}
            />{' '}
            {t('aiInsights.generatePredictions')}
          </Button>
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('aiInsights.product')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('aiInsights.period')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('aiInsights.predictedUnits')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('aiInsights.predictedRevenue')}
                  </th>
                  <th className="text-start p-3 font-medium text-muted">
                    {t('aiInsights.confidence')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {!predictions?.length ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted">
                      <Brain className="h-12 w-12 text-gold/40 mx-auto mb-3" />
                      <p>{t('aiInsights.noPredictions')}</p>
                    </td>
                  </tr>
                ) : (
                  predictions.map((p: Record<string, unknown>) => (
                    <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                      <td className="p-3">
                        <div className="font-medium">{p.product_name}</div>
                        <div className="text-xs text-muted">{p.sku}</div>
                      </td>
                      <td className="p-3 font-data">{p.period}</td>
                      <td className="p-3 font-data">{p.predicted_units}</td>
                      <td className="p-3 font-data text-gold">{fmt(p.predicted_revenue)}</td>
                      <td className="p-3">
                        <div className="w-16 h-2 bg-surface rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold"
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
          <Button onClick={() => setKbOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('aiInsights.addEntry')}
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knowledgeBase?.map((entry: Record<string, unknown>) => (
              <div key={entry.id} className="p-4 rounded-md border border-border bg-card">
                <Badge variant="gold" className="text-[10px] mb-2">
                  {entry.category}
                </Badge>
                <h3 className="font-medium text-sm mb-1">{entry.question}</h3>
                <p className="text-xs text-muted">{entry.answer}</p>
                {entry.keywords && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {entry.keywords.split(',').map((k: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
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

      <Dialog open={kbOpen} onOpenChange={setKbOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('aiInsights.addEntry')}</DialogTitle>
            <DialogDescription>{t('aiInsights.addEntryDesc')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addKbEntry.mutate(kbForm);
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>{t('aiInsights.category')}</Label>
              <Input
                value={kbForm.category}
                onChange={(e) => setKbForm({ ...kbForm, category: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('aiInsights.question')}</Label>
              <Input
                value={kbForm.question}
                onChange={(e) => setKbForm({ ...kbForm, question: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('aiInsights.answer')}</Label>
              <textarea
                className="w-full min-h-20 rounded-md border border-border bg-background p-3 text-sm"
                value={kbForm.answer}
                onChange={(e) => setKbForm({ ...kbForm, answer: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{t('aiInsights.keywords')}</Label>
              <Input
                value={kbForm.keywords}
                onChange={(e) => setKbForm({ ...kbForm, keywords: e.target.value })}
                placeholder="comma,separated,keywords"
              />
            </div>
            <Button type="submit" className="w-full" disabled={addKbEntry.isPending}>
              {addKbEntry.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
