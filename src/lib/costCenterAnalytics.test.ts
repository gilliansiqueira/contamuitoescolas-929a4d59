import { describe, it, expect } from 'vitest';
import { resultadoPorObra, obraVsEstrutura, obrasEmDestaque, splitFornecedorCategoria, evolucaoCategorias } from './costCenterAnalytics';
const G = [{ id: 'a', name: 'Obra A' }, { id: 's', name: 'ATHER ENGENHARIA' }];
const I = [
  { group_id: 'a', descricao: 'X · Material', valor: 100, data: '2026-08-10', tipo: 'despesa' as const },
  { group_id: 'a', descricao: 'Y · Material', valor: 200, data: '2026-09-10', tipo: 'despesa' as const },
  { group_id: 'a', descricao: 'Cliente', valor: 500, data: '2026-09-11', tipo: 'receita' as const },
  { group_id: 's', descricao: 'Z · Aluguel', valor: 100, data: '2026-09-05', tipo: 'despesa' as const },
];
describe('costCenterAnalytics', () => {
  it('resultado e margem por obra', () => {
    const a = resultadoPorObra(I.filter(i => i.data >= '2026-09'), G).find(r => r.id === 'a')!;
    expect(a.resultado).toBe(300); expect(a.margem).toBe(0.6);
  });
  it('obra x estrutura usa o grupo ATHER ENGENHARIA', () => {
    expect(obraVsEstrutura(I.filter(i => i.data >= '2026-09'), G)).toMatchObject({ obras: 200, estrutura: 100 });
  });
  it('destaque quando passa 30% da média anterior', () => {
    expect(obrasEmDestaque(I, G, '2026-09')[0]).toMatchObject({ nome: 'Obra A', variacao: 1 });
  });
  it('separa fornecedor e categoria', () => {
    expect(splitFornecedorCategoria('ACME LTDA · Concreto')).toEqual({ fornecedor: 'ACME LTDA', categoria: 'Concreto' });
  });
  it('variação de categoria contra mês anterior', () => {
    expect(evolucaoCategorias(I, ['2026-08', '2026-09'])[0]).toMatchObject({ categoria: 'Material', variacao: 1 });
  });
});
