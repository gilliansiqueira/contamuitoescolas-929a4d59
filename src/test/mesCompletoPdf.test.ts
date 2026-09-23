import { describe, expect, it } from 'vitest';
import { aggregateExpensesByMother, sumAnnualThroughReference } from '@/components/dashboard/pdf/mesCompletoPdf';

describe('relatório geral em PDF', () => {
  it('soma o cartão anual somente até o mês de referência', () => {
    const row = {
      year: '2025',
      months: [70, 43, 24, 26, 18, 23, 36, 33, 14, 13, 17, 25],
    };

    expect(sumAnnualThroughReference(row, '2026-08')).toBe(273);
  });

  it('agrega o ponto de atenção pela categoria-mãe completa', () => {
    const rows = [
      { mae: 'FRANQUEADORA', filha: 'Material didático', valor: 54_847.5 },
      { mae: 'FRANQUEADORA', filha: 'Brindes', valor: 21_326.38 },
      { mae: 'PESSOAL', filha: 'Salários', valor: 66_100.2 },
    ];

    expect(aggregateExpensesByMother(rows)[0]).toEqual({ mae: 'FRANQUEADORA', valor: 76_173.88 });
  });
});