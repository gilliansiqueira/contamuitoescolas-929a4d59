import { describe, it, expect } from 'vitest';
import { accessTone, daysSince, lastAccess } from '@/lib/clientAccessActivity';

describe('clientAccessActivity', () => {
  it('faixas de cor', () => {
    expect(accessTone(null)).toBe('never');
    expect(accessTone(7)).toBe('recent');
    expect(accessTone(8)).toBe('warn');
    expect(accessTone(30)).toBe('warn');
    expect(accessTone(31)).toBe('stale');
  });
  it('dias desde o acesso', () => {
    expect(daysSince('2026-11-01T12:00:00Z', new Date('2026-11-04T13:00:00Z'))).toBe(3);
  });
  it('usa o acesso mais recente', () => {
    expect(lastAccess('2026-10-01T00:00:00Z', '2026-11-02T00:00:00Z')).toBe('2026-11-02T00:00:00Z');
    expect(lastAccess(null, null)).toBe(null);
  });
});
