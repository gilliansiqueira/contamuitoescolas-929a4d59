import ExcelJS from 'exceljs';
import type { RenewalColumn, TemplateStructure } from './types';
import { needsSlim, slimXlsx } from './slimXlsx';
import { FIELDS, matchField, columnFromField, newColId, norm } from './fields';

function text(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if ('text' in v) return String(v.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

function styleOf(cell: ExcelJS.Cell) {
  const f: any = cell.fill; const fo: any = cell.font;
  const fill = f?.type === 'pattern' && f.pattern === 'solid' ? f.fgColor?.argb : undefined;
  const st = { fill, color: fo?.color?.argb, bold: fo?.bold || undefined };
  return st.fill || st.color || st.bold ? st : undefined;
}

function colIndex(letters: string) { return letters.toUpperCase().split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0); }

function resolveList(ws: ExcelJS.Worksheet, formula: string): string[] {
  const f = formula.replace(/^=/, '');
  if (f.startsWith('"')) return f.replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean);
  const m = f.replace(/\$/g, '').match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return [];
  const out: string[] = [];
  for (let r = +m[2]; r <= +m[4]; r++) for (let c = colIndex(m[1]); c <= colIndex(m[3]); c++) {
    const t = text(ws.getCell(r, c).value).trim();
    if (t) out.push(t);
  }
  return out;
}

/** Lê o modelo aprovado pelo cliente e devolve a estrutura (colunas, regras, listas, resumo). */
export async function parseTemplate(buf: ArrayBuffer): Promise<TemplateStructure> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(needsSlim(buf) ? await slimXlsx(buf) : buf);
  } catch (e: any) {
    throw new Error(`Não consegui ler o modelo (${e?.message ?? 'arquivo inválido'}). Salve-o de novo como .xlsx e tente outra vez.`);
  }
  const sheets = wb.worksheets.map(w => w.name);
  let best: { ws: ExcelJS.Worksheet; row: number } | null = null;
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(60, ws.rowCount); r++) {
      const vals = (ws.getRow(r).values as any[]).map(text).map(norm);
      if (vals.includes('aluno') && vals.filter(Boolean).length >= 3) { best = { ws, row: r }; break; }
    }
    if (best) break;
  }
  if (!best) throw new Error('Não encontrei a linha de títulos (com a coluna "Aluno") no arquivo.');
  const { ws, row } = best;

  // Listas de opções (validação de dados) por coluna.
  const dvModel: Record<string, any> = (ws as any).dataValidations?.model ?? {};
  const listsByCol = new Map<number, string[]>();
  for (const [ref, dv] of Object.entries(dvModel)) {
    if (dv?.type !== 'list' || !dv.formulae?.[0]) continue;
    const first = ref.split(/[\s:]/)[0].match(/^([A-Z]+)/);
    if (first) listsByCol.set(colIndex(first[1]), resolveList(ws, dv.formulae[0]));
  }

  const used = new Set<string>();
  const columns: RenewalColumn[] = [];
  let headerColor: string | undefined;
  let prev = 0; let stop = false;
  ws.getRow(row).eachCell({ includeEmpty: false }, (cell, c) => {
    const title = text(cell.value).trim();
    if (!title || stop) return;
    // Quadro de resumo ao lado da tabela (separado por coluna vazia) não vira coluna.
    if (prev && c > prev + 1) { stop = true; return; }
    prev = c;
    const fill: any = cell.fill;
    if (!headerColor && fill?.fgColor?.argb) headerColor = fill.fgColor.argb;
    const width = ws.getColumn(c).width;
    const f = matchField(title, used);
    let col: RenewalColumn;
    if (f) {
      used.add(f.field); col = columnFromField(f.field, title);
      if (f.field === 'forma_pagamento_negociada' && !norm(title).includes('negoci')) col.doubt = 'Tratada como forma negociada na renovação (vazia no modelo). Confirme se não é a forma atual.';
    }
    else col = { id: newColId(), title, kind: 'manual', type: 'text', doubt: 'Sem regra validada: preenchida pela equipe até cadastrarmos a fonte.' };
    const list = listsByCol.get(c);
    if (list?.length) { col.type = 'list'; col.options = list; }
    if (width) col.width = Math.round(width * 7);
    const hs = styleOf(cell); if (hs) col.headerStyle = hs;
    const cs = styleOf(ws.getCell(row + 1, c)); if (cs) col.cellStyle = cs;
    columns.push(col);
  });

  // Campos conhecidos ausentes do modelo entram ocultos (podem ser exibidos depois).
  for (const f of FIELDS) if (!used.has(f.field)) columns.push({ ...columnFromField(f.field), hidden: true });

  const formulas: string[] = [];
  const above: string[] = [];
  for (let r = 1; r < Math.min(row + 40, ws.rowCount + 1); r++) ws.getRow(r).eachCell((cell, c) => {
    if (r >= row && c <= prev) return;
    const v: any = cell.value;
    if (v && typeof v === 'object' && 'formula' in v) { if (formulas.length < 12) formulas.push(`${cell.address}: =${v.formula}`); }
    else above.push(norm(text(v)));
  });
  const notes: string[] = [];
  const separate = /personal|vip|semi/i.test(sheets.join(' '));
  if (!separate) notes.push('O modelo tem uma aba só; modalidades como Personal/VIP podem ir para aba separada na configuração da escola.');
  return {
    sheets, mainSheet: ws.name, columns, headerColor,
    summary: {
      byProfessor: above.includes('professores') || above.includes('qntd alunos'),
      byStatus: above.includes('status renovacao') || above.includes('renovaveis'),
      bySituacao: above.includes('situacao do contrato'),
      formulas,
    },
    separateModalities: separate,
    notes,
  };
}
