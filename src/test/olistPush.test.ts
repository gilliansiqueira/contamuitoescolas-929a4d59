import { describe, it, expect } from 'vitest';
import { suggestCategory, pickOpenBill, isOperation, normDesc, type Tx } from '../../supabase/functions/olist-sync/push';

const tx = (p: Partial<Tx> = {}): Tx => ({ id: 't', data: '2026-11-10', descricao: 'PIX ENVIADO JOAO 123', valor: 100, tipo: 'saida', model_item_id: null, ...p });

describe('Integração Olist', () => {
  it('usa a categoria já escolhida pela equipe', () => {
    expect(suggestCategory(tx({ model_item_id: 'x' }), [])).toEqual({ modelItemId: 'x', origem: 'item' });
  });
  it('sugere pela maioria do histórico com mesmo sentido', () => {
    const h = [
      { descricao: 'PIX ENVIADO JOAO 999', tipo: 'saida', model_item_id: 'a' },
      { descricao: 'PIX ENVIADO JOAO 555', tipo: 'saida', model_item_id: 'a' },
      { descricao: 'PIX ENVIADO JOAO 1', tipo: 'saida', model_item_id: 'b' },
      { descricao: 'PIX ENVIADO JOAO', tipo: 'entrada', model_item_id: 'c' },
    ];
    expect(suggestCategory(tx(), h)).toEqual({ modelItemId: 'a', origem: 'historico' });
  });
  it('deixa A classificar quando o histórico está dividido', () => {
    const h = [
      { descricao: 'PIX ENVIADO JOAO', tipo: 'saida', model_item_id: 'a' },
      { descricao: 'PIX ENVIADO JOAO', tipo: 'saida', model_item_id: 'b' },
    ];
    expect(suggestCategory(tx(), h).origem).toBe('a_classificar');
  });
  it('baixa só com candidato único dentro da janela (7 dias depois, 3 antes)', () => {
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100, dataVencimento: '2026-11-17' }])).toBe(1);
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100, dataVencimento: '2026-11-18' }])).toBeNull();
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100, dataVencimento: '2026-11-07' }])).toBe(1);
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100, dataVencimento: '2026-11-06' }])).toBeNull();
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100, dataVencimento: '2026-11-10' }, { id: 2, valor: 100, dataVencimento: '2026-11-11' }])).toBeNull();
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100.5, dataVencimento: '2026-11-10' }])).toBeNull();
  });
  it('não reutiliza a mesma conta no lote', () => {
    expect(pickOpenBill(tx(), [{ id: 1, valor: 100, dataVencimento: '2026-11-10' }], new Set([1]))).toBeNull();
  });
  it('operação = impacta caixa e fora do resultado', () => {
    expect(isOperation({ id: 'a', impacta_caixa: true, entra_no_resultado: false })).toBe(true);
    expect(isOperation({ id: 'a', impacta_caixa: true, entra_no_resultado: true })).toBe(false);
  });
  it('normaliza descrição sem números e acentos', () => {
    expect(normDesc('Pagto Água 12/10 nº 55')).toBe('PAGTO AGUA N');
  });
});

import { findExisting, dailyDiff } from '../../supabase/functions/olist-sync/push';
describe('duplicidade com o Caixa da Olist', () => {
  const caixa = [{ id: 1, data: '2026-11-06', valor: 50, tipo: 'D' }, { id: 2, data: '2026-11-06', valor: 50, tipo: 'D' }, { id: 9, data: '2026-11-06', valor: 50, tipo: 'D' }];
  it('acha igual já lançado, cada um uma vez, ignorando os nossos', () => {
    const used = new Set<number>(); const ours = new Set([9]);
    expect(findExisting({ data: '2026-11-06', valor: 50, tipo: 'saida' }, caixa, used, ours)).toBe(1); used.add(1);
    expect(findExisting({ data: '2026-11-06', valor: 50, tipo: 'saida' }, caixa, used, ours)).toBe(2); used.add(2);
    expect(findExisting({ data: '2026-11-06', valor: 50, tipo: 'saida' }, caixa, used, ours)).toBeNull();
  });
  it('não confunde sentido nem data distante', () => {
    expect(findExisting({ data: '2026-11-06', valor: 50, tipo: 'entrada' }, caixa, new Set())).toBeNull();
    expect(findExisting({ data: '2026-11-09', valor: 50, tipo: 'saida' }, caixa, new Set())).toBeNull();
  });
  it('aponta o dia com diferença', () => {
    expect(dailyDiff([{ data: '2026-11-06', valor: 50, tipo: 'saida' }], caixa)).toEqual([{ data: '2026-11-06', banco: -50, olist: -150, diferenca: 100 }]);
  });
});

describe('Olist: categoria pelo que a equipe já classificou lá', () => {
  it('usa a categoria da mesma contraparte e sentido, ignorando "A classificar"', async () => {
    const { suggestOlistCategory } = await import('../../supabase/functions/olist-sync/push');
    const caixa = [
      { id: 1, data: '2026-10-03', valor: 700, tipo: 'D', historico: 'Pagamento EXPRESSO SAO MIGUEL S A | INT261003-25', categoriaId: 55 },
      { id: 2, data: '2026-11-03', valor: 10, tipo: 'D', historico: 'Pix para Urbano Agroindustrial Ltda | INT1', categoriaId: 9 },
    ];
    expect(suggestOlistCategory({ descricao: 'Pagamento de Título - EXPRESSO SAO MIGUEL S A', tipo: 'saida' }, caixa, 9)).toBe(55);
    expect(suggestOlistCategory({ descricao: 'Pix enviado - Urbano Agroindustrial Ltda', tipo: 'saida' }, caixa, 9)).toBeNull();
    expect(suggestOlistCategory({ descricao: 'Pagamento de Título - EXPRESSO SAO MIGUEL S A', tipo: 'entrada' }, caixa, 9)).toBeNull();
  });
});
