import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { detectRecurring, type RecurringSuggestion } from '@/lib/recurringForecast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { fmtBRL, fmtDate } from './shared';
import { Trash2, Plus, Sparkles } from 'lucide-react';

const db = supabase as any;
interface Rule { id: string; kind: 'fixo' | 'parcela'; descricao: string; tipo: 'entrada' | 'saida'; valor: number; categoria: string; dia: number | null; data: string | null; active: boolean }

function sixMonthsAgo() { const d = new Date(); d.setMonth(d.getMonth() - 6, 1); return d.toISOString().slice(0, 10); }
const parseBR = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

export function ForecastRulesPanel({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: 'fixo' as 'fixo' | 'parcela', tipo: 'saida' as 'entrada' | 'saida', descricao: '', valor: '', categoria: '', dia: '', data: '' });

  const rules = useQuery({
    queryKey: ['forecastRules', schoolId],
    queryFn: async () => {
      const { data, error } = await db.from('forecast_rules').select('*').eq('school_id', schoolId).order('kind').order('valor', { ascending: false });
      if (error) throw error; return (data ?? []) as Rule[];
    },
  });

  const history = useQuery({
    queryKey: ['forecastHistory', schoolId],
    queryFn: async () => {
      const rows = await fetchAllRows<any>('bank_cashflow_entries', (q: any) => q.eq('school_id', schoolId).gte('data', sixMonthsAgo()), 1000, 'data, descricao, valor, tipo, tipo_nome, model_item_id');
      const ids = [...new Set(rows.map(r => r.model_item_id).filter(Boolean))];
      const names = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db.from('financial_model_template_items').select('id, name').in('id', ids.slice(i, i + 200));
        (data ?? []).forEach((it: any) => names.set(it.id, it.name));
      }
      return rows.map(r => ({ data: r.data, descricao: r.descricao, valor: Number(r.valor), tipo: r.tipo, categoria: ['Operação', 'Ignorar', 'A classificar'].includes(r.tipo_nome) ? r.tipo_nome : (names.get(r.model_item_id) ?? r.tipo_nome) }));
    },
  });

  const suggestions = useMemo(() => {
    const taken = new Set((rules.data ?? []).filter(r => r.kind === 'fixo').map(r => r.descricao.toLowerCase()));
    return detectRecurring(history.data ?? []).filter(s => !taken.has(s.descricao.toLowerCase()));
  }, [history.data, rules.data]);
  const categorias = useMemo(() => [...new Set((history.data ?? []).map(h => h.categoria).filter(c => c && !['Operação', 'Ignorar', 'A classificar'].includes(c)))].sort(), [history.data]);

  async function regenerate() {
    const { error } = await db.rpc('regenerate_forecast_entries', { _school_id: schoolId });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ['forecastRules', schoolId] });
    qc.invalidateQueries({ predicate: q => JSON.stringify(q.queryKey).includes(schoolId) && !String(q.queryKey[0]).startsWith('forecast') });
  }
  async function run(fn: () => Promise<any>, ok: string) {
    setBusy(true);
    try { const r = await fn(); if (r?.error) throw r.error; await regenerate(); toast.success(ok); }
    catch (e: any) { toast.error(e?.message ?? 'Não foi possível salvar'); }
    finally { setBusy(false); }
  }
  const addSuggestion = (s: RecurringSuggestion) => run(() => db.from('forecast_rules').insert({ school_id: schoolId, kind: 'fixo', descricao: s.descricao.slice(0, 200), tipo: s.tipo, valor: s.valor, categoria: s.categoria, dia: s.dia }), 'Conta fixa adicionada à previsão');
  const addManual = () => {
    const valor = parseBR(form.valor); const dia = Number(form.dia);
    if (!form.descricao.trim() || !form.categoria.trim() || !(valor > 0)) return toast.error('Preencha descrição, categoria e valor');
    if (form.kind === 'fixo' && !(dia >= 1 && dia <= 31)) return toast.error('Informe o dia do mês (1 a 31)');
    if (form.kind === 'parcela' && !form.data) return toast.error('Informe a data prevista');
    run(() => db.from('forecast_rules').insert({ school_id: schoolId, kind: form.kind, tipo: form.tipo, descricao: form.descricao.trim(), valor, categoria: form.categoria.trim(), dia: form.kind === 'fixo' ? dia : null, data: form.kind === 'parcela' ? form.data : null }), 'Previsão adicionada')
      .then(() => setForm(f => ({ ...f, descricao: '', valor: '', dia: '', data: '' })));
  };

  const list = rules.data ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-base font-bold text-foreground">Previsões automáticas</h3>
        <p className="mt-1 text-xs text-muted-foreground">Contas fixas entram todo mês nos próximos 6 meses e parcelas de contratos na data prevista (fim de semana vai para a sexta). Aparecem no Fluxo Diário como previsão e saem sozinhas quando o valor real cai no banco.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Sugestões do extrato (últimos 6 meses)</h4>
        {history.isLoading ? <p className="mt-2 text-xs text-muted-foreground">Analisando o extrato…</p> : suggestions.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nenhuma conta repetida com valor estável em pelo menos 3 meses.</p> : (
          <ul className="mt-2 divide-y divide-border">
            {suggestions.map(s => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.descricao}</p>
                  <p className="text-xs text-muted-foreground">{s.categoria} · todo dia {s.dia} · {s.meses} meses seguidos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={s.tipo === 'entrada' ? 'tabular-nums text-success' : 'tabular-nums text-destructive'}>{s.tipo === 'entrada' ? '+' : '−'}{fmtBRL(s.valor)}</span>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => addSuggestion(s)}><Plus className="mr-1 h-3.5 w-3.5" />É fixa</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-sm font-semibold text-foreground">Nova previsão</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as any })}>
            <option value="fixo">Conta fixa (todo mês)</option><option value="parcela">Parcela de contrato (data única)</option>
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as any })}>
            <option value="saida">Pagamento</option><option value="entrada">Recebimento</option>
          </select>
          {form.kind === 'fixo'
            ? <Input type="number" min={1} max={31} placeholder="Dia do mês" value={form.dia} onChange={e => setForm({ ...form, dia: e.target.value })} />
            : <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />}
          <Input placeholder="Descrição (ex.: Aluguel, Obra Centro – parcela 2)" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          <Input placeholder="Valor (ex.: 1.500,00)" inputMode="decimal" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          <Input list="forecast-cats" placeholder="Categoria do modelo" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
          <datalist id="forecast-cats">{categorias.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <Button className="mt-3" size="sm" disabled={busy} onClick={addManual}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-sm font-semibold text-foreground">Previsões cadastradas ({list.length})</h4>
        {list.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nada cadastrado ainda.</p> : (
          <ul className="mt-2 divide-y divide-border">
            {list.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.descricao}</p>
                  <p className="text-xs text-muted-foreground">{r.kind === 'fixo' ? `Fixa · todo dia ${r.dia}` : `Contrato · ${fmtDate(r.data)}`} · {r.categoria}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={r.tipo === 'entrada' ? 'tabular-nums text-success' : 'tabular-nums text-destructive'}>{r.tipo === 'entrada' ? '+' : '−'}{fmtBRL(Number(r.valor))}</span>
                  <Switch checked={r.active} disabled={busy} aria-label="Ativa" onCheckedChange={v => run(() => db.from('forecast_rules').update({ active: v, updated_at: new Date().toISOString() }).eq('id', r.id), v ? 'Previsão ligada' : 'Previsão desligada')} />
                  <Button size="icon" variant="ghost" disabled={busy} aria-label="Excluir" onClick={() => run(() => db.from('forecast_rules').delete().eq('id', r.id), 'Previsão excluída')}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
