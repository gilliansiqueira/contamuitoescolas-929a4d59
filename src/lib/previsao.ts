/** Previsão do futuro: funções puras (sem banco). */

export const CENTROS_ECO = ['Caiaques', 'Montanhas', 'Passeios Locais'] as const;
export type CentroEco = typeof CENTROS_ECO[number];

export interface CentroPremissa { ticket: number; custoPessoa: number; ajustePct: number }
export interface ModeloExpedicao { centro: string; participantes: number; ticket: number | null; custoPessoa: number | null }
export interface ExpedicaoSimulada {
  id: string;
  centro: string;
  nome: string;
  participantes: number;
  ticket: number | null;
  custoPessoa: number | null;
  entradasPct: Record<string, number>;
  saidasPct: Record<string, number>;
}
export interface Premissas {
  escritorio: number;
  proLaboreSocio: number; // a partir de jan/2027
  proLaboreSocio2026?: number; // até dez/2026
  socios: number;
  folha: number; // a partir de jan/2027
  folha2026?: number; // até dez/2026
  ajustesMes?: Record<string, { proLabore?: number; folha?: number; expReceita?: number; expCusto?: number; impostosExtra?: number }>;
  marketing: number;
  impostoPct: number; // % sobre a receita da Ecoturismo
  centros: Record<CentroEco, CentroPremissa>;
  novasExpedicoes?: ExpedicaoSimulada[];
  baseEco?: 'competencia' | 'caixa';
}

/** Historical totals are weighted by paying participants, never averages of averages. */
export function modelosExpedicoes(trips: TripRow[], items: ItemRow[], centros: string[], ano = '2025'): ModeloExpedicao[] {
  return centros.filter(c => c !== 'A classificar' && c !== 'Outros Passeios' && !centroDoGrupo(c)).map(centro => valoresPorPessoa(trips, items, centro, ano));
}

function valoresPorPessoa(trips: TripRow[], items: ItemRow[], centro: string, ano: string): ModeloExpedicao {
  {
    const historico = trips.filter(t => t.group_name === centro && t.trip_date.startsWith(ano));
    const participantes = historico.reduce((s, t) => s + Math.max(0, Number(t.paying_people) || 0), 0);
    const receita = historico.reduce((s, t) => s + (Number(t.revenue) || 0), 0);
    const despesas = items.filter(i => i.group_name === centro && i.tipo === 'despesa' && i.data.startsWith(ano));
    const custo = despesas.reduce((s, i) => s + Math.abs(Number(i.valor) || 0), 0);
    return { centro, participantes, ticket: participantes > 0 ? Math.round(receita / participantes * 100) / 100 : null,
      custoPessoa: participantes > 0 && despesas.length > 0 ? Math.round(custo / participantes * 100) / 100 : null };
  }
}

export function distribuicaoValida(pct: Record<string, number>, meses: string[]): boolean {
  const entries = Object.entries(pct);
  return entries.every(([m, v]) => meses.includes(m) && Number.isFinite(v) && v >= 0 && v <= 100)
    && Math.abs(entries.reduce((s, [, v]) => s + v, 0) - 100) < 0.00001;
}

export function valoresExpedicao(e: ExpedicaoSimulada, meses: string[]) {
  const receita = Math.max(0, e.participantes) * Math.max(0, e.ticket ?? 0);
  const custo = Math.max(0, e.participantes) * Math.max(0, e.custoPessoa ?? 0);
  const pronta = e.ticket !== null && e.custoPessoa !== null && distribuicaoValida(e.entradasPct, meses) && distribuicaoValida(e.saidasPct, meses);
  const distribuir = (total: number, pct: Record<string, number>) => {
    const out: Record<string, number> = {};
    let usado = 0;
    const ativos = meses.filter(m => (pct[m] || 0) > 0);
    ativos.forEach((m, i) => {
      const centavos = i === ativos.length - 1 ? Math.round(total * 100) - usado : Math.round(total * (pct[m] || 0));
      out[m] = centavos / 100; usado += centavos;
    });
    return out;
  };
  return { receita, custo, pronta, entradas: pronta ? distribuir(receita, e.entradasPct) : {}, saidas: pronta ? distribuir(custo, e.saidasPct) : {} };
}

export interface Base2025 {
  /** participantes por centro e mês do ano (1–12) */
  pessoas: Record<CentroEco, number[]>;
  premissas: Premissas;
}

export interface TripRow { group_name: string; trip_date: string; paying_people: number; revenue: number }
export interface ItemRow { group_name: string; data: string; tipo: string; valor: number }

/** Centros de passeio de 2025 que ficaram como "A classificar" são os avulsos/Chapada → Outros Passeios. */
export function centroDoGrupo(nome: string): CentroEco | null {
  if (nome === 'A classificar' || nome === 'Outros Passeios') return null;
  return (CENTROS_ECO as readonly string[]).includes(nome) ? (nome as CentroEco) : null;
}

export function calcularBase2025(trips: TripRow[], items: ItemRow[], extra: { escritorio: number; impostoPct: number; anoValores?: Partial<Record<CentroEco, string>> }): Base2025 {
  const pessoas = Object.fromEntries(CENTROS_ECO.map(c => [c, Array(12).fill(0)])) as Record<CentroEco, number[]>;
  const rec: Record<string, number> = {}; const ppl: Record<string, number> = {}; const custo: Record<string, number> = {};
  trips.forEach(t => {
    if (!t.trip_date.startsWith('2025')) return;
    const c = centroDoGrupo(t.group_name); if (!c) return;
    const m = Number(t.trip_date.slice(5, 7)) - 1;
    pessoas[c][m] += Number(t.paying_people) || 0;
    ppl[c] = (ppl[c] ?? 0) + (Number(t.paying_people) || 0);
    rec[c] = (rec[c] ?? 0) + (Number(t.revenue) || 0);
  });
  items.forEach(i => {
    if (!i.data.startsWith('2025') || i.tipo !== 'despesa') return;
    const c = (CENTROS_ECO as readonly string[]).includes(i.group_name) ? i.group_name : null; if (!c) return;
    custo[c] = (custo[c] ?? 0) + Math.abs(Number(i.valor) || 0);
  });
  const centros = Object.fromEntries(CENTROS_ECO.map(c => {
    const ano = extra.anoValores?.[c];
    if (ano) {
      const m = valoresPorPessoa(trips, items, c, ano);
      return [c, { ticket: m?.ticket ?? 0, custoPessoa: m?.custoPessoa ?? 0, ajustePct: 0 }];
    }
    return [c, {
      ticket: ppl[c] ? Math.round((rec[c] / ppl[c]) * 100) / 100 : 0,
      custoPessoa: ppl[c] ? Math.round(((custo[c] ?? 0) / ppl[c]) * 100) / 100 : 0,
      ajustePct: 0,
    }];
  })) as Record<CentroEco, CentroPremissa>;
  return {
    pessoas,
    premissas: { escritorio: extra.escritorio, proLaboreSocio2026: PRO_LABORE_2026_PADRAO, proLaboreSocio: 10000, socios: 3, folha2026: FOLHA_2026_PADRAO, folha: 4000, marketing: 16500, impostoPct: extra.impostoPct, centros, ajustesMes: {} },
  };
}

export interface LinhaMes {
  month: string;
  receitaEco: number;
  porCentro: Record<CentroEco, { pessoas: number; receita: number; custo: number }>;
  custoPasseios: number;
  impostos: number;
  fixos: number;
  proLabore: number; // total dos sócios no mês
  folha: number;
  expedicoes: number;
  novasExpedicoes: number;
  custoExpedicoes: number;
  impostosExtra: number;
  brutoEco: number;
  brutoExp: number;
  resultado: number;
  resultadoEco: number;
  real: boolean;
  acumulado: number;
}

export function mesesPrevisao(inicio: string, fim: string): string[] {
  const out: string[] = []; let [y, m] = inicio.split('-').map(Number);
  while (`${y}-${String(m).padStart(2, '0')}` <= fim) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

export const PRO_LABORE_2026_PADRAO = 7000;
export const FOLHA_2026_PADRAO = 12481.96;

/** Valores padrão do mês: até dez/2026 usa os campos de 2026; depois, os de 2027+. */
export function padraoMes(p: Premissas, month: string) {
  const ate2026 = month <= '2026-12';
  return {
    proLabore: ate2026 ? (p.proLaboreSocio2026 ?? PRO_LABORE_2026_PADRAO) : p.proLaboreSocio,
    folha: ate2026 ? (p.folha2026 ?? FOLHA_2026_PADRAO) : p.folha,
  };
}
export function valoresMes(p: Premissas, month: string) {
  const d = padraoMes(p, month); const a = p.ajustesMes?.[month] || {};
  return { proLabore: a.proLabore ?? d.proLabore, folha: a.folha ?? d.folha };
}

/** Expedições de 2026 por mês do ano ("01".."12"), repetidas em 2027. */
export interface BaseExpedicoes { receita: Record<string, number>; custo: Record<string, number> }
export function valoresExpedicaoMes(p: Premissas, month: string, b?: BaseExpedicoes) {
  const a = p.ajustesMes?.[month] || {};
  const usaBase = !!b && month >= '2027-01';
  const mm = month.slice(5, 7);
  return { receita: a.expReceita ?? (usaBase ? b!.receita[mm] || 0 : 0), custo: a.expCusto ?? (usaBase ? b!.custo[mm] || 0 : 0) };
}

/** Mês corrente pelo caixa: realizado até hoje + previsto depois, separado por CNPJ. */
export interface MesAtual { receitaEco: number; custoEco: number; receitaExp: number; custoExp: number; fixos: number }

/** Resultado da Ecoturismo: bruto − impostos − parte dos fixos proporcional à receita dela no mês. */
export function resultadoEco(brutoEco: number, impostos: number, fixos: number, receitaEco: number, receitaExp: number): number {
  const tot = receitaEco + receitaExp;
  const share = tot > 0 ? receitaEco / tot : 0;
  return brutoEco - impostos - fixos * share;
}

/** Sazonalidade de caixa 2025: fração do ano em cada mês (índice 0–11). */
export function sazonalidade(valores: number[]): number[] {
  const t = valores.reduce((s, v) => s + Math.max(0, v), 0);
  return valores.map(v => (t > 0 ? Math.max(0, v) / t : 1 / 12));
}

export function calcularPrevisao(base: Base2025, p: Premissas, meses: string[], expedicoesPorMes: Record<string, number>, baseExp?: BaseExpedicoes,
  extra?: { atual?: Record<string, MesAtual>; caixa2025?: { receita: number[]; despesa: number[] } }): LinhaMes[] {
  let acc = 0;
  const caixa = p.baseEco === 'caixa' && extra?.caixa2025;
  const sazR = caixa ? sazonalidade(extra!.caixa2025!.receita) : null;
  const sazD = caixa ? sazonalidade(extra!.caixa2025!.despesa) : null;
  // Totais anuais de competência, redistribuídos pela sazonalidade do caixa de 2025
  const anual = { r: 0, c: 0 };
  if (caixa) for (let mi = 0; mi < 12; mi++) CENTROS_ECO.forEach(c => {
    const cp = p.centros[c]; const pes = Math.round((base.pessoas[c][mi] || 0) * (1 + (cp.ajustePct || 0) / 100));
    anual.r += pes * cp.ticket; anual.c += pes * cp.custoPessoa;
  });
  return meses.map(month => {
    const vm = valoresMes(p, month);
    const proLabore = vm.proLabore * p.socios, folha = vm.folha;
    const fixos = p.escritorio + proLabore + folha + p.marketing;
    const mi = Number(month.slice(5, 7)) - 1;
    const porCentro = {} as LinhaMes['porCentro'];
    let receitaEco = 0, custoPasseios = 0;
    CENTROS_ECO.forEach(c => {
      const cp = p.centros[c];
      const pessoas = Math.round((base.pessoas[c][mi] || 0) * (1 + (cp.ajustePct || 0) / 100));
      const receita = pessoas * cp.ticket, custo = pessoas * cp.custoPessoa;
      porCentro[c] = { pessoas, receita, custo };
      receitaEco += receita; custoPasseios += custo;
    });
    if (sazR && sazD) { receitaEco = anual.r * sazR[mi]; custoPasseios = anual.c * sazD[mi]; }
    const at = extra?.atual?.[month];
    let fixosM = fixos;
    if (at) { receitaEco = at.receitaEco; custoPasseios = at.custoEco; fixosM = at.fixos; }
    const impostos = at ? 0 : receitaEco * (p.impostoPct / 100);
    const expedicoes = at ? at.receitaExp : expedicoesPorMes[month] || 0;
    const ve = valoresExpedicaoMes(p, month, baseExp);
    const novasExpedicoes = at ? 0 : ve.receita, custoExpedicoes = at ? at.custoExp : ve.custo;
    const impostosExtra = p.ajustesMes?.[month]?.impostosExtra ?? 0;
    const brutoEco = receitaEco - custoPasseios;
    const brutoExp = expedicoes + novasExpedicoes - custoExpedicoes;
    const resultado = brutoEco + brutoExp - impostos - impostosExtra - fixosM;
    const resEco = resultadoEco(brutoEco, impostos, fixosM, receitaEco, expedicoes + novasExpedicoes);
    acc += resultado;
    return { month, receitaEco, porCentro, custoPasseios, impostos, fixos: fixosM, proLabore, folha, expedicoes, novasExpedicoes, custoExpedicoes, impostosExtra, brutoEco, brutoExp, resultado, resultadoEco: resEco, real: !!at, acumulado: acc };
  });
}
