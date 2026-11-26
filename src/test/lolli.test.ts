import { describe, expect, it } from 'vitest';
import { isLolli, lolliMatchesPeriod } from '@/lib/lolli';
describe('isolamento da Lolli', () => {
  it('seleciona apenas a empresa importada', () => {
    expect(isLolli('11f200c9-e1ae-4336-8b2b-75e44eafd8dc')).toBe(true);
    expect(isLolli('a7786ff0-3387-4ca6-86fa-4b8e2af0a3df')).toBe(false);
    expect(isLolli(null)).toBe(false);
  });
  it('não inclui meses intermediários quando não foram selecionados', () => {
    expect(lolliMatchesPeriod('2026-06-10', ['2026-05', '2026-07'])).toBe(false);
    expect(lolliMatchesPeriod('2026-07-31', ['2026-05', '2026-07'])).toBe(true);
  });
});