import { describe, it, expect } from 'vitest';
import { accountNumberIssue } from '@/lib/bankAccountNumber';
describe('accountNumberIssue', () => {
  it('CNPJ bloqueia', () => expect(accountNumberIssue('36.210.951/0001-32')?.level).toBe('block'));
  it('CNPJ só dígitos bloqueia', () => expect(accountNumberIssue('36210951000132')?.level).toBe('block'));
  it('CPF com pontos bloqueia', () => expect(accountNumberIssue('123.456.789-09')?.level).toBe('block'));
  it('conta normal passa', () => expect(accountNumberIssue('3326357-5')).toBeNull());
  it('11 dígitos só avisa', () => expect(accountNumberIssue('98312448282')?.level).toBe('warn'));
});
