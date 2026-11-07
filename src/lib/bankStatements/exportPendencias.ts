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

export interface TeamBacklogRow { empresa: string; responsavel: string; data: string; conta: string; descricao: string; tipo: string; valor: number; motivo: string; observacao: string }

/** Planilha da equipe: resumo por empresa + detalhe, a partir das linhas já filtradas na tela. */
export function exportTeamBacklogXlsx(fileName: string, today: string, rows: TeamBacklogRow[]) {
  const age = (d: string) => Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${d}T12:00:00`)) / 86_400_000);
  const map = new Map<string, { resp: string; emp: string; n: number; v: number; old: string }>();
  for (const r of rows) {
    const k = `${r.responsavel}|${r.empresa}`;
    const g = map.get(k) ?? { resp: r.responsavel, emp: r.empresa, n: 0, v: 0, old: r.data };
    g.n++; g.v += Math.abs(r.valor); if (r.data < g.old) g.old = r.data; map.set(k, g);
  }
  const none = (s: string) => s === 'Sem responsável' ? 1 : 0;
  const sum = [...map.values()].sort((a, b) => none(a.resp) - none(b.resp) || a.resp.localeCompare(b.resp, 'pt-BR') || b.n - a.n);
  const ws1 = XLSX.utils.aoa_to_sheet([
    [`Pendências de conciliação — ${br(today)}`], [],
    ['Responsável', 'Empresa', 'Pendências', 'Valor pendente (sem sinal)', 'Mais antiga', 'Dias em atraso'],
    ...sum.map(g => [g.resp, g.emp, g.n, g.v, br(g.old), age(g.old)]),
  ]);
  for (let r = 4; r < 4 + sum.length; r++) { const c = ws1[`D${r}`]; if (c) c.z = MONEY; }
  ws1['!cols'] = [24, 30, 12, 22, 12, 14].map(wch => ({ wch }));
  ws1['!autofilter'] = { ref: `A3:F${3 + sum.length}` };
  const det = [...rows].sort((a, b) => none(a.responsavel) - none(b.responsavel) || a.responsavel.localeCompare(b.responsavel, 'pt-BR') || a.empresa.localeCompare(b.empresa, 'pt-BR') || a.data.localeCompare(b.data));
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Responsável', 'Empresa', 'Data', 'Conta', 'Descrição', 'Tipo', 'Valor', 'Motivo', 'Observação'],
    ...det.map(r => [r.responsavel, r.empresa, br(r.data), r.conta, r.descricao, r.tipo, r.valor, r.motivo, r.observacao]),
  ]);
  for (let r = 2; r <= det.length + 1; r++) { const c = ws2[`G${r}`]; if (c) c.z = MONEY; }
  ws2['!cols'] = [22, 28, 10, 22, 50, 10, 14, 28, 36].map(wch => ({ wch }));
  ws2['!autofilter'] = { ref: `A1:I${det.length + 1}` };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalhe');
  XLSX.writeFile(wb, fileName);
}
