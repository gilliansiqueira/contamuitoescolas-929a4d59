// Monta os "fatos" (números prontos) dos textos de análise. Regra pura e testada:
// todos os totais saem de calculateTotals/resolveEntryLedgerRule (SSOT); a IA só redige.
import { calculateTotals } from '@/lib/classificationUtils';
import { resolveEntryLedgerRule } from '@/lib/ledgerEngine';
import { remainingDayForecast } from '@/lib/currentDayForecast';
import type { ProjectedEntry } from '@/lib/projectionEngine';
import { buildDailyRows, closingEstimate } from '@/lib/dailyFlow';
import { getAllDaysInMonths } from '@/lib/dateUtils';
import type { TypeClassification } from '@/types/financial';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export function shiftMonth(m: string, n: number): string {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** Variação percentual arredondada (inteiro); null sem base. */
export function pctChange(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
}

export interface KpiSeries { name: string; valueType: string; decimals: number; values: Record<string, number> }

type Cls = TypeClassification[];
function totalsOf(entries: ProjectedEntry[], month: string, cls: Cls, tipo: 'realizado' | 'projetado') {
  return calculateTotals(entries.filter(e => e.tipoRegistro === tipo && e.dataProjetada.startsWith(month)), cls);
}
function expenseByCategory(entries: ProjectedEntry[], months: string[], cls: Cls): Map<string, number> {
  const set = new Set(months);
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.tipoRegistro !== 'realizado' || !set.has(e.dataProjetada.slice(0, 7))) continue;
    const r = resolveEntryLedgerRule(e, cls);
    if (!r.entraNoResultado || r.operacaoSinal === 'somar') continue;
    const k = (e.categoria || e.tipoOriginal || 'Sem categoria').trim();
    map.set(k, (map.get(k) ?? 0) + Math.abs(e.valor));
  }
  return map;
}
/** Maiores aumentos e reduções por categoria (base = valores de comparação). */
export function expenseChanges(cur: Map<string, number>, base: Map<string, number>, n = 3) {
  const keys = new Set([...cur.keys(), ...base.keys()]);
  const diffs = [...keys].map(k => ({ k, atual: cur.get(k) ?? 0, base: base.get(k) ?? 0 }))
    .map(x => ({ ...x, diff: Math.round((x.atual - x.base) * 100) / 100 }))
    .filter(x => Math.abs(x.diff) >= 1);
  return {
    aumentos: diffs.filter(x => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, n),
    reducoes: diffs.filter(x => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, n),
  };
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildReportFacts(p: { schoolName: string; month: string; entries: ProjectedEntry[]; classifications: Cls; kpis: KpiSeries[]; receitaIntegral?: number | null; totalsFor?: (m: string) => { receitas: number; despesas: number } }): string[] {
  const { month, entries, classifications: cls } = p;
  const L: string[] = [];
  const tot = (m: string) => {
    if (p.totalsFor) { const x = p.totalsFor(m); return { receitas: x.receitas, despesas: x.despesas, resultado: x.receitas - x.despesas }; }
    return totalsOf(entries, m, cls, 'realizado');
  };
  const t = tot(month);
  L.push(`Título: Relatório ${p.schoolName} - ${monthName(month)}`);
  const ri = p.receitaIntegral != null && p.receitaIntegral > 0 ? p.receitaIntegral : null;
  if (ri != null) {
    const resInt = ri - t.despesas;
    L.push(`Mês (use nas três linhas do topo): Receitas (integral) ${brl(ri)}, despesas ${brl(t.despesas)}, resultado ${brl(resInt)}.`);
    L.push(`Receita efetivamente recebida no mês: ${brl(t.receitas)} (diferença de ${brl(ri - t.receitas)} para a integral por causa das antecipações).`);
    L.push(`Lucratividade com receita integral (principal): ${num(Math.round((resInt / ri) * 10000) / 100, 2)}%.`);
  } else {
    L.push(`Mês: receitas ${brl(t.receitas)}, despesas ${brl(t.despesas)}, resultado ${brl(t.resultado)}.`);
  }

  const last3 = [1, 2, 3].map(i => tot(shiftMonth(month, -i))).filter(x => x.receitas || x.despesas);
  const prev3 = [4, 5, 6].map(i => tot(shiftMonth(month, -i))).filter(x => x.receitas || x.despesas);
  if (last3.length) {
    const r3 = avg(last3.map(x => x.receitas)), d3 = avg(last3.map(x => x.despesas));
    L.push(`Média dos 3 meses anteriores: receitas ${brl(r3)}, despesas ${brl(d3)}, resultado ${brl(r3 - d3)}.`);
    if (prev3.length) {
      const rp = avg(prev3.map(x => x.receitas)), dp = avg(prev3.map(x => x.despesas));
      const vr = pctChange(r3, rp), vd = pctChange(d3, dp);
      if (vr != null) L.push(`Tendência das receitas (3 meses vs 3 anteriores): ${vr > 0 ? '+' : ''}${vr}% (${brl(r3 - rp)} por mês).`);
      if (vd != null) L.push(`Tendência das despesas (3 meses vs 3 anteriores): ${vd > 0 ? '+' : ''}${vd}% (${brl(d3 - dp)} por mês).`);
    }
  }
  const ly = tot(shiftMonth(month, -12));
  if (ly.receitas || ly.despesas) {
    const vr = pctChange(t.receitas, ly.receitas), vd = pctChange(t.despesas, ly.despesas);
    L.push(`Mesmo mês do ano anterior: receitas ${brl(ly.receitas)}${vr != null ? ` (${vr > 0 ? '+' : ''}${vr}%)` : ''}, despesas ${brl(ly.despesas)}${vd != null ? ` (${vd > 0 ? '+' : ''}${vd}%)` : ''}, resultado ${brl(ly.resultado)}.`);
  }
  // Acumulado do ano x mesmo período do ano anterior
  const ytd = Array.from({ length: Number(month.slice(5, 7)) }, (_, i) => `${month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);
  const ytdLy = ytd.map(m => shiftMonth(m, -12));
  const sum = (ms: string[]) => ms.map(tot).reduce((a, x) => ({ r: a.r + x.receitas, d: a.d + x.despesas }), { r: 0, d: 0 });
  const a = sum(ytd), b = sum(ytdLy);
  if (b.r || b.d) {
    const vr = pctChange(a.r, b.r), vd = pctChange(a.d, b.d);
    L.push(`Acumulado do ano: receitas ${brl(a.r)}${vr != null ? ` (${vr > 0 ? '+' : ''}${vr}% vs ano anterior)` : ''}, despesas ${brl(a.d)}${vd != null ? ` (${vd > 0 ? '+' : ''}${vd}% vs ano anterior)` : ''}.`);
  }
  // Categorias
  const catMonth = expenseByCategory(entries, [month], cls);
  const catYear = expenseByCategory(entries, ytd, cls);
  const catPrev = expenseByCategory(entries, [1, 2, 3].map(i => shiftMonth(month, -i)), cls);
  const top = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
  const ty = top(catYear);
  if (ty.length) L.push(`Maiores despesas no ano: ${ty.map(([k, v]) => `${k} ${brl(v)}`).join('; ')}.`);
  const tm = top(catMonth);
  if (tm.length) L.push(`Maiores despesas no mês: ${tm.map(([k, v]) => {
    const media = (catPrev.get(k) ?? 0) / 3;
    const ch = pctChange(v, media);
    return `${k} ${brl(v)}${ch != null ? ` (${ch > 0 ? '+' : ''}${ch}% vs média dos 3 meses anteriores)` : ''}`;
  }).join('; ')}.`);

  const describeCh = (label: string, base: Map<string, number>) => {
    const { aumentos, reducoes } = expenseChanges(catMonth, base);
    const f = (x: { k: string; atual: number; base: number; diff: number }) => {
      const ch = pctChange(x.atual, x.base);
      return `${x.k} ${brl(x.base)} → ${brl(x.atual)} (${x.diff > 0 ? '+' : '-'}${brl(Math.abs(x.diff))}${ch != null ? `, ${ch > 0 ? '+' : ''}${ch}%` : ''})`;
    };
    if (aumentos.length) L.push(`Despesas que mais aumentaram ${label}: ${aumentos.map(f).join('; ')}.`);
    if (reducoes.length) L.push(`Despesas que mais reduziram ${label}: ${reducoes.map(f).join('; ')}.`);
  };
  const catLy = expenseByCategory(entries, [shiftMonth(month, -12)], cls);
  if (catLy.size) describeCh('vs mesmo mês do ano anterior', catLy);
  if (catPrev.size) describeCh('vs média dos 3 meses anteriores', new Map([...catPrev].map(([k, v]) => [k, v / 3])));

  // KPIs
  for (const k of p.kpis) {
    const v = k.values[month];
    if (v == null) continue;
    const isPct = k.valueType === 'percent' || /%|lucrativ|inadimpl|evas|desconto/i.test(k.name);
    const fmt = (x: number) => isPct ? `${num(x, Math.max(1, k.decimals))}%` : num(x, k.decimals);
    const yearVals = ytd.map(m => k.values[m]).filter((x): x is number => x != null);
    const lyVals = ytdLy.map(m => k.values[m]).filter((x): x is number => x != null);
    const prev = k.values[shiftMonth(month, -1)];
    const parts = [`KPI ${k.name}: ${fmt(v)}`];
    if (prev != null) parts.push(`mês anterior ${fmt(prev)}`);
    if (yearVals.length > 1) parts.push(`média do ano ${fmt(avg(yearVals))}`);
    if (lyVals.length) parts.push(`média do mesmo período do ano anterior ${fmt(avg(lyVals))}`);
    L.push(parts.join(', ') + '.');
  }
  return L;
}

/** Saldo diário previsto do mês: saldo inicial + realizados até ontem, restante de hoje e previstos futuros (SSOT). */
export function projectedDailyBalances(entries: ProjectedEntry[], cls: Cls, saldoInicial: number, today: string, untilMonth: string) {
  const realized = entries.filter(e => e.tipoRegistro === 'realizado');
  const projected = entries.filter(e => e.tipoRegistro === 'projetado');
  const impacts: { d: string; v: number }[] = [
    ...realized.filter(e => e.dataProjetada < today).map(e => ({ d: e.dataProjetada, v: e.impacto })),
    ...realized.filter(e => e.dataProjetada === today).map(e => ({ d: today, v: e.impacto })),
    ...remainingDayForecast(projected.filter(e => e.dataProjetada === today), realized, today, cls).map(e => ({ d: today, v: e.impacto })),
    ...projected.filter(e => e.dataProjetada > today && e.dataProjetada.slice(0, 7) <= untilMonth).map(e => ({ d: e.dataProjetada, v: e.impacto })),
  ].sort((x, y) => x.d.localeCompare(y.d));
  const byDay = new Map<string, number>();
  let s = saldoInicial;
  for (const i of impacts) { s += i.v || 0; byDay.set(i.d, s); }
  return byDay;
}

export interface SimulationLine { nome: string; quantities: Record<string, number> }

/** Saldo diário a partir do saldo conferido do banco (mesma base do alerta de caixa) ou do saldo inicial. */
function futureBalances(entries: ProjectedEntry[], cls: Cls, today: string, untilMonth: string, saldoInicial: number, bank?: { date: string; balance: number } | null) {
  if (!bank) return projectedDailyBalances(entries, cls, saldoInicial, today, untilMonth);
  const baseDate = bank.date > today ? today : bank.date;
  const projected = entries.filter(e => e.tipoRegistro === 'projetado');
  const realized = entries.filter(e => e.tipoRegistro === 'realizado');
  const impacts = remainingDayForecast(projected, realized, today, cls)
    .filter(e => e.dataProjetada.slice(0, 7) <= untilMonth && (e.dataProjetada > baseDate || (baseDate === today && e.dataProjetada === today)))
    .map(e => ({ d: e.dataProjetada, v: e.impacto })).sort((x, y) => x.d.localeCompare(y.d));
  const byDay = new Map<string, number>();
  let s = bank.balance;
  byDay.set(baseDate, s);
  for (const i of impacts) { s += i.v || 0; byDay.set(i.d, s); }
  return byDay;
}

/** Números por mês exatamente como o Fluxo Diário mostra (mesmo `buildDailyRows`/`closingEstimate`). */
export interface FlowMonth { entrada: number; saida: number; days: [string, number][] }
export function dailyFlowByMonth(p: {
  months: string[]; projectedEntries: ProjectedEntry[]; realized: ProjectedEntry[]; classifications: Cls;
  historicalRows: any[]; modelItems: any; sourceOf: (m: string) => string; saldoInicialOf: (m: string) => number; today: string;
}): Record<string, FlowMonth> {
  const out: Record<string, FlowMonth> = {};
  for (const m of p.months) {
    const src = p.sourceOf(m);
    const projected = p.projectedEntries.filter(e => !((e.origem === 'fluxo' && e.tipoRegistro !== 'projetado') || e.impacto === 0) && e.dataProjetada.startsWith(m) && !!src && src !== 'vazio');
    const rows = buildDailyRows({
      allDays: getAllDaysInMonths([m]), priorSaldo: p.saldoInicialOf(m), projected, realized: p.realized.filter(e => e.data.startsWith(m)),
      classifications: p.classifications, historicalRows: p.historicalRows, monthSources: { [m]: src }, modelItems: p.modelItems, todayStr: p.today,
    });
    const t = closingEstimate(rows);
    out[m] = { entrada: t.entrada, saida: t.saida, days: rows.map(r => [r.data, r.saldoFinalProjecao]) };
  }
  return out;
}

export function buildProjectionFacts(p: { schoolName: string; closedMonth: string; entries: ProjectedEntry[]; classifications: Cls; saldoInicial: number; today: string; bankBase?: { date: string; balance: number } | null; simulation?: SimulationLine[]; flow?: Record<string, FlowMonth> }): string[] {
  const { closedMonth, entries, classifications: cls, today } = p;
  const cur = shiftMonth(closedMonth, 1);
  const n1 = shiftMonth(cur, 1), n2 = shiftMonth(cur, 2);
  const L: string[] = [`Empresa: ${p.schoolName}. Hoje: ${today.slice(8, 10)}/${today.slice(5, 7)}. Mês atual: ${monthName(cur)}. O texto deve falar do FUTURO.`];
  const real = totalsOf(entries, closedMonth, cls, 'realizado');
  L.push(`(Contexto, no máximo uma frase) ${monthName(closedMonth)} fechou com resultado ${brl(real.resultado)}.`);
  const bal = futureBalances(entries, cls, today, n2, p.saldoInicial, p.bankBase);
  const daysOf = (m: string): [string, number][] => p.flow ? (p.flow[m]?.days ?? []).filter(([d]) => d >= today) : [...bal.entries()].filter(([d]) => d.startsWith(m) && d >= today).sort((x, y) => x[0].localeCompare(y[0]));
  if (p.bankBase) L.push(`Saldo conferido no banco em ${p.bankBase.date.slice(8, 10)}/${p.bankBase.date.slice(5, 7)}: ${brl(p.bankBase.balance)}.`);
  const days = daysOf(cur);
  if (days.length) {
    const [minD, minV] = days.reduce((a, x) => (x[1] < a[1] ? x : a));
    const end = days[days.length - 1][1];
    L.push(`Caixa de ${monthName(cur)}: menor saldo previsto ${brl(minV)} em ${minD.slice(8, 10)}/${minD.slice(5, 7)}; saldo previsto no fim do mês ${brl(end)}.`);
    const neg = days.find(([, v]) => v < 0);
    L.push(neg ? `RISCO: o caixa fica negativo a partir de ${neg[0].slice(8, 10)}/${neg[0].slice(5, 7)} (pior momento ${brl(minV)} em ${minD.slice(8, 10)}/${minD.slice(5, 7)}). Recomende antecipar recebimentos, renegociar ou adiar pagamentos.` : `Sem risco de faltar dinheiro em ${monthName(cur)} pelo fluxo diário.`);
  }
  const fut = (m: string) => p.flow ? (() => { const f = p.flow![m]; const r = f?.entrada ?? 0, d = f?.saida ?? 0; return { receitas: r, despesas: d, resultado: r - d }; })() : calculateTotals(entries.filter(e => e.dataProjetada.startsWith(m) && (e.tipoRegistro === 'projetado' || (m === cur && e.dataProjetada < today))), cls);
  const c = fut(cur);
  L.push(`${monthName(cur)} previsto (realizado até ontem + previsto): receitas ${brl(c.receitas)}, despesas ${brl(c.despesas)}, resultado ${brl(c.resultado)}.`);
  for (const m of [n1, n2]) {
    const t = fut(m);
    if (!t.receitas && !t.despesas) continue;
    const md = daysOf(m);
    const mn = md.length ? md.reduce((a, x) => (x[1] < a[1] ? x : a)) : null;
    L.push(`${monthName(m)} previsto: receitas ${brl(t.receitas)}, despesas ${brl(t.despesas)}, resultado ${brl(t.resultado)}${mn ? `; menor saldo ${brl(mn[1])} em ${mn[0].slice(8, 10)}/${mn[0].slice(5, 7)}${mn[1] < 0 ? ' (caixa negativo)' : ''}` : ''}.`);
  }
  const months = Array.from({ length: 8 }, (_, i) => shiftMonth(cur, i));
  const sim = (p.simulation ?? []).map(l => ({ nome: l.nome.trim(), qs: months.map(m => [m, l.quantities[m] ?? 0] as const).filter(([, q]) => q > 0) })).filter(l => l.nome && l.qs.length);
  if (sim.length) {
    L.push('Simulação (metas de matrículas e renovações a fazer, use as quantidades exatas, sem R$):');
    for (const l of sim) L.push(`- ${l.nome}: ${l.qs.map(([m, q]) => `${q} em ${monthName(m)}`).join(', ')}; total ${l.qs.reduce((a, [, q]) => a + q, 0)}.`);
  } else {
    L.push('Cenário de matrículas/renovações: não há Simulação; deixar o lembrete [completar cenário de matrículas e renovações].');
  }
  return L;
}

/** Números (R$ e %) do texto que não aparecem nos fatos enviados. */
export function unknownNumbers(text: string, facts: string): string[] {
  const norm = (s: string) => s.replace(/R\$\s?/g, '').replace(/[+\-−]/g, '').trim();
  const allowed = new Set((facts.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) ?? []).map(norm));
  const found = text.match(/(?:R\$\s?)?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?%?/g) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const n = norm(raw.replace('%', ''));
    const isMoney = /R\$/.test(raw) || /\./.test(n) || (/,/.test(n) && !/%/.test(raw));
    const isPct = /%/.test(raw);
    if (!isMoney && !isPct) continue;
    if (/^20\d\d$/.test(n)) continue;
    if (!allowed.has(n)) out.push(raw.trim());
  }
  return [...new Set(out)];
}

/**
 * Lucratividade para o texto: valores de computeProfitability (mesmos do Dashboard).
 * Com receita integral salva, ela é a principal; com operações no mês, mostra os dois cenários.
 */
export function profitabilityFacts(p: { operacional: number | null; total: number | null; integral: number | null; receitaIntegral?: number | null }): string[] {
  const f = (x: number) => `${num(x, 2)}%`;
  const L: string[] = [];
  if (p.integral != null) {
    L.push(`Lucratividade com receita integral (principal, sem o efeito das antecipações${p.receitaIntegral ? `; receita integral ${brl(p.receitaIntegral)}` : ''}): ${f(p.integral)}.`);
    if (p.operacional != null) L.push(`Lucratividade sobre a receita recebida no mês: ${f(p.operacional)}.`);
    return L;
  }
  if (p.operacional == null) return L;
  if (p.total != null && Math.abs(p.total - p.operacional) >= 0.01) {
    L.push(`Dois cenários de lucratividade (cite os dois): operacional, sem empréstimos/antecipações/operações, ${f(p.operacional)}; total, com as operações do mês, ${f(p.total)}.`);
  } else {
    L.push(`Lucratividade do mês: ${f(p.operacional)}.`);
  }
  return L;
}

export interface ConversionRow { month: string; tipo: string; contatos: number; matriculas: number }
export interface CommercialHistoryRow { year: number; month: number; metric: string; value: number }

/** Comercial do mês (receptivo/ativo) + comparação com o ano anterior (plataforma ou histórico importado). */
export function commercialFacts(month: string, conv: ConversionRow[], hist: CommercialHistoryRow[] = []): string[] {
  const L: string[] = [];
  const rowsOf = (m: string) => conv.filter(r => String(r.month).slice(0, 7) === m);
  const cur = rowsOf(month);
  if (!cur.length) return L;
  const conv1 = (c: number, m: number) => (c ? `${num(Math.round((m / c) * 1000) / 10, 1)}% de conversão` : 'sem conversão');
  for (const tipo of ['receptivo', 'ativo']) {
    const r = cur.find(x => x.tipo === tipo);
    if (!r) continue;
    L.push(`Comercial ${tipo === 'receptivo' ? 'Receptivo' : 'Ativo'}: ${r.contatos} contatos → ${r.matriculas} matrículas (${conv1(Number(r.contatos), Number(r.matriculas))}).`);
  }
  const totM = cur.reduce((a, r) => a + Number(r.matriculas || 0), 0);
  const totC = cur.reduce((a, r) => a + Number(r.contatos || 0), 0);
  L.push(`Comercial total do mês: ${totC} contatos e ${totM} matrículas.`);
  // Ano anterior: plataforma se houver lançamento; senão histórico importado.
  const yearTotals = (year: number, upTo: number) => {
    let c = 0, m = 0, found = false;
    const yConv = conv.filter(r => String(r.month).startsWith(`${year}-`));
    if (yConv.length) {
      for (const r of yConv) if (Number(String(r.month).slice(5, 7)) <= upTo) { c += Number(r.contatos || 0); m += Number(r.matriculas || 0); found = true; }
    } else {
      for (const h of hist) if (h.year === year && h.month <= upTo) {
        if (h.metric === 'matriculas') m += Number(h.value); else c += Number(h.value);
        found = true;
      }
    }
    return found ? { c, m } : null;
  };
  const y = Number(month.slice(0, 4)), mo = Number(month.slice(5, 7));
  const sameLy = (() => {
    const lyRows = rowsOf(`${y - 1}-${month.slice(5, 7)}`);
    if (lyRows.length) return { c: lyRows.reduce((a, r) => a + Number(r.contatos || 0), 0), m: lyRows.reduce((a, r) => a + Number(r.matriculas || 0), 0) };
    const hs = hist.filter(h => h.year === y - 1 && h.month === mo);
    if (!hs.length) return null;
    return { c: hs.filter(h => h.metric !== 'matriculas').reduce((a, h) => a + Number(h.value), 0), m: hs.filter(h => h.metric === 'matriculas').reduce((a, h) => a + Number(h.value), 0) };
  })();
  if (sameLy) L.push(`Comercial no mesmo mês do ano anterior: ${sameLy.c} contatos e ${sameLy.m} matrículas (${totM > sameLy.m ? 'acima' : totM < sameLy.m ? 'abaixo' : 'igual'} em matrículas).`);
  const a = yearTotals(y, mo), b = yearTotals(y - 1, mo);
  if (a && b) L.push(`Comercial acumulado do ano: ${a.m} matrículas e ${a.c} contatos; mesmo período do ano anterior: ${b.m} matrículas e ${b.c} contatos (${a.m > b.m ? 'acima' : a.m < b.m ? 'abaixo' : 'igual'} do ano anterior em matrículas).`);
  return L;
}

/** Participação de cada forma de pagamento nas vendas do mês (tela Vendas). */
export function paymentMethodFacts(month: string, sales: { month: string; method_key: string; value: number }[], methods: { method_key: string; label: string }[]): string[] {
  const by = new Map<string, number>();
  for (const s of sales) if (String(s.month).slice(0, 7) === month) by.set(s.method_key, (by.get(s.method_key) ?? 0) + Number(s.value || 0));
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  const parts = [...by.entries()].filter(([, v]) => v).sort((x, y) => y[1] - x[1])
    .map(([k, v]) => `${methods.find(m => m.method_key === k)?.label ?? k} ${num(Math.round((v / total) * 10000) / 100, 2)}%`);
  return [`Forma de pagamento (participação nas vendas do mês): ${parts.join('; ')}.`];
}
