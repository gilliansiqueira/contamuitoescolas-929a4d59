import { describe, it, expect } from 'vitest';
import { buildIndex, suggest } from '@/lib/reconSuggest';
import { threeWayMatch } from '@/lib/receiptThreeWayMatch';

describe('reconSuggest', () => {
  const hist = [1, 2, 3].map(() => ({ descricao: 'PIX ENVIADO CEMIG DISTRIBUICAO 123', tipo: 'saida', itemId: 'luz' }));
  it('3 conciliações iguais = confiável', () => {
    const s = suggest({ descricao: 'PIX ENVIADO CEMIG DISTRIBUICAO 999', tipo: 'saida' }, buildIndex(hist));
    expect(s?.itemId).toBe('luz');
    expect(s?.reliable).toBe(true);
  });
  it('uma divergência tira a confiança', () => {
    const s = suggest({ descricao: 'PIX ENVIADO CEMIG DISTRIBUICAO', tipo: 'saida' }, buildIndex([...hist, { descricao: 'CEMIG DISTRIBUICAO', tipo: 'saida', itemId: 'agua' }]));
    expect(s?.reliable).toBe(false);
  });
  it('sentido diferente não sugere', () => {
    expect(suggest({ descricao: 'CEMIG DISTRIBUICAO', tipo: 'entrada' }, buildIndex(hist))).toBeNull();
  });
  it('sugestão da rede nunca é confiável sozinha', () => {
    const s = suggest({ descricao: 'CEMIG DISTRIBUICAO', tipo: 'saida' }, new Map(), buildIndex(hist));
    expect(s?.source).toBe('rede');
    expect(s?.reliable).toBe(false);
  });
});

describe('threeWayMatch', () => {
  it('repasse liga a depósito em até 2 dias úteis (sexta → terça)', () => {
    const r = threeWayMatch([{ id: 'a', date: '2026-10-30', valor: 500, kind: 'cartao' }], [{ id: 'x', date: '2026-11-03', valor: 500 }]);
    expect(r.matched.length).toBe(1);
  });
  it('3 dias úteis depois não liga', () => {
    const r = threeWayMatch([{ id: 'a', date: '2026-10-30', valor: 500, kind: 'cartao' }], [{ id: 'x', date: '2026-11-04', valor: 500 }]);
    expect(r.missing.length).toBe(1);
    expect(r.unexpectedDeposits.length).toBe(1);
  });
  it('soma dos repasses do dia com um depósito', () => {
    const r = threeWayMatch([{ id: 'a', date: '2026-11-02', valor: 300, kind: 'cartao' }, { id: 'b', date: '2026-11-02', valor: 200, kind: 'cartao' }], [{ id: 'x', date: '2026-11-02', valor: 500 }]);
    expect(r.matched[0].ids.sort()).toEqual(['a', 'b']);
  });
  it('depósito não é usado duas vezes', () => {
    const r = threeWayMatch([{ id: 'a', date: '2026-11-02', valor: 100, kind: 'boleto_pix' }, { id: 'b', date: '2026-11-02', valor: 100, kind: 'cartao' }], [{ id: 'x', date: '2026-11-02', valor: 100 }]);
    expect(r.matched.length).toBe(1);
    expect(r.missing.length).toBe(1);
  });
});
