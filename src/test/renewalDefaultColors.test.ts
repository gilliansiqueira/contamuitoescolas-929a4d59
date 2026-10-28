import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from '@/lib/renewal/exportXlsx';
import type { RenewalColumn } from '@/lib/renewal/types';

describe('cores padrão da renovação', () => {
  it('coluna de Status sem cores sai pintada no Excel', async () => {
    const cols: RenewalColumn[] = [
      { id: 'a', title: 'Aluno', kind: 'imported', type: 'text', field: 'aluno' },
      { id: 'p', title: 'Professor', kind: 'imported', type: 'text', field: 'professor' },
      { id: 's', title: 'Status Renovação', kind: 'manual', type: 'list', field: 'status_renovacao', options: ['Rematriculado', 'Pendente', 'Não Rematriculará'] },
    ];
    const rows = [{ row_key: '1', imported: { aluno: 'Ana', professor: 'X' }, overrides: { s: { value: 'Rematriculado', original: null, at: '' } }, conflicts: {}, sort_order: 0, manual: false }] as any;
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await buildWorkbook(rows, cols, null));
    const ws = wb.worksheets[0];
    let fill: any;
    ws.eachRow(r => r.eachCell(c => { if (c.value === 'Rematriculado' && r.getCell(1).value === 'Ana') fill = c.fill; }));
    expect((fill as any)?.fgColor?.argb).toBe('FF00B0F0');
  });
});
