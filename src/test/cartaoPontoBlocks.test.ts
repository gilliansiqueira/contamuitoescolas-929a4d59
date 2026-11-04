import { describe, it, expect } from 'vitest';
import { parseCartaoPonto, type PdfToken } from '@/lib/teamTime/cartaoPontoParser';

const line = (page: number, y: number, ...items: [number, string][]): PdfToken[] => items.map(([x, s]) => ({ page, x, y, s }));
const dia = (page: number, y: number, d: string, trab: string) => line(page, y, [20, d], [200, '08:00'], [250, '17:00'], [365, trab]);

function relatorio(t1: string, t2: string) {
  return [
    ...line(1, 800, [20, 'Período de 01/10/2026 à 03/11/2026']),
    ...line(1, 780, [20, 'Funcionário: 2 - FRANCILIANE GOMES']),
    ...dia(1, 700, '01/10/26', '08:00'), ...dia(1, 690, '02/10/26', '08:00'),
    ...line(1, 600, [20, 'Trabalhadas'], [100, t1]), ...line(1, 590, [20, 'Extras'], [100, '00:00']), ...line(1, 580, [20, 'Faltas'], [100, '00:00']),
    ...line(2, 780, [20, 'Funcionário: 2 - FRANCILIANE GOMES']),
    ...dia(2, 700, '02/10/26', '08:00'), ...dia(2, 690, '05/10/26', '04:00'),
    ...line(2, 600, [20, 'Trabalhadas'], [100, t2]), ...line(2, 590, [20, 'Extras'], [100, '00:00']), ...line(2, 580, [20, 'Faltas'], [100, '00:00']),
  ];
}

describe('relatório de ponto em várias partes', () => {
  it('confere cada parte com o seu total e soma as partes', () => {
    const r = parseCartaoPonto(relatorio('16:00', '12:00'));
    expect(r.divergencias).toEqual([]);
    expect(r.funcionarios[0].totais.trabalhadas).toBe('28:00');
    expect(r.funcionarios[0].dias.length).toBe(3); // 02/10 repetido conta uma vez
  });
  it('diferença real numa parte continua bloqueando', () => {
    const r = parseCartaoPonto(relatorio('16:00', '13:00'));
    expect(r.divergencias.length).toBe(1);
    expect(r.divergencias[0]).toContain('02/10 a 05/10');
  });
});
