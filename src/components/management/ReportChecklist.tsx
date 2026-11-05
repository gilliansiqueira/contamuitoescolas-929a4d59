import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Copy, MinusCircle, Sparkles, Loader2 } from 'lucide-react';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { useTypeClassifications } from '@/hooks/useFinancialData';
import { buildReportFacts, buildProjectionFacts, unknownNumbers, type KpiSeries } from '@/lib/reportNarrativeFacts';
import type { ChecklistItem, ClosingStepTemplate } from '@/hooks/useClosingSteps';
import { useSetChecklistStatus } from '@/hooks/useClosingSteps';
import { isFuturasTooEarly, FUTURAS_VALIDADE_DIAS } from '@/lib/teamDeadlines';

const GROUPS: { key: string; label: string }[] = [
  { key: 'projecao', label: '1. Projeção' },
  { key: 'despesas', label: '2. Despesas' },
  { key: 'kpis', label: '3. KPIs' },
  { key: 'receitas', label: '4. Receitas por categoria' },
  { key: 'vendas', label: '5. Vendas' },
  { key: 'contatos', label: '6. Contatos e matrículas' },
  { key: 'envio', label: '7. Análise e envio ao cliente' },
];

const KIND_LABEL: Record<string, string> = { auto: 'Automático', hint: 'Manual · com dica', manual: 'Manual' };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function useStepHints(schoolId: string | null, month: string) {
  return useQuery({
    queryKey: ['report-step-hints', schoolId, month],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_report_step_hints', { _school_id: schoolId!, _month: month });
      if (error) throw error;
      return new Map((data ?? []).map(h => [h.step_key, h.has_data]));
    },
  });
}

interface Props {
  schoolId: string;
  schoolName: string;
  month: string;
  monthLabel: string;
  checklist: ChecklistItem[];
  templates: ClosingStepTemplate[];
}

export function ReportChecklist({ schoolId, schoolName, month, monthLabel, checklist, templates }: Props) {
  const setStatus = useSetChecklistStatus(schoolId, month);
  const { data: hints } = useStepHints(schoolId, month);
  const { data: projDeadline = null } = useQuery({
    queryKey: ['proj-deadline-active'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('team_announcements').select('ativo,team_announcement_deadlines(rotulo,data)').eq('ativo', true);
      const ds = ((data ?? []) as any[]).flatMap(a => a.team_announcement_deadlines ?? []).filter((d: any) => /proje/i.test(d.rotulo)).map((d: any) => d.data as string).sort();
      return (ds[ds.length - 1] ?? null) as string | null;
    },
  });
  const templateByKey = useMemo(() => new Map(templates.map(t => [t.step_key, t])), [templates]);
  const done = checklist.filter(i => i.status !== 'open').length;

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    checklist.forEach(item => {
      const g = templateByKey.get(item.step_key)?.group_key ?? 'extras';
      map.set(g, [...(map.get(g) ?? []), item]);
    });
    map.forEach(list => list.sort((a, b) => (templateByKey.get(a.step_key)?.sort_order ?? 999) - (templateByKey.get(b.step_key)?.sort_order ?? 999)));
    return map;
  }, [checklist, templateByKey]);

  const groups = [...GROUPS, { key: 'extras', label: 'Etapas extras desta empresa' }].filter(g => grouped.has(g.key));

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">{done} de {checklist.length} etapas concluídas em {monthLabel}.</p>
      {groups.map(group => (
         <div key={group.key} className={`rounded-md border ${group.key === 'envio' ? 'border-primary/40' : 'border-border'}`}>
           <p className={`border-b px-2.5 py-1.5 text-[11px] font-semibold ${group.key === 'envio' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/30'}`}>{group.label}</p>
          <div className="divide-y divide-border">
            {grouped.get(group.key)!.map(item => {
              const tpl = templateByKey.get(item.step_key);
              const kind = tpl?.check_kind ?? 'manual';
              const hint = hints?.get(item.step_key);
              return (
                <div key={item.id} className="flex items-start gap-2 px-2.5 py-2">
                  {item.status === 'completed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : item.status === 'not_applicable' ? <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${item.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>{item.label}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                      <span className={`rounded-full px-1.5 py-0.5 ${kind === 'auto' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{KIND_LABEL[kind] ?? 'Manual'}</span>
                      {kind === 'hint' && hint !== undefined && <span className={`rounded-full px-1.5 py-0.5 ${hint ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{hint ? 'Já há dados lançados' : 'Ainda sem dados'}</span>}
                       {item.completed_at && <span className="text-muted-foreground">{item.source === 'automatic' ? 'Marcado automaticamente' : 'Marcado pela equipe'} em {new Date(item.completed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                    </div>
                    {item.note && item.source === 'automatic' && <p className="mt-0.5 text-[10px] text-muted-foreground">{item.note}</p>}
                    {isFuturasTooEarly(item as any, projDeadline) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] text-warning">
                        <span>Marcada em {new Date(item.completed_at!).toLocaleDateString('pt-BR')}, cedo demais (mais de {FUTURAS_VALIDADE_DIAS} dias antes do prazo). Ainda conta como atrasada — atualize a projeção ou confirme de novo.</span>
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: item.id, status: 'completed' }, { onSuccess: () => toast.success('Projeção confirmada hoje.'), onError: e => toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar.') })}>Confirmar hoje</Button>
                      </div>
                    )}
                  </div>
                  <Select value={item.status} onValueChange={value => setStatus.mutate({ id: item.id, status: value as ChecklistItem['status'] }, { onError: e => toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar.') })}>
                    <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Pendente</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="not_applicable">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          {group.key === 'envio' && <ReportAnalysis schoolId={schoolId} schoolName={schoolName} month={month} monthLabel={monthLabel} />}
        </div>
      ))}
    </div>
  );
}

export function ReportAnalysis({ schoolId, schoolName, month, monthLabel }: { schoolId: string; schoolName: string; month: string; monthLabel: string }) {
  const qc = useQueryClient();
  const { entries, saldoInicial } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const [kind, setKind] = useState<'relatorio' | 'projecao'>('relatorio');
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastFacts, setLastFacts] = useState('');

  const { data: saved } = useQuery({
    queryKey: ['report-analysis', schoolId, month, kind],
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_report_analyses').select('content').eq('school_id', schoolId).eq('month', month).eq('kind', kind).maybeSingle();
      if (error) throw error;
      return data?.content ?? '';
    },
  });
  useEffect(() => { if (saved !== undefined) setText(saved); }, [saved]);

  const { data: kpis = [] } = useQuery({
    queryKey: ['report-analysis-kpis', schoolId],
    queryFn: async (): Promise<KpiSeries[]> => {
      const [{ data: defs, error: e1 }, { data: vals, error: e2 }] = await Promise.all([
        supabase.from('kpi_definitions').select('id,name,value_type,decimals,enabled,sort_order').eq('school_id', schoolId).eq('enabled', true).order('sort_order'),
        supabase.from('kpi_values').select('kpi_definition_id,month,value').eq('school_id', schoolId),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      return (defs ?? []).map(d => ({
        name: d.name, valueType: d.value_type, decimals: d.decimals,
        values: Object.fromEntries((vals ?? []).filter(v => v.kpi_definition_id === d.id).map(v => [v.month, Number(v.value)])),
      }));
    },
  });

  const save = useMutation({
    mutationFn: async (content: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('monthly_report_analyses').upsert({ school_id: schoolId, month, kind, content, edited_by: auth.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'school_id,month,kind' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['report-analysis', schoolId, month, kind] }); toast.success('Análise salva.'); },
    onError: e => toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'),
  });

  // Fatos oficiais: totais da SSOT (projectionEngine + ledgerEngine), sem recálculo próprio.
  const facts = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    const lines = kind === 'relatorio'
      ? buildReportFacts({ schoolName, month, entries, classifications, kpis })
      : buildProjectionFacts({ schoolName, closedMonth: month, entries, classifications, saldoInicial, today });
    return lines.join('\n');
  }, [kind, entries, classifications, kpis, month, schoolName, saldoInicial]);

  const warnings = useMemo(() => (text && lastFacts ? unknownNumbers(text, lastFacts) : []), [text, lastFacts]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('draft-monthly-analysis', { body: { schoolName, monthLabel, facts, kind } });
      if (error || !data?.text) throw new Error(data?.error === 'credits' ? 'Créditos de IA esgotados.' : data?.error === 'rate_limit' ? 'Muitas solicitações, tente em instantes.' : 'Não foi possível gerar o rascunho.');
      setText(data.text);
      setLastFacts(facts);
      toast.success('Rascunho gerado. Revise antes de enviar.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o rascunho.');
    } finally {
      setGenerating(false);
    }
  };

  return (
     <div id={`report-analysis-${schoolId}`} className="scroll-mt-4 space-y-2 border-t border-border bg-primary/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
         <div className="flex items-center gap-2">
          <p className="text-xs font-semibold">Texto para o cliente</p>
          <div className="flex rounded-md border border-border p-0.5">
            {(['relatorio', 'projecao'] as const).map(k => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded px-2 py-0.5 text-[11px] ${kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{k === 'relatorio' ? 'Relatório' : 'Projeção'}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => void generate()} disabled={generating}>{generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}{kind === 'relatorio' ? 'Gerar texto do Relatório' : 'Gerar texto da Projeção'}</Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => { void navigator.clipboard.writeText(text); toast.success('Texto copiado.'); }} disabled={!text}><Copy className="h-3 w-3" />Copiar</Button>
        </div>
      </div>
       <Textarea value={text} onChange={e => setText(e.target.value)} rows={12} className="text-xs" aria-label="Texto da análise para o cliente" placeholder="Gere um rascunho ou escreva a análise do mês." />
      {warnings.length > 0 && (
        <p className="rounded border border-accent/40 bg-accent/10 p-1.5 text-[11px]">Confira antes de enviar: estes números não vieram do cálculo da plataforma — {warnings.join(', ')}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">{text.length} caracteres · Os números vêm do cálculo oficial; a IA só redige. Revise antes de enviar.</p>
        <Button size="sm" className="h-7 text-[11px]" onClick={() => save.mutate(text)} disabled={save.isPending}>Salvar texto</Button>
      </div>
    </div>
  );
}
