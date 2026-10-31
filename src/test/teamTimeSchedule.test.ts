import { describe, it, expect } from 'vitest';
import { applyScheduleOverride } from '@/lib/teamTime/schedule';

const H = '12:00 14:00 14:15 18:15';
const day = (marcacoes: string[], horas_extras: string | null = null, ocorrencia: string | null = null) => ({
  employee_external_id: 'pf-3', dia: '2026-10-02', horario_previsto: '12:30 14:00 14:15 18:15', primeira_marcacao: null, ultima_marcacao: null,
  marcacoes, horas_trabalhadas: null, horas_extras, situacao: 'hora_extra' as const, ocorrencia, synced_at: '',
});

describe('horário corrigido da Geovanna (6h)', () => {
  it('02/10: 5h57 trabalhadas não gera extra', () => {
    const r = applyScheduleOverride(day(['12:06', '14:43', '14:59', '18:19'], '00:27'), H);
    expect(r.horas_extras).toBeNull();
    expect(r.horario_previsto).toBe(H);
  });
  it('07/10: 7h07 trabalhadas gera 1h07 de extra', () => {
    expect(applyScheduleOverride(day(['12:18', '13:18', '13:37', '19:26'], '01:19'), H).horas_extras).toBe('01:07');
  });
  it('19/10: 5h13 trabalhadas vira 47 min de atraso', () => {
    expect(applyScheduleOverride(day(['12:04', '14:03', '14:20', '17:34'], null, 'Faltas 00:17 (relatório)'), H).ocorrencia).toBe('Faltas 00:47 (horário corrigido)');
  });
  it('batida faltando não gera extra', () => {
    expect(applyScheduleOverride(day(['12:09', '14:27', '14:42'], '00:30'), H).horas_extras).toBeNull();
  });
  it('sem horário corrigido nada muda', () => {
    const d = day(['12:06'], '00:27');
    expect(applyScheduleOverride(d, null)).toBe(d);
  });
});
