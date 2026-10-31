import { describe, it, expect } from 'vitest';
import { dropPagBankAReceber, type BankParseResult } from '@/lib/bankStatements/parsers';

const base: BankParseResult = {
  formato: 'pdf', avisos: [],
  transactions: [
    { data: '2026-10-01', descricao: '16:29:25 4891FAF4 Pagamento Liberado A receber', valor: 692.67, tipo: 'saida' },
    { data: '2026-10-01', descricao: '16:32:33 4891FAF4 Taxa de intermediação A receber', valor: 4.53, tipo: 'saida' },
    { data: '2026-10-15', descricao: '12:40:06 7478 SPONTE EDUCACAO LTDA Disponível', valor: 446.56, tipo: 'saida' },
  ],
};

describe('PDF PagBank: saldo "A receber" não movimenta a conta', () => {
  it('ignora linhas A receber e mantém Disponível', () => {
    const r = dropPagBankAReceber(['Extrato Financeiro PagBank'], base);
    expect(r.transactions.map(t => t.valor)).toEqual([446.56]);
  });
  it('não mexe em PDFs de outros bancos', () => {
    expect(dropPagBankAReceber(['Sicoob'], base).transactions).toHaveLength(3);
  });
});
