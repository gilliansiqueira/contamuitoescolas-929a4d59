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
