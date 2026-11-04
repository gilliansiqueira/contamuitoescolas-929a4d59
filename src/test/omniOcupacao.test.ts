import { describe, it, expect } from 'vitest';
import { parseSponteWorkbook, OMNI_OCUPACAO_MSG } from '@/lib/renewal/sponteParser';

describe('relatório de ocupação de turmas do Omni', () => {
  it('explica que faltam os alunos', () => {
    const resumo = [['Indicador', 'Valor'], ['Total Turmas', 1]];
    const turmas = [
      ['Turma', 'Curso', 'Instrutor', 'Sala', 'Horário', 'Modalidade', 'Status', 'Alunos', 'Capacidade', 'Ocupação (%)'],
      ['Turmas - Regular - B2', 'Regular (EN)', 'Vinícius', 'SALA 2', '09:00 - 10:00', 'Turmas', 'Aberta', 2, 10, '20.0%'],
    ];
    expect(() => parseSponteWorkbook([resumo, turmas])).toThrow(OMNI_OCUPACAO_MSG);
  });
});
