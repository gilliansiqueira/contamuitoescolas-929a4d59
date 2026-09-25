import { describe, it, expect } from 'vitest';
import { parsePdfLines } from '@/lib/bankStatements/parsers';

describe('PDF do BB — lançamentos futuros', () => {
  const lines = [
    '24/09/2026 COBRANCA 1.200,80 C 1.200,80 C',
    '25/09/2026 0000 00000 S A L D O 190,53 D',
    'Lançamentos futuros',
    'Data Lançamento Documento Valor Total diário',
    '25/09/2026 PGT CARTAO 82.513.282 R$ 2.159,03 D 2.159,03 D',
  ];
  it('importa efetivados e futuros (estes como previstos)', () => {
    const r = parsePdfLines(lines);
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0]).toMatchObject({ data: '2026-09-24', valor: 1200.8, tipo: 'entrada' });
    const t = r.transactions[1];
    expect(t).toMatchObject({ data: '2026-09-25', valor: 2159.03, tipo: 'saida', futuro: true });
    expect(t.descricao).toContain('PGT CARTAO');
  });
  it('sem bloco de futuros mantém leitura normal', () => {
    const r = parsePdfLines(lines.slice(0, 2));
    expect(r.transactions.every(t => !t.futuro)).toBe(true);
  });
});
