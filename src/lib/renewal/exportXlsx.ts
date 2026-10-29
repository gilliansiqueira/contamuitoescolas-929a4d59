import ExcelJS from 'exceljs';
import type { RenewalColumn, RenewalRow, TemplateStructure } from './types';
import { cellValue, isRenewedFor } from './types';
import { withFieldDefaults } from './fields';

const letter = (n: number) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export interface SummaryLine { professor: string; turmas: number; alunos: number; renovados: number }

export const SEM_PROFESSOR = 'Sem professor';
const byName = (a: string, b: string) => (a === SEM_PROFESSOR ? 1 : b === SEM_PROFESSOR ? -1 : a.localeCompare(b));
const byProfessor = (a: SummaryLine, b: SummaryLine) => byName(a.professor, b.professor);

/** Resumo por professor: turmas distintas (sem precisar apagar repetidas), alunos e renovados. */
export function computeSummary(rows: RenewalRow[], columns: RenewalColumn[]): SummaryLine[] {
  const pc = columns.find(c => c.field === 'professor');
  const tc = columns.find(c => c.field === 'turma');
  const sc = columns.find(c => c.field === 'status_renovacao');
  if (!pc) return [];
  const map = new Map<string, { turmas: Set<string>; alunos: number; renovados: number }>();
  for (const r of rows) {
    const p = String(cellValue(r, pc) ?? '').trim() || SEM_PROFESSOR;
    const e = map.get(p) ?? { turmas: new Set(), alunos: 0, renovados: 0 };
    if (tc) e.turmas.add(String(cellValue(r, tc) ?? ''));
    e.alunos++;
    if (sc && isRenewedFor(sc, cellValue(r, sc))) e.renovados++;
    map.set(p, e);
  }
  return [...map.entries()].map(([professor, e]) => ({ professor, turmas: e.turmas.size, alunos: e.alunos, renovados: e.renovados })).sort(byProfessor);
}

function paint(c: ExcelJS.Cell, argb?: string) {
  if (!argb) return;
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  const n = parseInt(argb.slice(2), 16); const lum = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  c.font = { ...(c.font ?? {}), color: { argb: lum < 140 ? 'FFFFFFFF' : 'FF000000' } };
}

function toCell(v: any, col: RenewalColumn) {
  if (v == null || v === '') return null;
  if (col.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  if (col.type === 'number' && typeof v !== 'number' && !isNaN(Number(v))) return Number(v);
  return v;
}

function writeSheet(ws: ExcelJS.Worksheet, rows: RenewalRow[], columns: RenewalColumn[], structure: TemplateStructure | null) {
  const cols = columns.filter(c => !c.hidden).map(withFieldDefaults);
  const headerColor = structure?.headerColor ?? 'FF002060';
  const pIdx = cols.findIndex(c => c.field === 'professor') + 1;
  const tIdx = cols.findIndex(c => c.field === 'turma') + 1;
  const sCol = cols.find(c => c.field === 'status_renovacao');
  const sIdx = sCol ? cols.indexOf(sCol) + 1 : 0;
  const siCol = cols.find(c => c.field === 'situacao_contrato');
  const siIdx = siCol ? cols.indexOf(siCol) + 1 : 0;
  const profOf = (r: RenewalRow) => String(cellValue(r, cols[pIdx - 1]) ?? '').trim() || SEM_PROFESSOR;
  const professors = pIdx > 0 ? [...new Set(rows.map(profOf))].sort(byName) : [];
  const withSummary = pIdx > 0 && (structure?.summary.byProfessor ?? true);
  const summaryRows = withSummary ? Math.max(professors.length + 1, sCol?.options?.length ?? 0, siCol?.options?.length ?? 0) + 1 : 0;
  const headerRow = withSummary ? summaryRows + 3 : 1;
  const a = headerRow + 1, b = headerRow + Math.max(rows.length, 1);
  const rng = (i: number) => `$${letter(i)}$${a}:$${letter(i)}$${b}`;
  const style = (c: ExcelJS.Cell) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; };

  if (withSummary) {
    const top = 2;
    ['Professores', 'Qtd. de Turmas', 'Qtd. de Alunos', 'Qtd. de Renovados', '%Renovados'].forEach((h, i) => { const c = ws.getCell(top, 2 + i); c.value = h; style(c); });
    professors.forEach((p, i) => {
      const r = top + 1 + i;
      ws.getCell(r, 2).value = p;
      ws.getCell(r, 3).value = tIdx ? { formula: `SUMPRODUCT((${rng(pIdx)}=B${r})/COUNTIFS(${rng(tIdx)},${rng(tIdx)}&"",${rng(pIdx)},${rng(pIdx)}&""))` } as any : null;
      ws.getCell(r, 4).value = { formula: `COUNTIF(${rng(pIdx)},B${r})` } as any;
      const pats = sCol?.renewedOptions?.length ? sCol.renewedOptions : ['Renovad*', 'Rematricul*'];
      ws.getCell(r, 5).value = sIdx ? { formula: pats.map(o => `COUNTIFS(${rng(pIdx)},B${r},${rng(sIdx)},"${o.replace(/"/g, '')}")`).join('+') } as any : null;
      ws.getCell(r, 6).value = { formula: `IF(D${r}=0,0,E${r}/D${r})` } as any;
      ws.getCell(r, 6).numFmt = '0.0%';
    });
    if (professors.length) {
      const r = top + 1 + professors.length, f = top + 1, l = r - 1;
      ws.getCell(r, 2).value = 'Total';
      ws.getCell(r, 3).value = { formula: `SUM(C${f}:C${l})` } as any;
      ws.getCell(r, 4).value = { formula: `SUM(D${f}:D${l})` } as any;
      ws.getCell(r, 5).value = { formula: `SUM(E${f}:E${l})` } as any;
      ws.getCell(r, 6).value = { formula: `IF(D${r}=0,0,E${r}/D${r})` } as any; ws.getCell(r, 6).numFmt = '0.0%';
      for (let c = 2; c <= 6; c++) { ws.getCell(r, c).font = { bold: true }; ws.getCell(r, c).border = { top: { style: 'thin' } }; }
    }
    const blocks: [RenewalColumn | undefined, number, number][] = [[sCol, sIdx, 8], [siCol, siIdx, 10]];
    for (const [col, idx, at] of blocks) {
      if (!col || !idx || !col.options?.length) continue;
      [col.title, 'Qtd. de Alunos'].forEach((h, i) => { const c = ws.getCell(top, at + i); c.value = h; style(c); });
      col.options.forEach((o, i) => { ws.getCell(top + 1 + i, at).value = o; paint(ws.getCell(top + 1 + i, at), col.optionColors?.[o]); ws.getCell(top + 1 + i, at + 1).value = { formula: `COUNTIF(${rng(idx)},${letter(at)}${top + 1 + i})` } as any; });
    }
  }

  cols.forEach((col, i) => {
    const c = ws.getCell(headerRow, i + 1); c.value = col.title; style(c);
    const hs = col.headerStyle;
    if (hs?.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hs.fill } };
    if (hs?.color || hs?.bold != null) c.font = { bold: hs.bold ?? true, color: { argb: hs.color ?? 'FFFFFFFF' } };
    ws.getColumn(i + 1).width = Math.max(10, Math.round((col.width ?? 140) / 7));
  });
  rows.forEach((r, ri) => {
    cols.forEach((col, ci) => {
      const c = ws.getCell(headerRow + 1 + ri, ci + 1);
      c.value = ci === pIdx - 1 ? profOf(r) : toCell(cellValue(r, col), col);
      if (col.type === 'date' && c.value instanceof Date) c.numFmt = 'dd/mm/yyyy';
      const cs = col.cellStyle;
      if (cs?.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cs.fill } };
      if (cs?.color || cs?.bold) c.font = { bold: !!cs.bold, color: cs.color ? { argb: cs.color } : undefined };
      if (col.type === 'list' && typeof c.value === 'string') paint(c, col.optionColors?.[c.value]);
      c.border = { bottom: { style: 'hair', color: { argb: 'FFBFBFBF' } } };
    });
  });
  cols.forEach((col, ci) => {
    if (col.type !== 'list' || !col.options?.length) return;
    const ref = `${letter(ci + 1)}${a}:${letter(ci + 1)}${b + 200}`;
    (ws as any).dataValidations.add(ref, { type: 'list', allowBlank: true, formulae: [`"${col.options.join(',').replace(/"/g, '')}"`] });
    const L = letter(ci + 1);
    const rules = col.options.filter(o => col.optionColors?.[o]).map((o, k) => ({
      type: 'expression', priority: k + 1,
      formulae: [`$${L}${a}="${o.replace(/"/g, '""')}"`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: col.optionColors![o] } } },
    }));
    if (rules.length) ws.addConditionalFormatting({ ref, rules: rules as any });
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: cols.length } };
}

const normName = (v: any) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Alunos com financeiro e sem turma (resolvidos ou não) que ainda não estão em nenhuma linha. */
export function financeiroSemTurma(issues: { kind: string; detail?: any }[], rows: RenewalRow[]) {
  const mats = new Set(rows.map(r => String(r.imported?.matricula ?? '').trim()).filter(Boolean));
  const names = new Set(rows.map(r => normName(r.imported?.aluno)));
  const seen = new Set<string>(); const out: { aluno: string; matricula: string; parcelas: number | null }[] = [];
  for (const i of issues) {
    if (i.kind !== 'sem_correspondencia') continue;
    const d = i.detail ?? {}; const mat = String(d.mat ?? '').trim(); const n = normName(d.sacado);
    if ((mat && mats.has(mat)) || names.has(n)) continue;
    const k = mat || n; if (!k || seen.has(k)) continue; seen.add(k);
    out.push({ aluno: String(d.sacado ?? ''), matricula: mat, parcelas: d.pending ?? d.count ?? null });
  }
  return out.sort((a, b) => a.aluno.localeCompare(b.aluno, 'pt-BR'));
}

export async function buildWorkbook(rows: RenewalRow[], columns: RenewalColumn[], structure: TemplateStructure | null, issues: { kind: string; detail?: any }[] = []): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const main = structure?.mainSheet ?? 'Renovação';
  const groups = new Map<string, RenewalRow[]>();
  for (const r of rows) { const k = r.imported?.aba ? String(r.imported.aba) : main; groups.set(k, [...(groups.get(k) ?? []), r]); }
  if (!groups.has(main)) groups.set(main, []);
  for (const name of [main, ...[...groups.keys()].filter(k => k !== main).sort()]) {
    writeSheet(wb.addWorksheet(name.slice(0, 31)), groups.get(name)!, columns, structure);
  }
  const extra = financeiroSemTurma(issues, rows);
  if (extra.length) {
    const ws = wb.addWorksheet('Financeiro sem turma');
    ws.addRow(['Aluno', 'Matrícula', 'Parcelas em aberto', 'Observação']).font = { bold: true };
    for (const e of extra) ws.addRow([e.aluno, e.matricula || '—', e.parcelas, 'Tem financeiro, mas não está em nenhuma turma. Confirmar com a escola se está estudando.']);
    ws.columns = [{ width: 40 }, { width: 12 }, { width: 18 }, { width: 80 }];
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
