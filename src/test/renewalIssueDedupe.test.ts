import { describe, it, expect } from 'vitest';
import { dedupeAgainstResolved } from '@/lib/renewal/persist';
const a = { kind: 'sem_turma', row_key: '14359', message: 'Laura tem 6 parcela(s)' };
describe('dedupe conferência', () => {
  it('não repete aviso já conferido', () => expect(dedupeAgainstResolved([a], [a])).toEqual([]));
  it('não duplica no mesmo recálculo', () => expect(dedupeAgainstResolved([a, { ...a }], [])).toHaveLength(1));
  it('reabre se parcelas mudarem', () => expect(dedupeAgainstResolved([{ ...a, message: 'Laura tem 7 parcela(s)' }], [a])).toHaveLength(1));
});
