import { describe, it, expect } from 'vitest';
import { detectRecurring } from '@/lib/recurringForecast';
const t = (data: string, descricao: string, valor: number, categoria = 'Aluguel') => ({ data, descricao, valor, tipo: 'saida' as const, categoria });
describe('detectRecurring', () => {
  it('sugere conta que se repete 3 meses com valor estável, no dia mediano', () => {
    const r = detectRecurring([t('2026-08-05', 'PIX Imobiliária X 123', 3000), t('2026-09-06', 'PIX Imobiliária X 456', 3000), t('2026-10-05', 'PIX Imobiliária X 789', 3100)]);
    expect(r).toHaveLength(1); expect(r[0].valor).toBe(3000); expect(r[0].dia).toBe(5);
  });
  it('não sugere quando aparece em só 2 meses', () => {
    expect(detectRecurring([t('2026-08-05', 'Aluguel', 3000), t('2026-09-05', 'Aluguel', 3000)])).toHaveLength(0);
  });
  it('não sugere quando o valor varia mais de 25%', () => {
    expect(detectRecurring([t('2026-08-05', 'Material', 1000), t('2026-09-05', 'Material', 3000), t('2026-10-05', 'Material', 1000)])).toHaveLength(0);
  });
  it('ignora lançamentos a classificar e operações', () => {
    expect(detectRecurring(['2026-08-05', '2026-09-05', '2026-10-05'].map(d => t(d, 'Transf', 500, 'Operação')))).toHaveLength(0);
  });
});
