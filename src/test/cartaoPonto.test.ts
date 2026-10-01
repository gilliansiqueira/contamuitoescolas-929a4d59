import { describe, it, expect } from 'vitest';
import tokens from './fixtures/cartaoPontoSet26.json';
import { parseCartaoPonto } from '@/lib/teamTime/cartaoPontoParser';

describe('Relatório de Cartão Ponto (PontoFopag)', () => {
  const r = parseCartaoPonto(tokens as any);
  it('lê os 20 funcionários e o período', () => {
    expect(r.funcionarios.length).toBe(20);
    expect(r.periodoInicio).toBe('2026-09-01');
    expect(r.periodoFim).toBe('2026-10-01');
  });
  it('totais dos dias batem com os impressos', () => {
    expect(r.divergencias).toEqual([]);
  });
  it('Ana Carolina: férias, marcações e totais', () => {
    const a = r.funcionarios.find(f => f.codigo === '1')!;
    expect(a.matricula).toBe('24');
    expect(a.somados).toEqual({ trabalhadas: '154:23', extras: '03:59', faltas: '04:01' });
    expect(a.dias.find(d => d.dia === '2026-09-10')!.observacao).toBe('Férias');
    expect(a.dias.find(d => d.dia === '2026-10-01')!.situacao).toBe('incompleta');
    expect(JSON.stringify(r)).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });
});
