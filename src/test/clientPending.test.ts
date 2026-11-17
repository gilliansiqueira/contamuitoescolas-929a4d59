import { describe, it, expect } from 'vitest';
import { filterClientPending, pendingMonths, type ClientPendingRow } from '@/lib/clientPending';
const r = (id: string, data: string, descricao: string, cat: string | null = null): ClientPendingRow => ({ id, data, descricao, valor: 10, conta: 'Itaú', categoria_texto: cat, observacao: null, note_updated_at: null });
const rows = [r('a', '2026-10-05', 'PIX ENVIADO JOAO'), r('b', '2026-11-02', 'BOLETO LUZ', 'energia'), r('c', '2026-11-10', 'TED MARIA')];
describe('pendências do cliente', () => {
  it('filtra por mês', () => expect(filterClientPending(rows, '2026-11', '').map(x => x.id)).toEqual(['b', 'c']));
  it('só sem resposta', () => expect(filterClientPending(rows, 'all', '', true).map(x => x.id)).toEqual(['a', 'c']));
  it('busca na descrição e na resposta', () => {
    expect(filterClientPending(rows, 'all', 'maria').map(x => x.id)).toEqual(['c']);
    expect(filterClientPending(rows, 'all', 'energia').map(x => x.id)).toEqual(['b']);
  });
  it('meses do mais recente', () => expect(pendingMonths(rows)).toEqual(['2026-11', '2026-10']));
});
