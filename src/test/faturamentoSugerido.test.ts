import { describe, it, expect } from 'vitest';
import { resolveFaturamentoMes } from '@/lib/faturamentoSugerido';

describe('resolveFaturamentoMes', () => {
  it('valor salvo manda', () => expect(resolveFaturamentoMes(100, 200, 300)).toEqual({ valor: 100, origem: 'salvo' }));
  it('sem salvo usa receita integral', () => expect(resolveFaturamentoMes(null, 200, 300)).toEqual({ valor: 200, origem: 'integral' }));
  it('sem integral usa receita da plataforma', () => expect(resolveFaturamentoMes(0, null, 300)).toEqual({ valor: 300, origem: 'plataforma' }));
  it('nada disponível', () => expect(resolveFaturamentoMes(null, null, 0)).toEqual({ valor: 0, origem: 'vazio' }));
});
