import { describe, it, expect } from 'vitest';
import { compareNumber } from '../../supabase/functions/_shared/bankIdentity';

// Bradesco OFX traz a conta sem dígito e sem zeros: nunca pode bloquear a conta certa.
describe('formatos de conta do Bradesco', () => {
  it('conta sem dígito não bloqueia (só aviso)', () => {
    expect(compareNumber('50077', '0050077-1')).toBe('uncertain');
    expect(compareNumber('6894', '00068942')).toBe('uncertain');
    expect(compareNumber('15214', '0015214-5')).toBe('uncertain');
  });
  it('mesma conta com zeros confere', () => {
    expect(compareNumber('29810', '0029810')).toBe('match');
  });
  it('conta realmente diferente bloqueia', () => {
    expect(compareNumber('29810', '548548')).toBe('mismatch');
    expect(compareNumber('50077', '00068942')).toBe('mismatch');
  });
});
