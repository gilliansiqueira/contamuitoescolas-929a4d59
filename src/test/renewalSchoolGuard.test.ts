import { describe, it, expect } from 'vitest';
import { checkSchoolMismatch } from '@/lib/renewal/schoolGuard';

const range = (a: number, n: number) => Array.from({ length: n }, (_, i) => String(a + i));

describe('checkSchoolMismatch', () => {
  it('avisa quando o arquivo não tem alunos em comum com a planilha atual', () => {
    expect(checkSchoolMismatch(range(14000, 239), range(6000, 250)).suspicious).toBe(true);
  });
  it('não avisa numa reimportação normal da mesma escola', () => {
    expect(checkSchoolMismatch(range(6000, 240), range(6005, 250)).suspicious).toBe(false);
  });
  it('não avisa na primeira importação (planilha vazia)', () => {
    expect(checkSchoolMismatch(range(6000, 240), []).suspicious).toBe(false);
  });
  it('avisa quando mais de 80% bate com outra escola', () => {
    const r = checkSchoolMismatch(range(6000, 100), [], [{ name: 'Santa Mônica', mats: range(6000, 90) }]);
    expect(r.suspicious).toBe(true);
    expect(r.otherSchool?.name).toBe('Santa Mônica');
  });
});
