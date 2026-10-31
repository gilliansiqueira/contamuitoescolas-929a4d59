import { useRealizedEntries } from '@/hooks/useRealizedEntries';
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEntityFilter, applyEntityFilterShared, scaleSharedRows, useGlobalPeriod } from '@/contexts/GlobalPeriodContext';
import { useExpenseDetail } from '@/hooks/useExpenseDetail';
import { useExpenseDetailTrips } from '@/hooks/useExpenseDetailTrips';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { resolveLedgerRule } from '@/lib/ledgerEngine';
import { dividirPorCnpjDireto, agregarGestaoCompetencia, somaPeriodo, margemPeriodo } from '@/lib/gestaoIndicadores';
import { useResultBasis } from '@/hooks/useResultadoBase';
import { useFinancialMonthStatuses } from '@/hooks/useFinancialMonthStatus';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { computeSaldoFinal } from '@/lib/periodMovement';
import {
  agregarRealizado, custoFixo, margem, pontoEquilibrio, retornoMarketing, pesoPct, mediaUltimos, emptyMes,
} from '@/lib/gestaoIndicadores';

interface Props { schoolId: string; referenceMonth: string }

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

type Fmt = 'currency' | 'percent' | 'x' | 'months' | 'number';
function fmt(v: number | null | undefined, f: Fmt) {
  if (v == null || !isFinite(v)) return '—';
  if (f === 'currency') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (f === 'percent') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (f === 'x') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`;
  if (f === 'months') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
function monthLabel(m: string) { return `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`; }
function prev(m: string) { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function Delta({ cur, before, goodUp = true }: { cur: number | null; before: number | null; goodUp?: boolean }) {
  if (cur == null || before == null || before === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const rel = (cur - before) / Math.abs(before);
  const good = goodUp ? rel >= 0 : rel <= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${good ? 'text-success' : 'text-destructive'}`}>
      {rel >= 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {Math.abs(rel * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior
    </span>
  );
}

interface Serie { key: string; label: string; values: (m: string) => number | null }

function IndicadorCard({ title, subtitle, value, before, format, goodUp = true, series, year, children, note, connect }: {
  title: string; subtitle: string; value: number | null; before?: number | null; format: Fmt; goodUp?: boolean; connect?: boolean;
  series: Serie[]; year: string; children?: ReactNode; note?: string;
}) {
  const data = MONTHS.map((label, i) => {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    const row: Record<string, any> = { month: label };
    series.forEach(s => { row[s.key] = s.values(m); });
    return row;
  });
  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="lg:border-r lg:border-border/60 lg:pr-5">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
            <p className={`mt-4 text-2xl font-extrabold ${value != null && value < 0 ? 'text-destructive' : 'text-foreground'}`}>{fmt(value, format)}</p>
            {before !== undefined && <div className="mt-1"><Delta cur={value} before={before ?? null} goodUp={goodUp} /></div>}
            {note && <p className="mt-3 text-[11px] text-muted-foreground">{note}</p>}
            {children && <div className="mt-4 border-t border-border/60 pt-3">{children}</div>}
          </div>
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v, format === 'currency' ? 'number' : format)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v: number, n: string) => [fmt(v, format), n]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {series.map((s, i) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 5 }} connectNulls={!!connect} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-center text-[10px] text-muted-foreground">{year}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GestaoIndicadores({ schoolId, referenceMonth }: Props) {
  const entityId = useEntityFilter();
  const { entities, months: periodMonths } = useGlobalPeriod();
  const [basis] = useResultBasis(schoolId);
  const { groups = [], items = [] } = useExpenseDetail(schoolId) as any;
  const { trips = [] } = useExpenseDetailTrips(schoolId) as any;
  const { data: entries = [] } = useEntries(schoolId);
  const { data: statuses = [] } = useFinancialMonthStatuses(schoolId);
  const { ctx, isInModel, isLoading: ctxLoading } = usePeriodMovementCtx(schoolId);
  const [centro, setCentro] = useState<string>('');
  const [centroPessoa, setCentroPessoa] = useState<string>('todos');

  const { data: realized = [] } = useRealizedEntries(schoolId, entityId);

  const { data: cnpjTotals = [] } = useQuery({
    queryKey: ['entity_monthly_totals_all', schoolId, entities.map(e => e.id).join(',')],
    enabled: entities.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => Promise.all(entities.map(async e => {
      const { data } = await (supabase as any).rpc('entity_monthly_totals', { _school_id: schoolId, _entity_id: e.id });
      return { id: e.id, nome: e.nome, rows: (data || []) as { month: string; tipo_valor: string; valor: number }[] };
    })),
  });

  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { data: fechBase } = useQuery({
    queryKey: ['cnpj_fechamento_base', schoolId],
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { fetchAllRows } = await import('@/lib/fetchAll');
      const [hist, rec] = await Promise.all([
        fetchAllRows<any>('historical_monthly', q => q.select('month,tipo_valor,valor').eq('school_id', schoolId)),
        fetchAllRows<any>('expense_detail_items', q => q.select('data,valor,entity_id,tipo').eq('school_id', schoolId)),
      ]);
      return { hist, rec };
    },
  });
  // Mês -> CNPJ -> {receita, despesa}: ago/set (receita no Realizado) pela função do banco; demais meses pelo fechamento dividido pela receita do Centro de Custos.
  const cnpjMap = useMemo(() => {
    const out = new Map<string, Map<string, { receita: number; despesa: number }>>();
    const rpcMonths = new Set<string>();
    cnpjTotals.forEach(c => c.rows.forEach(r => { if (r.tipo_valor === 'receita' && Number(r.valor) > 0) rpcMonths.add(r.month); }));
    const realRecMonths = new Set((realized as any[]).filter(r => r.tipo === 'receita').map(r => String(r.data).slice(0, 7)));
    cnpjTotals.forEach(c => c.rows.forEach(r => {
      if (!realRecMonths.has(r.month)) return;
      const m = out.get(r.month) ?? new Map(); const a = m.get(c.id) ?? { receita: 0, despesa: 0 };
      if (r.tipo_valor === 'receita') a.receita += Number(r.valor); else a.despesa += Number(r.valor);
      m.set(c.id, a); out.set(r.month, m);
    }));
    if (!fechBase) return out;
    const hist = new Map<string, { receita: number; despesa: number }>();
    fechBase.hist.forEach((row: any) => {
      const rule = resolveLedgerRule(row.tipo_valor, classifications);
      if (!rule.entraNoResultado) return;
      const h = hist.get(row.month) ?? { receita: 0, despesa: 0 };
      if (rule.operacaoSinal === 'somar') h.receita += Number(row.valor); else h.despesa += Number(row.valor);
      hist.set(row.month, h);
    });
    const recEnt = new Map<string, Map<string, { receita: number; custo: number }>>();
    fechBase.rec.forEach((i: any) => {
      if (!i.entity_id) return; const m = String(i.data).slice(0, 7); const e = recEnt.get(m) ?? new Map();
      const a = e.get(i.entity_id) ?? { receita: 0, custo: 0 }; const v = Math.abs(Number(i.valor) || 0);
      if (i.tipo === 'receita') a.receita += v; else a.custo += v;
      e.set(i.entity_id, a); recEnt.set(m, e);
    });
    hist.forEach((h, m) => {
      if (out.has(m)) return;
      const div = dividirPorCnpjDireto(h, recEnt.get(m) ?? new Map());
      if (div) out.set(m, div);
    });
    return out;
  }, [cnpjTotals, fechBase, classifications, realized]);

  const review = useMemo(() => new Set(statuses.filter((s: any) => s.status === 'review').map((s: any) => s.month)), [statuses]);
  const ok = (m: string) => !review.has(m);
  const lastData = useMemo(() => {
    const ms = new Set<string>();
    (realized as any[]).forEach(r => ms.add(String(r.data).slice(0, 7)));
    (items as any[]).forEach(i => ms.add(String(i.data).slice(0, 7)));
    return Array.from(ms).filter(m => m <= referenceMonth && !review.has(m)).sort().at(-1);
  }, [realized, items, referenceMonth, review]);
  const ref = lastData || referenceMonth;
  const year = ref.slice(0, 4);
  const before = prev(ref);

  const gestao = useMemo(() => {
    if (basis === 'caixa') {
      return agregarRealizado((entries as any[]).filter(e => e.tipoRegistro === 'realizado').map(e => ({
        data: e.data, tipo: e.tipo === 'entrada' ? 'receita' : 'despesa', valor: e.valor,
        conta_nome: e.categoria || e.tipoOriginal || '', descricao: e.descricao,
      })));
    }
    return agregarGestaoCompetencia(realized as any, items as any);
  }, [basis, entries, realized, items]);
  const g = (m: string) => (ok(m) ? gestao.get(m) : undefined);

  // Centros: receita/despesa por mês
  const centros = useMemo(() => {
    const map = new Map<string, Map<string, { r: number; d: number }>>();
    for (const it of items as any[]) {
      const m = (it.data || '').slice(0, 7);
      const gm = map.get(it.group_id) ?? new Map();
      const a = gm.get(m) ?? { r: 0, d: 0 };
      if (it.tipo === 'receita') a.r += Math.abs(it.valor); else a.d += Math.abs(it.valor);
      gm.set(m, a); map.set(it.group_id, gm);
    }
    return map;
  }, [items]);
  const pessoas = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of trips as any[]) {
      const m = t.trip_date.slice(0, 7);
      const gm = map.get(t.group_id) ?? new Map();
      gm.set(m, (gm.get(m) ?? 0) + t.paying_people); map.set(t.group_id, gm);
    }
    return map;
  }, [trips]);

  const periodo = (periodMonths.length > 1 ? periodMonths.filter(m => m <= ref) : [ref]).filter(ok);
  const periodoAnt = periodo.map(m => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`);
  const periodoLabel = periodo.length > 1 ? `${monthLabel(periodo[0])} a ${monthLabel(periodo[periodo.length - 1])}` : monthLabel(ref);
  const rankCentros = (groups as any[]).map(gr => {
    const s = somaPeriodo(centros.get(gr.id), periodo);
    return { id: gr.id, name: gr.name, m: s.r > 0 ? margem(s.r, s.d) : null, r: s.r };
  }).filter(c => c.r > 0).sort((a, b) => (b.m ?? -999) - (a.m ?? -999));
  const centroSel = centro || rankCentros[0]?.id || (groups as any[])[0]?.id || '';
  const centroMargem = (m: string) => { const a = centros.get(centroSel)?.get(m); return a && ok(m) ? margem(a.r, a.d) : null; };

  const ppl = (gid: string, m: string) => pessoas.get(gid)?.get(m) ?? 0;
  const custoPessoaTotal = (m: string) => {
    if (!ok(m)) return null;
    let d = 0, p = 0;
    for (const gr of groups as any[]) { const n = ppl(gr.id, m); if (n > 0) { d += centros.get(gr.id)?.get(m)?.d ?? 0; p += n; } }
    return p > 0 ? d / p : null;
  };
  const custoPessoaPeriodo = (ms: string[]) => {
    let d = 0, p = 0;
    for (const gr of groups as any[]) for (const m of ms) { const n = ppl(gr.id, m); if (n > 0) { d += centros.get(gr.id)?.get(m)?.d ?? 0; p += n; } }
    return p > 0 ? d / p : null;
  };
  const centrosPessoa = (groups as any[]).map(gr => {
    const n = periodo.reduce((s, m) => s + ppl(gr.id, m), 0);
    const a = { r: 0, d: 0 }; periodo.forEach(m => { if (ppl(gr.id, m) > 0) { const x = centros.get(gr.id)?.get(m); if (x) { a.r += x.r; a.d += x.d; } } });
    if (!n || !a.r) return null;
    return { id: gr.id, name: gr.name, custo: a.d / n, ticket: a.r / n, lucro: (a.r - a.d) / n };
  }).filter(Boolean).sort((a: any, b: any) => b.lucro - a.lucro) as { id: string; name: string; custo: number; ticket: number; lucro: number }[];
  const semPasseio = (groups as any[]).filter(gr => !centrosPessoa.some(c => c.id === gr.id));
  const pessoaCentro = (gid: string, ms: string[], k: 'd' | 'r') => { let v = 0, p = 0; ms.forEach(m => { const n = ppl(gid, m); if (n > 0) { v += centros.get(gid)?.get(m)?.[k] ?? 0; p += n; } }); return p > 0 ? v / p : null; };
  const cp = centroPessoa !== 'todos' ? centroPessoa : null;

  const fixoMap = useMemo(() => {
    const mm = new Map<string, number>();
    gestao.forEach((v, k) => { if (!review.has(k)) mm.set(k, custoFixo(v)); });
    return mm;
  }, [gestao, review]);
  const fixoMedio = mediaUltimos(fixoMap, ref);

  const futuras = useMemo(() => {
    const mm = new Map<string, number>();
    for (const e of entries as any[]) {
      if (e.tipoRegistro !== 'projetado' || e.tipo !== 'entrada') continue;
      const m = e.data.slice(0, 7);
      if (m <= ref) continue;
      mm.set(m, (mm.get(m) ?? 0) + Math.abs(Number(e.valor) || 0));
    }
    return Array.from(mm.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries, ref]);
  const totalFuturo = futuras.reduce((s, [, v]) => s + v, 0);

  const saldo = (m: string) => { try { return computeSaldoFinal(m, ctx, { isInModel }); } catch { return null; } };
  const folego = (m: string) => {
    if (ctxLoading || !ok(m)) return null;
    const f = mediaUltimos(fixoMap, m); const s = saldo(m);
    return f && s != null ? s / f : null;
  };

  const cnpj = (id: string, m: string, t: string) => { const a = cnpjMap.get(m)?.get(id); return a ? (t === 'receita' ? a.receita : a.despesa) : 0; };
  const cnpjMargem = (id: string) => (m: string) => { if (!ok(m) || !cnpjMap.get(m)?.has(id)) return null; return margem(cnpj(id, m, 'receita'), cnpj(id, m, 'despesa')); };
  const ytd = (id: string, t: string) => { let s = 0; for (let i = 1; i <= Number(ref.slice(5, 7)); i++) { const m = `${year}-${String(i).padStart(2, '0')}`; if (ok(m)) s += cnpj(id, m, t); } return s; };

  if (!ref) return null;
  const cur = g(ref) ?? emptyMes();
  const pre = g(before);

  return (
    <div className="mt-8 space-y-5">
      <div>
        <h2 className="text-lg font-bold">Indicadores de gestão</h2>
        <p className="text-xs text-muted-foreground">Referência: {monthLabel(ref)}. Calculados a partir dos lançamentos, centros de custo e passeios.</p>
      </div>

      <IndicadorCard title="Margem por centro (sempre competência)" subtitle={`(Receitas − despesas) ÷ receitas do centro · ${periodoLabel}`} format="percent" year={year} connect
        value={margemPeriodo(centros.get(centroSel), periodo)} before={periodo.length > 1 ? margemPeriodo(centros.get(centroSel), periodoAnt) : centroMargem(before)}
        series={[{ key: 'c', label: (groups as any[]).find(gr => gr.id === centroSel)?.name ?? 'Centro', values: centroMargem }]}>
        <Select value={centroSel} onValueChange={setCentro}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Centro" /></SelectTrigger>
          <SelectContent>{(groups as any[]).map(gr => <SelectItem key={gr.id} value={gr.id}>{gr.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="mt-3 space-y-1.5">
          {rankCentros.map(c => (
            <button key={c.id} onClick={() => setCentro(c.id)} className={`flex w-full justify-between text-xs ${c.id === centroSel ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
              <span>{c.name}</span><span className={c.m != null && c.m < 0 ? 'text-destructive' : ''}>{fmt(c.m, 'percent')}</span>
            </button>
          ))}
        </div>
      </IndicadorCard>

      <IndicadorCard title="Custo por participante (sempre competência)" subtitle={`Despesas do centro ÷ pagantes, comparado ao ticket médio · ${periodoLabel}`} format="currency" goodUp={false} year={year} connect
        value={cp ? pessoaCentro(cp, periodo, 'd') : custoPessoaPeriodo(periodo)}
        before={cp ? pessoaCentro(cp, periodo.length > 1 ? periodoAnt : [before], 'd') : periodo.length > 1 ? custoPessoaPeriodo(periodoAnt) : custoPessoaTotal(before)}
        note={centrosPessoa.length ? undefined : 'Sem dados de passeios neste período.'}
        series={cp ? [
          { key: 'c', label: 'Custo por pessoa', values: (m: string) => ok(m) ? pessoaCentro(cp, [m], 'd') : null },
          { key: 't', label: 'Ticket médio', values: (m: string) => ok(m) ? pessoaCentro(cp, [m], 'r') : null },
        ] : [{ key: 'c', label: 'Custo por participante', values: custoPessoaTotal }]}>
        <Select value={centroPessoa} onValueChange={setCentroPessoa}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Centro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os centros</SelectItem>
            {(groups as any[]).map(gr => <SelectItem key={gr.id} value={gr.id}>{gr.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="mt-3 space-y-2">
          {centrosPessoa.map(c => (
            <button key={c.id} onClick={() => setCentroPessoa(c.id)} className={`block w-full text-left text-xs rounded-md ${c.id === cp ? 'ring-1 ring-primary p-1' : ''}`}>
              <p className="font-semibold">{c.name}</p>
              <p className="text-muted-foreground">Custo {fmt(c.custo, 'currency')} · Ticket {fmt(c.ticket, 'currency')}</p>
              <p className={c.lucro < 0 ? 'text-destructive' : 'text-success'}>Lucro por pessoa {fmt(c.lucro, 'currency')}</p>
            </button>
          ))}
          {semPasseio.map(gr => (
            <button key={gr.id} onClick={() => setCentroPessoa(gr.id)} className="block w-full text-left text-xs text-muted-foreground">
              {gr.name}: sem passeios no período
            </button>
          ))}
        </div>
      </IndicadorCard>

      <IndicadorCard title={`Peso das despesas (${basis === "caixa" ? "caixa" : "competência"})`} subtitle="Administração, Marketing e Pessoal como % da receita" format="percent" goodUp={false} year={year}
        value={pesoPct(custoFixo(cur), cur.receita)} before={pre ? pesoPct(custoFixo(pre), pre.receita) : null}
        series={[
          { key: 'adm', label: 'Administração', values: m => { const x = g(m); return x ? pesoPct(x.administrativo, x.receita) : null; } },
          { key: 'mkt', label: 'Marketing', values: m => { const x = g(m); return x ? pesoPct(x.marketing, x.receita) : null; } },
          { key: 'pes', label: 'Pessoal', values: m => { const x = g(m); return x ? pesoPct(x.pessoal, x.receita) : null; } },
        ]}>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Administração</span><span>{fmt(pesoPct(cur.administrativo, cur.receita), 'percent')}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Marketing</span><span>{fmt(pesoPct(cur.marketing, cur.receita), 'percent')}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pessoal</span><span>{fmt(pesoPct(cur.pessoal, cur.receita), 'percent')}</span></div>
        </div>
      </IndicadorCard>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">Receita futura garantida</h3>
          <p className="text-xs text-muted-foreground">Receitas previstas já vendidas após {monthLabel(ref)}</p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div><p className="text-2xl font-extrabold">{fmt(totalFuturo, 'currency')}</p><p className="text-[11px] text-muted-foreground">total previsto</p></div>
            <div><p className="text-xl font-bold">{fixoMedio ? fmt(totalFuturo / fixoMedio, 'months') : '—'}</p><p className="text-[11px] text-muted-foreground">de custo fixo coberto (média 3 meses: {fmt(fixoMedio, 'currency')})</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {futuras.map(([m, v]) => (
              <div key={m} className="rounded-lg border border-border/60 p-2 text-xs">
                <p className="text-muted-foreground">{monthLabel(m)}</p>
                <p className="font-semibold">{fmt(v, 'currency')}</p>
              </div>
            ))}
            {futuras.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma receita prevista.</p>}
          </div>
        </CardContent>
      </Card>

      <IndicadorCard title={`Ponto de equilíbrio (${basis === "caixa" ? "caixa" : "competência"})`} subtitle="Receita mínima no mês para não ter prejuízo; sem ponto = custos dos passeios maiores que a receita" format="currency" goodUp={false} year={year}
        value={pontoEquilibrio(cur)} before={pre ? pontoEquilibrio(pre) : null}
        series={[
          { key: 'pe', label: 'Ponto de equilíbrio', values: m => { const x = g(m); return x ? pontoEquilibrio(x) : null; } },
          { key: 'rec', label: 'Receita real', values: m => g(m)?.receita ?? null },
        ]}>
        {(() => { const pe = pontoEquilibrio(cur); if (pe == null) return null; const diff = cur.receita - pe; return (
          <p className={`text-xs font-semibold ${diff < 0 ? 'text-destructive' : 'text-success'}`}>{diff < 0 ? 'Faltaram ' : 'Sobraram '}{fmt(Math.abs(diff), 'currency')}</p>
        ); })()}
      </IndicadorCard>

      <IndicadorCard title={`Retorno do marketing (${basis === "caixa" ? "caixa" : "competência"})`} subtitle="Receita gerada para cada R$ 1 investido em marketing" format="x" year={year}
        value={retornoMarketing(cur)} before={pre ? retornoMarketing(pre) : null}
        series={[{ key: 'r', label: 'Retorno', values: m => { const x = g(m); return x ? retornoMarketing(x) : null; } }]}>
        {(() => { let r = 0, k = 0; for (let i = 1; i <= Number(ref.slice(5, 7)); i++) { const x = g(`${year}-${String(i).padStart(2, '0')}`); if (x) { r += x.receita; k += x.marketing; } } return (
          <p className="text-xs text-muted-foreground">Acumulado {year}: <strong className="text-foreground">{fmt(k > 0 ? r / k : null, 'x')}</strong> ({fmt(k, 'currency')} investidos)</p>
        ); })()}
      </IndicadorCard>

      <IndicadorCard title="Fôlego de caixa (sempre caixa)" subtitle="Saldo final ÷ custo fixo médio dos últimos 3 meses" format="months" year={year}
        value={folego(ref)} before={folego(before)}
        series={[{ key: 'f', label: 'Meses de fôlego', values: folego }]}>
        <p className="text-xs text-muted-foreground">Saldo final: <strong className="text-foreground">{fmt(ctxLoading ? null : saldo(ref), 'currency')}</strong></p>
      </IndicadorCard>

      {entities.length > 1 && (
        <IndicadorCard title="Comparativo por CNPJ (competência)" subtitle="Margem mensal de cada CNPJ" format="percent" year={year}
          value={null}
          note="Receita e custo dos passeios de cada CNPJ pelo Centro de Custos; despesas fixas rateadas."
          series={entities.map(e => ({ key: e.id, label: e.nome, values: cnpjMargem(e.id) }))}>
          <div className="space-y-2">
            {entities.map(e => { const r = ytd(e.id, 'receita'), d = ytd(e.id, 'despesa'); return (
              <div key={e.id} className="text-xs">
                <p className="font-semibold">{e.nome} · acumulado {year}</p>
                {r === 0 && d === 0 ? <p className="text-muted-foreground">Sem divisão</p> : (<>
                  <p className="text-muted-foreground">Receita {fmt(r, 'currency')} · Despesa {fmt(d, 'currency')}</p>
                  <p className={r - d < 0 ? 'text-destructive' : 'text-success'}>Resultado {fmt(r - d, 'currency')} · Margem {fmt(margem(r, d), 'percent')}</p>
                </>)}
              </div>
            ); })}
          </div>
        </IndicadorCard>
      )}
    </div>
  );
}
