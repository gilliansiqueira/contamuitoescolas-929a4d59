import { describe, it, expect } from 'vitest';
import { beforeTermination } from '@/lib/teamTime/termination';

describe('desligamento no ponto', () => {
  it('dias antes do desligamento contam', () => expect(beforeTermination('2026-10-23', '2026-10-26')).toBe(true));
  it('o próprio dia do desligamento não conta', () => expect(beforeTermination('2026-10-26', '2026-10-26')).toBe(false));
  it('dias depois do desligamento não contam', () => expect(beforeTermination('2026-10-27', '2026-10-26')).toBe(false));
  it('sem desligamento tudo conta', () => expect(beforeTermination('2026-10-30', null)).toBe(true));
});
