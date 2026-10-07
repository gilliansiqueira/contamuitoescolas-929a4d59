import { describe, it, expect } from 'vitest';
import { applyCashflowOverlay } from '../bankCashflowOverlay';

const base = { school_id: 's', categoria: 'Receita', tipoRegistro: 'realizado', editadoManualmente: false, descricao: 'x', tipo: 'entrada', valor: 10 } as any;

describe('applyCashflowOverlay', () => {
  it('mantém manual e remove planilha após o corte', () => {
    const out = applyCashflowOverlay(
      [{ ...base, id: 'm', origem: 'manual', data: '2026-09-30' }, { ...base, id: 'f', origem: 'fluxo', data: '2026-09-30' }],
      [], '2026-09-01', 's',
    );
    expect(out.map(e => e.id)).toEqual(['m']);
  });
});
