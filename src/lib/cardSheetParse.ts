/** Leitor puro das planilhas de cartão (recebimentos das adquirentes e vendas). Só conferência: nunca entra em cálculos financeiros. */
export type CardField = 'data_venda' | 'data_pagamento' | 'bruto' | 'taxa' | 'liquido' | 'bandeira' | 'forma' | 'parcela' | 'nsu';
export const CARD_FIELDS: { key: CardField; label: string }[] = [
  { key: 'data_venda', label: 'Data da venda' }, { key: 'data_pagamento', label: 'Data prevista/paga' },
  { key: 'bruto', label: 'Valor bruto' }, { key: 'taxa', label: 'Taxa' }, { key: 'liquido', label: 'Valor líquido' },
  { key: 'bandeira', label: 'Bandeira' }, { key: 'forma', label: 'Forma (crédito/débito/PIX)' },
  { key: 'parcela', label: 'Parcela' }, { key: 'nsu', label: 'NSU / autorização' },
];
export type ColumnMap = Partial<Record<CardField, number>>;

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const PATTERNS: [CardField, RegExp][] = [
  ['data_pagamento', /(data|dt).*(pagamento|recebimento|prevista|vencimento|credito|liquidacao)|previsao/],
  ['data_venda', /(data|dt).*(venda|transacao|captura|autorizacao)|^data$/],
  ['liquido', /liquido/], ['bruto', /bruto|valor (da )?(venda|transacao)|^valor$/],
  ['taxa', /taxa|tarifa|desconto|mdr/], ['bandeira', /bandeira/],
  ['forma', /forma|produto|modalidade|tipo/], ['parcela', /parcela/], ['nsu', /nsu|autoriza|stone ?id|cod.*transa|^id/],
];

/** Acha a linha de cabeçalho (a primeira com ao menos 3 campos reconhecidos) e sugere o mapeamento. */
export function detectHeader(rows: unknown[][]): { headerRow: number; map: ColumnMap } {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const map: ColumnMap = {};
    (rows[r] ?? []).forEach((c, i) => {
      const h = norm(c);
      if (!h) return;
      const hit = PATTERNS.find(([f, re]) => map[f] === undefined && re.test(h));
      if (hit) map[hit[0]] = i;
    });
    if (Object.keys(map).length >= 3) return { headerRow: r, map };
  }
  return { headerRow: 0, map: {} };
}

export function parseBRNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function parseBRDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export interface CardRow {
  line: number; data_venda: string | null; data_pagamento: string | null;
  bruto: number | null; taxa: number | null; liquido: number | null;
  bandeira: string | null; forma: string | null; parcela: string | null; nsu: string | null;
  row_key: string; raw: Record<string, unknown>;
}
export interface CardSheetResult {
  rows: CardRow[]; skipped: { line: number; motivo: string }[];
  totalBruto: number; totalLiquido: number;
  fileTotal: number | null; fileTotalLine: number | null; diff: number;
  porForma: Record<string, { qtd: number; bruto: number; liquido: number }>;
  porDia: Record<string, { qtd: number; bruto: number; liquido: number }>;
  from: string | null; to: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function parseCardSheet(rows: unknown[][], headerRow: number, map: ColumnMap, kind: 'recebimento' | 'venda'): CardSheetResult {
  const header = (rows[headerRow] ?? []).map(c => String(c ?? ''));
  const get = (r: unknown[], f: CardField) => (map[f] === undefined ? undefined : r[map[f]!]);
  const out: CardRow[] = []; const skipped: CardSheetResult['skipped'] = [];
  let fileTotal: number | null = null; let fileTotalLine: number | null = null;
  const seen = new Map<string, number>();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r.every(c => String(c ?? '').trim() === '')) continue;
    const line = i + 1;
    if (r.some(c => /^total/.test(norm(c)))) {
      const v = parseBRNumber(get(r, 'bruto')) ?? parseBRNumber(get(r, 'liquido'));
      if (v !== null) { fileTotal = v; fileTotalLine = line; }
      skipped.push({ line, motivo: 'Linha de total do arquivo (usada só para conferir)' });
      continue;
    }
    const bruto = parseBRNumber(get(r, 'bruto')); const liquido = parseBRNumber(get(r, 'liquido'));
    const dv = parseBRDate(get(r, 'data_venda')); const dp = parseBRDate(get(r, 'data_pagamento'));
    if (bruto === null && liquido === null) { skipped.push({ line, motivo: 'Sem valor' }); continue; }
    if (!dv && !dp) { skipped.push({ line, motivo: 'Sem data' }); continue; }
    const txt = (f: CardField) => { const v = get(r, f); const s = String(v ?? '').trim(); return s || null; };
    const nsu = txt('nsu'); const parcela = txt('parcela');
    const base = [dv, dp, r2(bruto ?? 0), r2(liquido ?? 0), nsu ?? '', parcela ?? ''].join('|');
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    const raw: Record<string, unknown> = {}; header.forEach((h, k) => { if (h) raw[h] = r[k] ?? null; });
    out.push({ line, data_venda: dv, data_pagamento: dp, bruto, taxa: parseBRNumber(get(r, 'taxa')), liquido,
      bandeira: txt('bandeira'), forma: txt('forma'), parcela, nsu, row_key: `${base}#${n}`, raw });
  }
  const totalBruto = r2(out.reduce((s, x) => s + (x.bruto ?? 0), 0));
  const totalLiquido = r2(out.reduce((s, x) => s + (x.liquido ?? 0), 0));
  const cmp = map.bruto !== undefined ? totalBruto : totalLiquido;
  const diff = fileTotal === null ? 0 : r2(fileTotal - cmp);
  const porForma: CardSheetResult['porForma'] = {}; const porDia: CardSheetResult['porDia'] = {};
  const dates: string[] = [];
  for (const x of out) {
    const f = [x.forma, x.bandeira].filter(Boolean).join(' · ') || 'Não informado';
    const d = (kind === 'recebimento' ? x.data_pagamento ?? x.data_venda : x.data_venda ?? x.data_pagamento)!;
    dates.push(d);
    for (const [bag, k] of [[porForma, f], [porDia, d]] as const) {
      const a = (bag[k] ??= { qtd: 0, bruto: 0, liquido: 0 });
      a.qtd++; a.bruto = r2(a.bruto + (x.bruto ?? 0)); a.liquido = r2(a.liquido + (x.liquido ?? 0));
    }
  }
  dates.sort();
  return { rows: out, skipped, totalBruto, totalLiquido, fileTotal, fileTotalLine, diff, porForma, porDia, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}

/** Quando o total do arquivo não bate, aponta linhas cujo valor sozinho explica a diferença. */
export function suspectLines(res: CardSheetResult, useBruto: boolean): CardRow[] {
  if (Math.abs(res.diff) < 0.01) return [];
  const hit = res.rows.filter(r => Math.abs(Math.abs((useBruto ? r.bruto : r.liquido) ?? 0) - Math.abs(res.diff)) < 0.01);
  return hit.length ? hit : res.rows.filter(r => r.line > 0 && ((useBruto ? r.bruto : r.liquido) ?? 0) < 0);
}
