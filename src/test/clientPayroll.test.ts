import { describe, it, expect } from 'vitest';
import { computeClientPayroll, matchHolerites, parseHoleriteText, totalDifference, weekdaysInMonth } from '@/lib/clientPayroll';

describe('folha dos clientes', () => {
  it('PIX = líquido + VR/dia × dias + VT/dia × dias', () => {
    expect(computeClientPayroll({ dias: 20, vrDiario: 30, vtDiario: 12, recebeVt: true, liquido: 2000 })).toEqual({ dias: 20, vr: 600, vt: 240, pix: 2840 });
  });
  it('sem VT não soma VT', () => {
    expect(computeClientPayroll({ dias: 20, vrDiario: 30, vtDiario: 12, recebeVt: false, liquido: 2000 }).pix).toBe(2600);
  });
  it('novembro/2026 tem 21 dias úteis seg–sex', () => { expect(weekdaysInMonth('2026-11')).toBe(21); });
  it('lê líquido e nome de cada holerite, ignora via repetida e pega o total', () => {
    const emps = [{ id: '1', nome: 'Maria da Silva' }, { id: '2', nome: 'João Souza' }];
    const pages = [
      ['Recibo de pagamento', 'MARIA DA SILVA  Professora', 'Salário 2.500,00', 'Líquido a receber 2.150,30'],
      ['Recibo de pagamento', 'MARIA DA SILVA  Professora', 'Líquido a receber 2.150,30'],
      ['Nome: Pedro Alves', 'Valor líquido 1.000,00', 'Total líquido 3.150,30'],
    ];
    const r = parseHoleriteText(pages, emps);
    expect(r.lines).toEqual([{ nome: 'Maria da Silva', liquido: 2150.3 }, { nome: 'Pedro Alves', liquido: 1000 }]);
    expect(r.printedTotal).toBe(3150.3);
    expect(totalDifference(r.lines, r.printedTotal)).toBe(0);
    const m = matchHolerites(r.lines, emps);
    expect(m.matched.length).toBe(1);
    expect(m.unmatched[0].nome).toBe('Pedro Alves');
    expect(m.missing[0].nome).toBe('João Souza');
  });
});
