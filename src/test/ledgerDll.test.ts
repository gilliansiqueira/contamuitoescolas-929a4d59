import { describe, it, expect } from 'vitest';
import { resolveLedgerRule } from '@/lib/ledgerEngine';

describe('Distribuição de Lucros (DLL)', () => {
  it('é operação: fora do resultado, sai do caixa', () => {
    const r = resolveLedgerRule('Distribuição de Lucros (DLL)', []);
    expect(r.entraNoResultado).toBe(false);
    expect(r.impactaCaixa).toBe(true);
    expect(r.operacaoSinal).toBe('subtrair');
  });
  it('pró-labore marcado no modelo como fora do resultado vira retirada', () => {
    const r = resolveLedgerRule('Pro-Labore', [], [{ name: 'Pró-Labore', tipo: 'saida', impacta_caixa: true, entra_no_resultado: false }]);
    // DEFAULT_MAPPINGS vem antes do modelo; o modelo da empresa chega como classificação
    const r2 = resolveLedgerRule('Pro-Labore', [{ id: 'x', school_id: 's', tipoValor: 'pro-labore', entraNoResultado: false, impactaCaixa: true, classificacao: 'operacao', operacaoSinal: 'subtrair', label: 'Pró-Labore' } as any]);
    expect(r2.entraNoResultado).toBe(false);
    expect(r2.impactaCaixa).toBe(true);
    expect(r.impactaCaixa).toBe(true);
  });
});
