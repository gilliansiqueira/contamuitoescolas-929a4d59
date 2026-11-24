/** Detecta CPF/CNPJ digitado no lugar de agência/conta. 'block' = nunca é conta; 'warn' = pode ser conta de banco digital. */
export function accountNumberIssue(value: string | null | undefined): null | { level: 'block' | 'warn'; message: string } {
  const v = (value ?? '').trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  if (v.includes('/') || /^\d{2}\.\d{3}\.\d{3}/.test(v) || digits.length === 14)
    return { level: 'block', message: 'Isso parece um CNPJ. Coloque aqui o número da conta e informe o documento no campo do titular.' };
  if (/^\d{3}\.\d{3}\.\d{3}-?\d{2}$/.test(v))
    return { level: 'block', message: 'Isso parece um CPF. Coloque aqui o número da conta e informe o documento no campo do titular.' };
  if (digits.length === 11 && /^\d+$/.test(v))
    return { level: 'warn', message: 'Confira: 11 dígitos podem ser um CPF. Se for mesmo o número da conta (comum em bancos digitais), pode salvar.' };
  return null;
}
