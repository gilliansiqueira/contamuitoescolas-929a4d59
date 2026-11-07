import * as XLSX from 'xlsx';

export interface PendenciaRow { data: string; conta: string; descricao: string; tipo: string; valor: number; motivo: string; observacao: string }

const br = (iso: string) => iso.split('-').reverse().join('/');
const MONEY = '#,##0.00;-#,##0.00;-';

/** Planilha para o cliente com as pendências já filtradas na tela (sem cálculo financeiro novo). */
export function exportPendenciasXlsx(fileName: string, title: string, rows: PendenciaRow[]) {
  const head = ['Data', 'Conta', 'Descrição', 'Tipo', 'Valor', 'Motivo da pendência', 'Observação', 'Retorno do cliente'];
  const body = rows.map(r => [br(r.data), r.conta, r.descricao, r.tipo, r.valor, r.motivo, r.observacao, '']);
  const first = 4, last = first + rows.length - 1;
  const ws = XLSX.utils.aoa_to_sheet([
    [title], [],
    head, ...body, [],
    ['Total entradas pendentes', '', '', '', { f: `SUMIF(D${first}:D${last},"Entrada",E${first}:E${last})` }],
    ['Total saídas pendentes', '', '', '', { f: `SUMIF(D${first}:D${last},"Saída",E${first}:E${last})` }],
  ] as unknown as (string | number)[][]);
  for (let r = first; r <= last + 3; r++) { const c = ws[`E${r}`]; if (c && typeof c.v !== 'string') c.z = MONEY; }
  ws['!cols'] = [10, 22, 50, 10, 14, 28, 36, 40].map(wch => ({ wch }));
  ws['!autofilter'] = { ref: `A3:H${last}` };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pendências');
  XLSX.writeFile(wb, fileName);
}
