import { describe, it, expect } from 'vitest';
import { resolveEntryLedgerRule, normalizeNativeCategoria } from '@/lib/ledgerEngine';

const e = (categoria: string, tipo: 'entrada' | 'saida' = 'saida') =>
  ({ origem: 'contas_pagar', categoria, tipo, valor: 100 } as any);

describe('operações em uploads nativos (Contas a Pagar)', () => {
  it('categorias de operação saem de Despesa e impactam só o caixa', () => {
    for (const c of ['Empréstimo', 'Distribuição de lucros (DL)', 'Compra da Escola', 'Aplicação', '2.9 Empréstimo', 'Empréstimo *', 'Empréstimo (*)']) {
      const r = resolveEntryLedgerRule(e(c), []);
      expect(r.entraNoResultado, c).toBe(false);
      expect(r.impactaCaixa, c).toBe(true);
      expect(r.operacaoSinal, c).toBe('subtrair');
    }
  });
  it('categorias comuns continuam como despesa e Ignorar não se aplica', () => {
    for (const c of ['Internet', 'Juros do Empréstimo', 'Ignorar', 'Transferência']) {
      const r = resolveEntryLedgerRule(e(c), []);
      expect(r.entraNoResultado, c).toBe(true);
    }
  });
  it('normaliza código e marcadores', () => {
    expect(normalizeNativeCategoria('8.01 Empréstimo (*)')).toBe('emprestimo');
  });
});
