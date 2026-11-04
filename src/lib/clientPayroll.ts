/** Folha e benefícios dos funcionários das empresas clientes — regras puras, sem banco. Fora de qualquer cálculo financeiro. */

const cents = (n: number) => Math.round(n * 100) / 100;

export interface PayrollCalcInput { dias: number | null; vrDiario: number; vtDiario: number; recebeVt: boolean; liquido: number | null }

/** VR = VR/dia × dias; VT = VT/dia × dias (se recebe VT); PIX = líquido + VR + VT. */
export function computeClientPayroll(i: PayrollCalcInput) {
  const dias = Math.max(0, i.dias ?? 0);
  const vr = cents(dias * (i.vrDiario || 0));
  const vt = i.recebeVt ? cents(dias * (i.vtDiario || 0)) : 0;
  const pix = cents((i.liquido ?? 0) + vr + vt);
  return { dias, vr, vt, pix };
}

/** Dias úteis (seg–sex) do mês YYYY-MM. */
export function weekdaysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= last; d++) { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

export const normName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Converte "1.234,56" (ou 1234.56) em número. */
export function parseBRL(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = s.replace(/R\$|\s/g, '');
  if (!t) return null;
  const n = /,\d{1,2}$/.test(t) ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export interface HoleriteLine { nome: string; liquido: number }
export interface Employee { id: string; nome: string }

/** Casa cada holerite com o cadastro pelo nome (exato, ou todas as palavras do nome cadastrado presentes). */
export function matchHolerites(lines: HoleriteLine[], employees: Employee[]) {
  const matched: { employee: Employee; line: HoleriteLine }[] = [];
  const unmatched: HoleriteLine[] = [];
  for (const l of lines) {
    const n = normName(l.nome);
    const words = new Set(n.split(' '));
    const emp = employees.find(e => normName(e.nome) === n)
      ?? employees.find(e => { const w = normName(e.nome).split(' ').filter(x => x.length > 2); return w.length >= 2 && w.every(x => words.has(x)); });
    if (emp && !matched.some(m => m.employee.id === emp.id)) matched.push({ employee: emp, line: l }); else unmatched.push(l);
  }
  const missing = employees.filter(e => !matched.some(m => m.employee.id === e.id));
  return { matched, unmatched, missing };
}

/** Confere a soma dos líquidos com o total impresso; devolve a diferença (0 = bate). */
export function totalDifference(lines: HoleriteLine[], printedTotal: number | null): number {
  if (printedTotal == null) return 0;
  return cents(lines.reduce((s, l) => s + l.liquido, 0) - printedTotal);
}

/** Remove vias repetidas do mesmo holerite (mesmo nome e mesmo líquido). */
export function dedupeHolerites(lines: HoleriteLine[]): HoleriteLine[] {
  const seen = new Set<string>();
  return lines.filter(l => { const k = `${normName(l.nome)}|${l.liquido.toFixed(2)}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * Lê holerites a partir das linhas de texto de cada página.
 * Para cada página: valor da linha com "LÍQUIDO" (exceto "total") e nome do funcionário
 * (cadastrado presente no texto ou linha após "Nome"/"Funcionário").
 * Total impresso: linha com "TOTAL" e "LÍQUIDO".
 */
export function parseHoleriteText(pages: string[][], employees: Employee[]): { lines: HoleriteLine[]; printedTotal: number | null } {
  const money = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
  const out: HoleriteLine[] = [];
  let printedTotal: number | null = null;
  for (const page of pages) {
    // Uma página pode ter mais de um holerite: corta em blocos que terminam numa linha de líquido.
    let block: string[] = [];
    for (let i = 0; i < page.length; i++) {
      const line = page[i];
      block.push(line);
      const n = normName(line);
      if (!/LIQUIDO/.test(n)) continue;
      const vals = line.match(money) ?? (page[i + 1]?.match(money) ?? []);
      const v = vals.length ? parseBRL(vals[vals.length - 1]) : null;
      if (v == null) continue;
      if (/TOTAL/.test(n) && !/RECEBER/.test(n)) { printedTotal = v; block = []; continue; }
      const text = normName(block.join(' '));
      const emp = employees.find(e => text.includes(normName(e.nome)));
      let nome = emp?.nome ?? null;
      if (!nome) {
        const idx = block.findIndex(b => /^(NOME|FUNCIONARIO|EMPREGADO|COLABORADOR)\b/.test(normName(b)));
        if (idx >= 0) {
          const same = block[idx].replace(/^\s*(nome|funcion[aá]rio|empregado|colaborador)[^:]*:?\s*/i, '').replace(/\d.*$/, '').trim();
          nome = same.length > 3 ? same : (block[idx + 1] ?? '').replace(/\d.*$/, '').trim();
        }
      }
      if (nome) out.push({ nome, liquido: v });
      block = [];
    }
  }
  return { lines: dedupeHolerites(out), printedTotal };
}

/** Planilha: procura colunas de nome e líquido no cabeçalho. */
export function parseHoleriteRows(rows: unknown[][]): HoleriteLine[] {
  const hi = rows.findIndex(r => r.some(c => /nome|funcion/i.test(String(c ?? ''))) && r.some(c => /l[ií]quido/i.test(String(c ?? ''))));
  if (hi < 0) return [];
  const h = rows[hi].map(c => String(c ?? ''));
  const ni = h.findIndex(c => /nome|funcion/i.test(c));
  const li = h.findIndex(c => /l[ií]quido/i.test(c));
  const out: HoleriteLine[] = [];
  for (const r of rows.slice(hi + 1)) {
    const nome = String(r[ni] ?? '').trim();
    const v = parseBRL(r[li] as any);
    if (nome && v != null && !/^total/i.test(nome)) out.push({ nome, liquido: v });
  }
  return dedupeHolerites(out);
}
