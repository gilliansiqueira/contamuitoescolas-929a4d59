import { describe, it, expect } from 'vitest';
import { sameRefTx, refCollisionHash, computeDedupHashes } from '@/lib/bankStatements/parsers';

describe('Itaú renumera o código do lançamento entre downloads', () => {
  const casanAntigo = { data: '2026-09-30', tipo: 'saida', valor: 311.81 };
  const leonardo = { data: '2026-09-30', tipo: 'entrada' as const, valor: 50, descricao: 'PIX RECEBIDO LEONARD30/09 LEONARDO PADILHA CARVALHO', bankRef: '20260930014' };
  it('mesmo código com outro valor/sentido não é duplicado', async () => {
    expect(sameRefTx(casanAntigo, leonardo as any)).toBe(false);
    const [h] = await computeDedupHashes('A', [leonardo as any]);
    expect(await refCollisionHash('A', leonardo as any)).not.toBe(h);
  });
  it('mesmo código com mesmos dados continua duplicado', () => {
    expect(sameRefTx({ data: '2026-09-30', tipo: 'entrada', valor: '50.00' }, leonardo as any)).toBe(true);
  });
});

describe('Bradesco reaproveita o código antigo em outro lançamento', () => {
  it('mesmo código, dia e valor mas outra pessoa = lançamento diferente', () => {
    const taiane = { data: '2026-10-05', tipo: 'entrada', valor: 315, descricao: 'PIX RECEBIDO REM: TAIANE DE ASSIS TRIND 04/10' };
    const raimundo = { data: '2026-10-05', tipo: 'entrada' as const, valor: 315, descricao: 'PIX RECEBIDO REM: RAIMUNDO MARQUES DOS  05/10', bankRef: 'N102BE' };
    expect(sameRefTx(taiane, raimundo)).toBe(false);
    expect(sameRefTx(taiane, { ...raimundo, descricao: taiane.descricao })).toBe(true);
  });
});
