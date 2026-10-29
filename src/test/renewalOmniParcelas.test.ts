import { describe, it, expect } from 'vitest';
import { parseSponteWorkbook } from '@/lib/renewal/sponteParser';
import { isModuleInstallment } from '@/lib/renewal/mergeEngine';

const H = ['Aluno', 'CPF', 'Telefone', 'E-mail', 'Endereço', 'Responsável', 'CPF responsável', 'Situação', 'Vencimento', 'Pagamento', 'Descrição', 'Valor', 'Multa', 'Juros', 'Total'];
const L = (a: string, sit: string, venc: string, pag: string | null, desc: string) => [a, '', '', '', '', '', '', sit, venc, pag, desc, 100, 0, 0, 100];
const resumo = [['Indicador', 'Valor'], ['Empresa', 'X'], ['Pagas', 1]];
const parcelas = [H,
  L('Ana Vista', 'Pago', '10/08/2026', '01/08/2026', 'Parcelamento (REGULAR) 1/3'),
  L('Ana Vista', 'Pago', '10/09/2026', '01/08/2026', 'Parcelamento (REGULAR) 2/3'),
  L('Ana Vista', 'Pago', '10/10/2026', '01/08/2026', 'Parcelamento (REGULAR) 3/3'),
  L('Ana Vista', 'Pago', '01/08/2026', '01/08/2026', 'Taxa de Matrícula 1/1'),
  L('Bia Parc', 'Pago', '10/08/2026', '10/08/2026', 'Parcela do Curso Turmas (*) (1/2)'),
  L('Bia Parc', 'A vencer', '10/12/2026', null, 'Parcela do Curso Turmas (*) (2/2)'),
  L('Bia Parc', 'Pago', '12/09/2026', '12/09/2026', 'Conversation Day'),
  L('Bia Parc', 'Vencido', '28/09/2026', null, 'Reposição - Reposição Manual (28/09/2026)'),
];
const settings = { include_material: false, module_categories: [] } as any;

describe('Omni Parcelas por aluno', () => {
  const p = parseSponteWorkbook([resumo, parcelas]);
  it('é reconhecido como Contas a Receber, em qualquer aba', () => {
    expect(p.source).toBe('contas_receber');
    expect(p.rows).toHaveLength(8);
  });
  it('tudo pago na mesma data vira À vista; senão Parcelado', () => {
    expect(p.rows.find(r => r.Sacado === 'Ana Vista' && r.Categoria.startsWith('Parcelamento'))!.FormaCobranca).toBe('À vista');
    expect(p.rows.find(r => r.Sacado === 'Bia Parc' && r.Categoria.startsWith('Parcela do Curso'))!.FormaCobranca).toBe('Parcelado');
  });
  it('taxa, reposição e Conversation Day não contam como módulo', () => {
    const mod = p.rows.filter(r => isModuleInstallment(r, settings));
    expect(mod).toHaveLength(5);
    expect(mod.every(r => !/taxa|reposi|conversation/i.test(r.Descricao))).toBe(true);
  });
});
