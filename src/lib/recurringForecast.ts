/**
 * Detecção pura de contas recorrentes (fixas) a partir do extrato classificado.
 * Só sugere: a equipe confirma antes de virar previsão. Nunca calcula saldo/resultado.
 */
export interface RecurringTx { data: string; descricao: string; valor: number; tipo: 'entrada' | 'saida'; categoria: string }
export interface RecurringSuggestion { key: string; descricao: string; tipo: 'entrada' | 'saida'; categoria: string; valor: number; dia: number; meses: number }

const SKIP = /^(a classificar|ignorar|operação|operacao)$/i;

export function normalizeDesc(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9./\-*]+/g, ' ').replace(/\b(pix|ted|doc|pagamento|pagto|pgto|enviado|recebido|transf|transferencia)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Recorrente = aparece em >= minMonths meses distintos, com total mensal variando no máximo `maxVariation` em torno da mediana. */
export function detectRecurring(txs: RecurringTx[], opts: { minMonths?: number; maxVariation?: number } = {}): RecurringSuggestion[] {
  const minMonths = opts.minMonths ?? 3; const maxVar = opts.maxVariation ?? 0.25;
  const groups = new Map<string, RecurringTx[]>();
  for (const t of txs) {
    if (!t.categoria || SKIP.test(t.categoria.trim())) continue;
    const d = normalizeDesc(t.descricao); if (d.length < 3) continue;
    const k = `${t.tipo}|${d}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  const out: RecurringSuggestion[] = [];
  for (const [key, rows] of groups) {
    const byMonth = new Map<string, number>();
    for (const r of rows) byMonth.set(r.data.slice(0, 7), (byMonth.get(r.data.slice(0, 7)) ?? 0) + Math.abs(r.valor));
    if (byMonth.size < minMonths) continue;
    const totals = [...byMonth.values()]; const med = median(totals);
    if (med <= 0 || totals.some(v => Math.abs(v - med) / med > maxVar)) continue;
    const cats = new Map<string, number>(); rows.forEach(r => cats.set(r.categoria, (cats.get(r.categoria) ?? 0) + 1));
    out.push({
      key, descricao: rows[rows.length - 1].descricao.trim(), tipo: rows[0].tipo,
      categoria: [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0],
      valor: Math.round(med * 100) / 100, dia: Math.round(median(rows.map(r => Number(r.data.slice(8, 10))))), meses: byMonth.size,
    });
  }
  return out.sort((a, b) => b.valor - a.valor);
}
