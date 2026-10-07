import ExcelJS from 'exceljs';
import type { RenewalColumn, RenewalRow, TemplateStructure } from './types';
import { cellValue } from './types';

const letter = (n: number) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export interface SummaryLine { professor: string; turmas: number; alunos: number; renovados: number }

/** Resumo por professor: turmas distintas (sem precisar apagar repetidas), alunos e renovados. */
export function computeSummary(rows: RenewalRow[], columns: RenewalColumn[]): SummaryLine[] {
  const pc = columns.find(c => c.field === 'professor');
  const tc = columns.find(c => c.field === 'turma');
  const sc = columns.find(c => c.field === 'status_renovacao');
  if (!pc) return [];
  const map = new Map<string, { turmas: Set<string>; alunos: number; renovados: number }>();
  for (const r of rows) {
    const p = String(cellValue(r, pc) ?? '').trim() || '(sem professor)';
    const e = map.get(p) ?? { turmas: new Set(), alunos: 0, renovados: 0 };
    if (tc) e.turmas.add(String(cellValue(r, tc) ?? ''));
    e.alunos++;
    if (sc && cellValue(r, sc) === 'Rematriculado') e.renovados++;
    map.set(p, e);
  }
  return [...map.entries()].map(([professor, e]) => ({ professor, turmas: e.turmas.size, alunos: e.alunos, renovados: e.renovados })).sort((a, b) => a.professor.localeCompare(b.professor));
}

function toCell(v: any, col: RenewalColumn) {
  if (v == null || v === '') return null;
  if (col.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  if (col.type === 'number' && typeof v !== 'number' && !isNaN(Number(v))) return Number(v);
  return v;
}

function writeSheet(ws: ExcelJS.Worksheet, rows: RenewalRow[], columns: RenewalColumn[], structure: TemplateStructure | null) {
  const cols = columns.filter(c => !c.hidden);
  const headerColor = structure?.headerColor ?? 'FF002060';
  const pIdx = cols.findIndex(c => c.field === 'professor') + 1;
  const tIdx = cols.findIndex(c => c.field === 'turma') + 1;
  const sCol = cols.find(c => c.field === 'status_renovacao');
  const sIdx = sCol ? cols.indexOf(sCol) + 1 : 0;
  const siCol = cols.find(c => c.field === 'situacao_contrato');
  const siIdx = siCol ? cols.indexOf(siCol) + 1 : 0;
  const professors = [...new Set(rows.map(r => String(cellValue(r, cols[pIdx - 1]) ?? '').trim()).filter(Boolean))].sort();
  const withSummary = pIdx > 0 && (structure?.summary.byProfessor ?? true);
  const summaryRows = withSummary ? Math.max(professors.length, sCol?.options?.length ?? 0, siCol?.options?.length ?? 0) + 1 : 0;
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
      ws.getCell(r, 5).value = sIdx ? { formula: `COUNTIFS(${rng(pIdx)},B${r},${rng(sIdx)},"Rematriculado")` } as any : null;
      ws.getCell(r, 6).value = { formula: `IF(D${r}=0,0,E${r}/D${r})` } as any;
      ws.getCell(r, 6).numFmt = '0.0%';
    });
    const blocks: [RenewalColumn | undefined, number, number][] = [[sCol, sIdx, 8], [siCol, siIdx, 10]];
    for (const [col, idx, at] of blocks) {
      if (!col || !idx || !col.options?.length) continue;
      [col.title, 'Qtd. de Alunos'].forEach((h, i) => { const c = ws.getCell(top, at + i); c.value = h; style(c); });
      col.options.forEach((o, i) => { ws.getCell(top + 1 + i, at).value = o; ws.getCell(top + 1 + i, at + 1).value = { formula: `COUNTIF(${rng(idx)},${letter(at)}${top + 1 + i})` } as any; });
    }
  }

  cols.forEach((col, i) => {
    const c = ws.getCell(headerRow, i + 1); c.value = col.title; style(c);
    ws.getColumn(i + 1).width = Math.max(10, Math.round((col.width ?? 140) / 7));
  });
  rows.forEach((r, ri) => {
    cols.forEach((col, ci) => {
      const c = ws.getCell(headerRow + 1 + ri, ci + 1);
      c.value = toCell(cellValue(r, col), col);
      if (col.type === 'date' && c.value instanceof Date) c.numFmt = 'dd/mm/yyyy';
      c.border = { bottom: { style: 'hair', color: { argb: 'FFBFBFBF' } } };
    });
  });
  cols.forEach((col, ci) => {
    if (col.type !== 'list' || !col.options?.length) return;
    const ref = `${letter(ci + 1)}${a}:${letter(ci + 1)}${b + 200}`;
    (ws as any).dataValidations.add(ref, { type: 'list', allowBlank: true, formulae: [`"${col.options.join(',').replace(/"/g, '')}"`] });
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: cols.length } };
}

export async function buildWorkbook(rows: RenewalRow[], columns: RenewalColumn[], structure: TemplateStructure | null): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const main = structure?.mainSheet ?? 'Renovação';
  const groups = new Map<string, RenewalRow[]>();
  for (const r of rows) { const k = r.imported?.aba ? String(r.imported.aba) : main; groups.set(k, [...(groups.get(k) ?? []), r]); }
  if (!groups.has(main)) groups.set(main, []);
  for (const name of [main, ...[...groups.keys()].filter(k => k !== main).sort()]) {
    writeSheet(wb.addWorksheet(name.slice(0, 31)), groups.get(name)!, columns, structure);
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
