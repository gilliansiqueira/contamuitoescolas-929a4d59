export interface ClientPendingRow {
  id: string; data: string; descricao: string; valor: number; conta: string;
  categoria_texto: string | null; observacao: string | null; note_updated_at: string | null;
}

/** Meses (YYYY-MM) presentes, do mais recente ao mais antigo. */
export const pendingMonths = (rows: ClientPendingRow[]) =>
  [...new Set(rows.map(r => r.data.slice(0, 7)))].sort().reverse();

/** Filtro da tela do cliente: mês ('all' = todos), busca e "só sem resposta". */
export function filterClientPending(rows: ClientPendingRow[], month: string, search: string, onlyUnanswered = false) {
  const q = search.trim().toLowerCase();
  return rows.filter(r =>
    (month === 'all' || r.data.startsWith(month)) &&
    (!onlyUnanswered || !(r.categoria_texto ?? '').trim()) &&
    (!q || r.descricao.toLowerCase().includes(q) || r.conta.toLowerCase().includes(q) || (r.categoria_texto ?? '').toLowerCase().includes(q)),
  );
}

/** Quantas pendências ainda estão sem resposta do cliente (número do sininho). */
export const unansweredCount = (rows: ClientPendingRow[]) =>
  rows.filter(r => !(r.categoria_texto ?? '').trim()).length;
