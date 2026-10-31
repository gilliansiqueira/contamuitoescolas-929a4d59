import { describe, it, expect } from 'vitest';
import { employeeShare, hoursFromDays, matchTitular } from '../lib/teamTime/payroll';

describe('planilha da folha', () => {
  it('titular paga 40% da mensalidade (empresa 60%)', () => {
    expect(employeeShare('mensalidade', 'titular', 223.77)).toBe(89.51);
    expect(employeeShare('mensalidade', 'titular', 301.09)).toBe(120.44);
    expect(employeeShare('mensalidade', 'titular', 355.27)).toBe(142.11);
  });
  it('dependente e coparticipação são 100% da funcionária', () => {
    expect(employeeShare('mensalidade', 'dependente', 201.6)).toBe(201.6);
    expect(employeeShare('coparticipacao', 'titular', 57.79)).toBe(57.79);
  });
  it('atestado e justificativa aceita não viram falta; domingo/feriado vai para 100%', () => {
    const v = hoursFromDays([
      { dia: '2026-10-14', faltaDia: true, faltaMin: 0, extraMin: 0, justificada: false, atestado: true },
      { dia: '2026-10-15', faltaDia: true, faltaMin: 0, extraMin: 0, justificada: true },
      { dia: '2026-10-16', faltaDia: true, faltaMin: 0, extraMin: 0, justificada: false },
      { dia: '2026-10-12', faltaDia: false, faltaMin: 0, extraMin: 60, justificada: false },
      { dia: '2026-10-13', faltaDia: false, faltaMin: 10, extraMin: 30, justificada: false },
    ]);
    expect(v).toEqual({ he50: 30, he100: 60, atraso: 10, faltas: 1 });
  });
  it('nome parecido é só sugestão', () => {
    const p = [{ external_id: 'pf-5', nomes: ['Isabelly Crisitina Goncalves Nicioli'] }];
    expect(matchTitular('Isabelly Cristina Gonalves Nicioli', p)).toEqual({ suggestion: 'pf-5' });
    expect(matchTitular('Isabelly Crisitina Gonçalves Nicioli', p)).toEqual({ exact: 'pf-5' });
  });
});
