import { describe, it, expect } from 'vitest';
import { parseSpreadsheet } from '@/components/realizado/DetalhamentoDespesas';

const txt = [
  'Data de pagamento\tNome\tCategoria\tCentro de Custo\tValor categoria/centro de custo\tBanco',
  '02/01/2026\tITAÚ PJ\tPagamento de empréstimo\tSem Centro de Custo Definido\t-R$ 4.434,74\t02 ITAÚ PJ',
  '05/01/2026\tJOSE ALBERTO ALVES SANTOS\tSalários\tSem Centro de Custo Definido\t-R$ 1.500,00\tCaixinha',
].join('\n');

describe('Centro de Custos — relatório Contas pagas', () => {
  it('mapeia colunas sem avisos', () => {
    const { rows, warnings } = parseSpreadsheet(txt, '2026-09');
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ grupo: 'Sem Centro de Custo Definido', data: '2026-01-02', descricao: 'ITAÚ PJ — Pagamento de empréstimo', tipo: 'despesa', valor: '4.434,74' });
  });
  it('mantém o layout antigo', () => {
    const { rows } = parseSpreadsheet('Obra A\t05/09/2026\tCimento\tdespesa\t100,00', '2026-09');
    expect(rows[0]).toMatchObject({ grupo: 'Obra A', descricao: 'Cimento', valor: '100,00' });
  });
});
