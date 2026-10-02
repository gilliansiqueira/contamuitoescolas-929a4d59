import * as XLSX from 'xlsx';

export interface MovementExportRow {
  data: string; conta: string; descricao: string; categoria: string; tipo: string;
  entrada: number; saida: number; saldo: number | null; status: string; justificativa: string;
}
export interface AccountSummaryRow { conta: string; saldoInicial: number; entradas: number; saidas: number; saldoFinal: number }

const br = (iso: string) => iso.split('-').reverse().join('/');
const MONEY = '#,##0.00;-#,##0.00;-';

/** Gera o .xlsx com as linhas já filtradas na tela (nenhum cálculo financeiro novo aqui). */
export function exportMovementsXlsx(fileName: string, rows: MovementExportRow[], summary: AccountSummaryRow[]) {
  const head = ['Data', 'Conta', 'Descrição', 'Categoria', 'Tipo', 'Entrada', 'Saída', 'Saldo da conta', 'Status', 'Justificativa'];
  const body = rows.map(r => [br(r.data), r.conta, r.descricao, r.categoria, r.tipo, r.entrada || 0, r.saida || 0, r.saldo ?? '', r.status, r.justificativa]);
  const n = rows.length;
  const totals = ['Total', '', '', '', '', { f: `SUM(F2:F${n + 1})` }, { f: `SUM(G2:G${n + 1})` }, '', 'Líquido', { f: `F${n + 2}-G${n + 2}` }];
  const ws = XLSX.utils.aoa_to_sheet([head, ...body, totals as unknown as (string | number)[]]);
  for (let r = 1; r <= n + 1; r++) for (const c of ['F', 'G', 'H']) { const cell = ws[`${c}${r + 1}`]; if (cell && typeof cell.v !== 'string') cell.z = MONEY; }
  const liq = ws[`J${n + 2}`]; if (liq) liq.z = MONEY;
  ws['!cols'] = [10, 22, 48, 28, 14, 14, 14, 16, 14, 36].map(wch => ({ wch }));
  ws['!autofilter'] = { ref: `A1:J${n + 1}` };
  (ws as Record<string, unknown>)['!freeze'] = { xSplit: 0, ySplit: 1 };

  const sHead = ['Conta', 'Saldo inicial', 'Entradas', 'Saídas', 'Saldo final'];
  const sBody = summary.map(s => [s.conta, s.saldoInicial, s.entradas, s.saidas, s.saldoFinal]);
  const ws2 = XLSX.utils.aoa_to_sheet([sHead, ...sBody]);
  for (let r = 2; r <= sBody.length + 1; r++) for (const c of ['B', 'C', 'D', 'E']) { const cell = ws2[`${c}${r}`]; if (cell) cell.z = MONEY; }
  ws2['!cols'] = [26, 16, 16, 16, 16].map(wch => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por conta');
  XLSX.writeFile(wb, fileName);
}
