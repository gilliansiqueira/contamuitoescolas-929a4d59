import { describe, it, expect } from 'vitest';
import { afternoonBankCheck } from '@/lib/afternoonBankCheck';

const rows = [
  { school_id: 'a', school_name: 'Alfa', responsible_user_id: 'u1', responsible_email: 'kas@x' },
  { school_id: 'b', school_name: 'Beta', responsible_user_id: 'u1', responsible_email: 'kas@x' },
  { school_id: 'c', school_name: 'Gama', responsible_user_id: null, responsible_email: null },
  { school_id: 'd', school_name: 'Delta', responsible_user_id: 'u2', responsible_email: 'gi@x' },
  { school_id: 'e', school_name: 'Sem banco', responsible_user_id: 'u2', responsible_email: 'gi@x' },
];
const bankStart = new Map<string, string | null>([['a', '2026-09'], ['b', '2026-09'], ['c', null], ['d', '2026-12']]);
const daily = [
  { school_id: 'a', imports_today: 1, reconciled_today: 3 },
  { school_id: 'b', imports_today: 1, reconciled_today: 0 },
];

describe('aviso das 15:30', () => {
  const out = afternoonBankCheck({ rows, daily, bankStart, today: '2026-11-11', names: new Map([['u1', 'Kassila']]) });
  it('lista só quem não subiu extrato ou não conciliou hoje', () => {
    expect(out.flatMap(p => p.schools.map(s => s.schoolId))).toEqual(['b', 'c']);
    expect(out[0].schools[0]).toMatchObject({ noStatement: false, noRecon: true });
    expect(out[1].schools[0]).toMatchObject({ noStatement: true, noRecon: true });
  });
  it('ignora empresa sem Fluxo Bancário ou com início futuro', () => {
    expect(out.some(p => p.schools.some(s => s.schoolId === 'd' || s.schoolId === 'e'))).toBe(false);
  });
  it('agrupa por responsável, "Sem responsável" por último', () => {
    expect(out.map(p => p.label)).toEqual(['Kassila', 'Sem responsável']);
  });
});
