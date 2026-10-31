import { test, expect } from 'vitest';
import { applyIgnoredPunches } from './schedule';
test('isabella 21/10', () => {
  const r = applyIgnoredPunches({ dia:'2026-10-21', horario_previsto:'09:00 13:00 14:00 18:48', marcacoes:['08:48','09:13','12:17','13:22','18:32'], ocorrencia:'Marcações Incorretas', situacao:'incompleta', horas_extras:null } as any, ['09:13']);
  expect(r.marcacoes).toEqual(['08:48','12:17','13:22','18:32']);
});
