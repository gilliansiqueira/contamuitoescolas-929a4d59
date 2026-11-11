import { describe, it, expect } from 'vitest';
import { buildCommercialHistory } from '@/lib/commercialHistory';

describe('buildCommercialHistory', () => {
  const hist = [
    { year: 2025, month: 1, metric: 'matriculas', value: 50 },
    { year: 2026, month: 1, metric: 'matriculas', value: 999 },
  ];
  const conv = [
    { month: '2026-01', tipo: 'receptivo', contatos: 100, matriculas: 20 },
    { month: '2026-01', tipo: 'ativo', contatos: 5, matriculas: 2 },
    { month: '2026-09', tipo: 'receptivo', contatos: 7, matriculas: 1 },
  ];
  const out = buildCommercialHistory(hist, conv, '2026-08');
  const find = (m: string, y: string) => out.find(s => s.metric === m && s.year === y)!;
  it('usa o histórico importado em anos sem dados da plataforma', () => {
    expect(find('matriculas', '2025').months[0]).toBe(50);
  });
  it('anos com dados da plataforma ignoram o histórico e somam ativo + receptivo nas matrículas', () => {
    expect(find('matriculas', '2026').months[0]).toBe(22);
    expect(find('contatos_receptivos', '2026').months[0]).toBe(100);
    expect(find('contatos_ativos', '2026').months[0]).toBe(5);
  });
  it('não inclui meses depois do mês de referência', () => {
    expect(find('contatos_receptivos', '2026').months[8]).toBeNull();
  });
});
