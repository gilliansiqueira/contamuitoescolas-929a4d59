/** Identity comes exclusively from a statement header, never transaction descriptions. */
export interface StatementIdentity { bankCode?: string; branch?: string; account?: string; holderDocument?: string; ambiguous?: boolean }
export function normalizeAccount(value: string | null | undefined): string {
  const s = (value ?? '').trim().toUpperCase();
  return /^[0-9X .\-/]+$/.test(s) ? s.replace(/[ .\-/]/g, '') : '';
}
export function normalizeBank(value: string | undefined): string {
  const s = (value ?? '').trim();
  return /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : '';
}
/** Exact aliases only; never resolve bank from transaction text or filename. */
export const BANK_ALIASES: Record<string, string> = {
  bradesco: '237', 'banco bradesco': '237', sicredi: '748', 'banco sicredi': '748',
  sicoob: '756', 'banco sicoob': '756', 'banco do brasil': '001', bb: '001',
  itau: '341', 'banco itau': '341', 'itau unibanco': '341',
  inter: '077', 'banco inter': '077', caixa: '104', 'caixa economica federal': '104', cef: '104',
  santander: '033', 'banco santander': '033', nubank: '260', nu: '260',
  'c6 bank': '336', c6: '336', 'banco c6': '336', safra: '422', 'banco safra': '422',
  banrisul: '041', sisprime: '084', 'sisprime do brasil': '084', stone: '197',
  pagbank: '290', pagseguro: '290', 'mercado pago': '323', picpay: '380',
};
export function resolveBankCode(bank: string | null | undefined, explicit?: string | null): string {
  const alias = (bank ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const known = normalizeBank(bank ?? '') || BANK_ALIASES[alias] || '';
  const code = normalizeBank(explicit ?? '');
  if (explicit && !code) return '';
  return code && known && code !== known ? '' : code || known;
}
export function decodeBankText(buffer: ArrayBuffer | Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('windows-1252').decode(buffer); }
}
export function headerIdentity(text: string, ofx = false): StatementIdentity {
  if (ofx) {
    const blocks = [...text.matchAll(/<BANKACCTFROM>([\s\S]*?)(?:<\/BANKACCTFROM>|(?=<BANKTRANLIST>))/gi)];
    if (blocks.length !== 1) return { ambiguous: blocks.length > 1 };
    const h = blocks[0][1];
    let ambiguous = false;
    const tag = (name: string) => {
      const values = [...h.matchAll(new RegExp(`<${name}>([^<\\r\\n]+)`, 'gi'))].map(m => m[1].trim());
      const norm = name === 'BANKID' ? normalizeBank : normalizeAccount;
      if (new Set(values.map(norm)).size > 1) ambiguous = true;
      return values[0];
    };
    const bankCode = tag('BANKID'), branch = tag('BRANCHID'), account = tag('ACCTID');
    const cnpj = tag('CNPJ'), cpf = tag('CPF');
    if (cnpj && cpf && normalizeAccount(cnpj) !== normalizeAccount(cpf)) ambiguous = true;
    return { bankCode, branch, account, holderDocument: cnpj ?? cpf, ambiguous };
  }
  // Stop at the first transaction/table header. Documents in the body are not ownership evidence.
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex(l => /^\s*(?:\d{2}[/.-]\d{2}[/.-]\d{2,4}\b|data\b.*(?:descri|hist[oó]r|valor|entrada)|lan[cç]amentos\b|movimenta[cç][oõ]es\b)/i.test(l));
  const header = lines.slice(0, end < 0 ? 0 : end).join('\n');
  let ambiguous = false;
  const get = (label: string) => {
    const values = [...header.matchAll(new RegExp(`(?:^|[\\n;])\\s*${label}\\s*[:;]\\s*([0-9Xx .\\-/]+)`, 'gi'))].map(m => m[1].trim());
    if (new Set(values.map(normalizeAccount)).size > 1) ambiguous = true;
    return values[0];
  };
  const result = { bankCode: get('(?:c[oó]digo do banco|banco)'), branch: get('ag[eê]ncia'), account: get('conta(?: corrente)?'), holderDocument: get('(?:CPF/CNPJ|CPF|CNPJ)(?: do titular)?') };
  return { ...result, ambiguous };
}
export interface RegisteredIdentity { school_id?: string; banco?: string; bank_code?: string | null; agencia: string | null; conta: string | null; holder_document?: string | null; identity_verified?: boolean }
export function validateStatementIdentity(identity: StatementIdentity | undefined, registered: RegisteredIdentity, schoolId: string): void {
  if (registered.school_id !== schoolId) throw new Error('Conta não vinculada à empresa selecionada.');
  const code = resolveBankCode(registered.banco, registered.bank_code);
  if (!code || !normalizeAccount(registered.agencia) || !normalizeAccount(registered.conta)) throw new Error('Complete banco, agência, conta e vínculo no cadastro da conta antes de importar.');
  if (!identity || identity.ambiguous || !normalizeBank(identity.bankCode) || !normalizeAccount(identity.branch) || !normalizeAccount(identity.account)) throw new Error('O arquivo não identifica banco, agência e conta de forma inequívoca. Use o extrato original identificável.');
  for (const [label, a, b] of [['Banco', normalizeBank(identity.bankCode), code], ['Agência', normalizeAccount(identity.branch), normalizeAccount(registered.agencia)], ['Conta', normalizeAccount(identity.account), normalizeAccount(registered.conta)]]) {
    if (a !== b) throw new Error(`${label} do arquivo diverge da conta selecionada. Nenhum dado foi importado.`);
  }
  if (identity.holderDocument) {
    const doc = identity.holderDocument.replace(/[ .\-/]/g, '');
    if (!/^\d{11}$|^\d{14}$/.test(doc) || !registered.holder_document || doc !== registered.holder_document.replace(/[ .\-/]/g, '')) throw new Error('Documento do titular no cabeçalho não confere com o cadastro autorizado.');
  }
}
/** A stale analysis must never replace the preview for a newer destination/file. */
export class ImportGeneration {
  private version = 0;
  invalidate() { return ++this.version; }
  current(version: number) { return this.version === version; }
}