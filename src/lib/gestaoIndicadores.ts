import { classifyMarketingSub } from '@/lib/expenseInsights';

export type GrupoGestao = 'Marketing' | 'Pessoal' | 'Administrativo' | 'Operacional';

function norm(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const PESSOAL_RE = /pro-?labore|salari|folha|funcionari|beneficio|ferias|13|rescis|fgts|inss|vale|reembolso|retirada/;
const ADM_RE = /administrativ|escritorio|contabil|programas|site|juridic|bancari|aluguel|internet|telefon|energia|cursos|software|sistema/;

/** Classifica uma despesa realizada no grupo de gestão (custo fixo x operacional). */
export function classifyGestao(conta: string, descricao: string): GrupoGestao {
  if (classifyMarketingSub(conta, descricao)) return 'Marketing';
  const c = norm(conta);
  if (PESSOAL_RE.test(c)) return 'Pessoal';
  if (ADM_RE.test(c)) return 'Administrativo';
  return 'Operacional';
}

export interface MesGestao {
  receita: number;
  despesa: number;
  marketing: number;
  pessoal: number;
  administrativo: number;
  operacional: number;
}

export function emptyMes(): MesGestao {
  return { receita: 0, despesa: 0, marketing: 0, pessoal: 0, administrativo: 0, operacional: 0 };
}

export function agregarRealizado(rows: { data: string; tipo: string; valor: any; conta_nome: string; descricao: string }[]) {
  const map = new Map<string, MesGestao>();
  for (const r of rows) {
    const m = (r.data || '').slice(0, 7);
    if (!m) continue;
    const agg = map.get(m) ?? emptyMes();
    const v = Math.abs(Number(r.valor) || 0);
    if (r.tipo === 'receita') agg.receita += v;
    else {
      agg.despesa += v;
      const g = classifyGestao(r.conta_nome, r.descricao);
      if (g === 'Marketing') agg.marketing += v;
      else if (g === 'Pessoal') agg.pessoal += v;
      else if (g === 'Administrativo') agg.administrativo += v;
      else agg.operacional += v;
    }
    map.set(m, agg);
  }
  return map;
}

export const custoFixo = (m: MesGestao) => m.marketing + m.pessoal + m.administrativo;

export function margem(receita: number, despesa: number): number | null {
  return receita > 0 ? ((receita - despesa) / receita) * 100 : null;
}

/** Receita mínima para resultado zero: custo fixo ÷ margem de contribuição. */
export function pontoEquilibrio(m: MesGestao): number | null {
  if (m.receita <= 0) return null;
  const mc = (m.receita - m.operacional) / m.receita;
  if (mc <= 0) return null;
  return custoFixo(m) / mc;
}

export function retornoMarketing(m: MesGestao): number | null {
  return m.marketing > 0 ? m.receita / m.marketing : null;
}

export function pesoPct(valor: number, receita: number): number | null {
  return receita > 0 ? (valor / receita) * 100 : null;
}

export function mediaUltimos(map: Map<string, number>, month: string, n = 3): number | null {
  const keys = Array.from(map.keys()).filter(k => k <= month).sort().slice(-n);
  if (!keys.length) return null;
  return keys.reduce((s, k) => s + (map.get(k) ?? 0), 0) / keys.length;
}

/** Pagamentos aos sócios: conta Pro-Labore, bônus ou distribuição de lucro. */
export function excluiSocios(conta: string, descricao: string): boolean {
  const c = norm(conta);
  const d = norm(descricao);
  if (/pro-?\s?labore/.test(c)) return true;
  return /\bbonus\b|distribuicao (de )?lucro/.test(d);
}

/** Nomes das formas de pagamento por código (preenchidos conforme o cliente informar). */
export const FORMAS_PAGAMENTO: Record<string, string> = {
  '685489087': 'Cartão de crédito', '685489090': 'Boleto', '685489098': 'Pix',
  credito: 'Cartão de crédito', debito: 'Cartão de débito', pix: 'PIX', boleto: 'Boleto', dinheiro: 'Dinheiro',
  asaas: 'Asaas (boleto/Pix)', cartao_estimado: 'Cartão de crédito (estimado)',
};
export const nomeForma = (k?: string | null) =>
  !k ? 'Forma não informada' : FORMAS_PAGAMENTO[k] ?? `Forma ${k.slice(-3)}`;

export interface FormaResumo { forma: string; valor: number; qtd: number; pct: number }
/** Agrupa recebimentos por forma de pagamento; % sobre o total (inclui "não informada"). */
export function recebimentosPorForma(rows: { valor: number; payment_method_key?: string | null }[]): FormaResumo[] {
  const map = new Map<string, { valor: number; qtd: number }>();
  rows.forEach(r => {
    const f = nomeForma(r.payment_method_key);
    const a = map.get(f) ?? { valor: 0, qtd: 0 };
    a.valor += Math.abs(Number(r.valor) || 0); a.qtd += 1; map.set(f, a);
  });
  const total = Array.from(map.values()).reduce((s, a) => s + a.valor, 0);
  return Array.from(map, ([forma, a]) => ({ forma, ...a, pct: total ? (a.valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

/** Divide o fechamento consolidado do mês entre CNPJs pela participação na receita; a soma sempre bate com o total. */
export function dividirPorCnpj(total: { receita: number; despesa: number }, receitaPorCnpj: Map<string, number>) {
  const soma = Array.from(receitaPorCnpj.values()).reduce((s, v) => s + v, 0);
  if (soma <= 0) return null;
  const out = new Map<string, { receita: number; despesa: number }>();
  receitaPorCnpj.forEach((v, id) => { const p = v / soma; out.set(id, { receita: total.receita * p, despesa: total.despesa * p }); });
  return out;
}

/** Competência: custo dos passeios = despesas do Centro de Custos (mês do passeio); fixos (Marketing/Pessoal/Adm) do Realizado. */
export function agregarGestaoCompetencia(
  realized: { data: string; tipo: string; valor: any; conta_nome: string; descricao: string }[],
  items: { data: string; tipo: string; valor: any }[],
) {
  const map = agregarRealizado(realized);
  const rec = new Map<string, number>(); const cust = new Map<string, number>();
  items.forEach(i => { const m = String(i.data).slice(0, 7); const v = Math.abs(Number(i.valor) || 0);
    if (i.tipo === 'receita') rec.set(m, (rec.get(m) ?? 0) + v); else cust.set(m, (cust.get(m) ?? 0) + v); });
  new Set([...rec.keys(), ...cust.keys()]).forEach(m => {
    const a = map.get(m) ?? emptyMes();
    const r = rec.get(m) ?? 0;
    if (a.receita < r * 0.5) a.receita = r;
    if (cust.has(m)) { a.operacional = cust.get(m)!; a.despesa = custoFixo(a) + a.operacional; }
    map.set(m, a);
  });
  return map;
}

/**
 * Divide o fechamento do mês por CNPJ com margem própria: receita e custo dos passeios
 * de cada CNPJ vêm do Centro de Custos; o restante da despesa (fixos) é rateado pela receita.
 * A soma dos CNPJs sempre bate com o total.
 */
export function dividirPorCnpjDireto(
  total: { receita: number; despesa: number },
  porCnpj: Map<string, { receita: number; custo: number }>,
) {
  const somaR = Array.from(porCnpj.values()).reduce((s, v) => s + v.receita, 0);
  if (somaR <= 0) return null;
  const somaC = Array.from(porCnpj.values()).reduce((s, v) => s + v.custo, 0);
  const custoUsado = Math.min(somaC, total.despesa);
  const k = somaC > 0 ? custoUsado / somaC : 0;
  const fixos = total.despesa - custoUsado;
  const out = new Map<string, { receita: number; despesa: number }>();
  porCnpj.forEach((v, id) => { const p = v.receita / somaR; out.set(id, { receita: total.receita * p, despesa: v.custo * k + fixos * p }); });
  return out;
}

/** Soma receita/despesa de um centro nos meses do período e calcula a margem acumulada. */
export function somaPeriodo(byMonth: Map<string, { r: number; d: number }> | undefined, months: string[]): { r: number; d: number } {
  const out = { r: 0, d: 0 };
  months.forEach(m => { const a = byMonth?.get(m); if (a) { out.r += a.r; out.d += a.d; } });
  return out;
}
export const margemPeriodo = (byMonth: Map<string, { r: number; d: number }> | undefined, months: string[]) => {
  const s = somaPeriodo(byMonth, months); return s.r > 0 ? margem(s.r, s.d) : null;
};
