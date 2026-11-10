/**
 * Bank statement destination check shared by browser, Edge Function and (mirrored) SQL RPC.
 * Rule chosen by the owner: never block what already works. Only a CONCRETE divergence between a
 * trusted header field and the destination's registration blocks. Missing, unreadable, partial or
 * ambiguous identity only produces a non-blocking warning and is never recorded as verified.
 * Identity comes exclusively from a statement header, never filenames, history or payer documents.
 */
export type IdentityField = 'bankCode' | 'branch' | 'account' | 'holderDocument';
export interface StatementIdentity { bankCode?: string; branch?: string; account?: string; holderDocument?: string; ambiguous?: boolean; ambiguousFields?: IdentityField[] }
export type FieldResult = 'match' | 'mismatch' | 'uncertain' | 'missing';

export function normalizeAccount(value: string | null | undefined): string {
  const s = (value ?? '').trim().toUpperCase();
  return /^[0-9X .\-/]+$/.test(s) ? s.replace(/[ .\-/]/g, '') : '';
}
export function normalizeBank(value: string | undefined): string {
  const s = (value ?? '').trim();
  return /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : '';
}
/** Exact aliases only; never resolve bank from transaction text or filename. Mirrored in SQL. */
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
/** Only these file bank codes are trusted enough to prove a divergence (SQL keeps the same list). */
export const KNOWN_BANK_CODES: ReadonlySet<string> = new Set(Object.values(BANK_ALIASES));
export function resolveBankCode(bank: string | null | undefined, explicit?: string | null): string {
  const alias = (bank ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const known = normalizeBank(bank ?? '') || BANK_ALIASES[alias] || '';
  const code = normalizeBank(explicit ?? '');
  if (explicit && !code) return '';
  return code && known && code !== known ? '' : code || known;
}
/** File BANKID/"Banco:" value: leading zeros are formatting ("0237" = "237"). */
export function fileBankCode(value: string | null | undefined): string {
  const s = (value ?? '').trim();
  if (!/^\d{1,8}$/.test(s)) return '';
  const z = s.replace(/^0+/, '');
  return z.length >= 1 && z.length <= 3 ? z.padStart(3, '0') : '';
}
export function compareBank(file: string | null | undefined, registeredCode: string): FieldResult {
  if (!(file ?? '').trim() || !registeredCode) return 'missing';
  const f = fileBankCode(file);
  if (!f) return 'uncertain';
  if (f === registeredCode) return 'match';
  return KNOWN_BANK_CODES.has(f) ? 'mismatch' : 'uncertain';
}
/**
 * Branch/account: leading zeros are formatting. One value contained in the other (missing check digit,
 * branch/operation prefix) is NOT proof of another account → uncertain (warning, not verified).
 * Only values that cannot be the same number are a mismatch. Mirrored by public.bank_identity_cmp_num.
 */
export function compareNumber(file: string | null | undefined, registered: string | null | undefined): FieldResult {
  const a = normalizeAccount(file), b = normalizeAccount(registered);
  if (!a || !b) return (file ?? '').trim() && !a ? 'uncertain' : 'missing';
  const za = a.replace(/^0+/, ''), zb = b.replace(/^0+/, '');
  if (za === zb) return 'match';
  const [s, l] = za.length <= zb.length ? [za, zb] : [zb, za];
  return s && l.includes(s) ? 'uncertain' : 'mismatch';
}
export function decodeBankText(buffer: ArrayBuffer | Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('windows-1252').decode(buffer); }
}
/** Same line grouping as the browser PDF reader (items on the same baseline, left to right). */
export function pdfItemsToLines(items: { str?: string; transform?: number[] }[]): string[] {
  const byY = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (typeof it?.str !== 'string' || !Array.isArray(it.transform)) continue;
    const y = Math.round(it.transform[5]);
    byY.set(y, [...(byY.get(y) ?? []), { x: it.transform[4], s: it.str }]);
  }
  return [...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map(i => i.s).join(' '));
}
export function headerIdentity(text: string, ofx = false): StatementIdentity {
  const ambiguousFields: IdentityField[] = [];
  if (ofx) {
    const blocks = [...text.matchAll(/<BANKACCTFROM>([\s\S]*?)(?:<\/BANKACCTFROM>|(?=<BANKTRANLIST>))/gi)];
    if (blocks.length !== 1) return blocks.length > 1 ? { ambiguous: true, ambiguousFields: ['bankCode', 'branch', 'account', 'holderDocument'] } : {};
    const h = blocks[0][1];
    const tag = (name: string, field: IdentityField) => {
      const values = [...h.matchAll(new RegExp(`<${name}>([^<\\r\\n]+)`, 'gi'))].map(m => m[1].trim());
      const norm = name === 'BANKID' ? fileBankCode : normalizeAccount;
      if (new Set(values.map(v => norm(v) || v)).size > 1 && !ambiguousFields.includes(field)) ambiguousFields.push(field);
      return values[0];
    };
    const bankCode = tag('BANKID', 'bankCode'), branch = tag('BRANCHID', 'branch'), account = tag('ACCTID', 'account');
    const cnpj = tag('CNPJ', 'holderDocument'), cpf = tag('CPF', 'holderDocument');
    if (cnpj && cpf && normalizeAccount(cnpj) !== normalizeAccount(cpf) && !ambiguousFields.includes('holderDocument')) ambiguousFields.push('holderDocument');
    return { bankCode, branch, account, holderDocument: cnpj ?? cpf, ambiguous: ambiguousFields.length > 0, ambiguousFields };
  }
  // Stop at the first transaction/table header. Documents in the body are not ownership evidence.
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex(l => /^\s*(?:\d{2}[/.-]\d{2}[/.-]\d{2,4}\b|data\b.*(?:descri|hist[oó]r|valor|entrada)|lan[cç]amentos\b|movimenta[cç][oõ]es\b)/i.test(l));
  const header = lines.slice(0, end < 0 ? 0 : end).join('\n');
  // Label at line start (or after ; | in exported sheets); value = one token of digits/X with . - / separators.
  const get = (label: string, field: IdentityField) => {
    const values = [...header.matchAll(new RegExp(`(?:^|[\\n;|])[ \\t]*${label}[ \\t]*[:;][ \\t]*([0-9Xx]+(?:[.\\-/][0-9Xx]+)*)(?=$|[\\s;|,])`, 'gi'))].map(m => m[1].trim());
    if (new Set(values.map(v => normalizeAccount(v))).size > 1) ambiguousFields.push(field);
    return values[0];
  };
  const bankCode = get('(?:c[oó]digo do banco|banco)', 'bankCode');
  const branch = get('ag[eê]ncia', 'branch');
  const account = get('conta(?: corrente)?', 'account');
  // Text headers often print the BANK's own CNPJ; only an explicit holder label counts as titular evidence.
  const holderDocument = get('(?:CPF/CNPJ|CPF|CNPJ) do titular', 'holderDocument');
  return { bankCode, branch, account, holderDocument, ambiguous: ambiguousFields.length > 0, ambiguousFields };
}
export interface RegisteredIdentity { school_id?: string; banco?: string; bank_code?: string | null; agencia: string | null; conta: string | null; holder_document?: string | null; holder_entity_id?: string | null; holder_conflict?: boolean; identity_verified?: boolean }
/**
 * Holder document of THIS account: the specific company_entities link wins; an invalid/conflicting link
 * is a registration inconsistency (warning), never a reason to block or to trust any company CNPJ.
 * entityCnpj: undefined = no link; null = link not found.
 */
export function resolveHolder<T extends RegisteredIdentity>(account: T, entityCnpj?: string | null): T {
  if (!account.holder_entity_id) return account;
  const own = normalizeAccount(account.holder_document);
  if (!entityCnpj || (own && normalizeAccount(entityCnpj) !== own)) return { ...account, holder_document: null, holder_conflict: true };
  return { ...account, holder_document: entityCnpj };
}
export class IdentityMismatchError extends Error { constructor(message: string) { super(message); this.name = 'IdentityMismatchError'; } }
export interface IdentityCheck { verified: boolean; warnings: string[]; fields: Record<IdentityField, FieldResult | 'absent'> }
const LABEL: Record<IdentityField, string> = { bankCode: 'banco', branch: 'agência', account: 'conta', holderDocument: 'titular' };
/** Throws IdentityMismatchError only for concrete divergences; everything else returns warnings. */
export function checkStatementIdentity(identity: StatementIdentity | undefined, registered: RegisteredIdentity, schoolId: string, opts: { sharedRegistration?: boolean } = {}): IdentityCheck {
  if (registered.school_id !== schoolId) throw new IdentityMismatchError('A conta escolhida não pertence à empresa selecionada. Nenhum dado foi importado.');
  const amb = new Set<IdentityField>(identity?.ambiguousFields?.length ? identity.ambiguousFields : identity?.ambiguous ? ['bankCode', 'branch', 'account', 'holderDocument'] : []);
  const fields: IdentityCheck['fields'] = {
    bankCode: amb.has('bankCode') ? 'uncertain' : compareBank(identity?.bankCode, resolveBankCode(registered.banco, registered.bank_code)),
    branch: amb.has('branch') ? 'uncertain' : compareNumber(identity?.branch, registered.agencia),
    account: amb.has('account') ? 'uncertain' : compareNumber(identity?.account, registered.conta),
    holderDocument: 'absent',
  };
  const fileDoc = normalizeAccount(identity?.holderDocument), regDoc = normalizeAccount(registered.holder_document);
  if (amb.has('holderDocument')) fields.holderDocument = 'uncertain';
  else if (!(identity?.holderDocument ?? '').trim()) fields.holderDocument = 'absent';
  else if (!/^(?:\d{11}|\d{14})$/.test(fileDoc)) fields.holderDocument = 'uncertain';
  else if (!/^(?:\d{11}|\d{14})$/.test(regDoc)) fields.holderDocument = 'missing';
  else fields.holderDocument = fileDoc === regDoc ? 'match' : 'mismatch';
  const wrong = (Object.keys(fields) as IdentityField[]).filter(k => fields[k] === 'mismatch').map(k => LABEL[k]);
  if (wrong.length) throw new IdentityMismatchError(`O arquivo é de outra conta: ${wrong.join(', ')} ${wrong.length > 1 ? 'não conferem' : 'não confere'} com a conta selecionada. Nenhum dado foi importado. Se o cadastro da conta estiver errado, corrija-o antes.`);
  const unconfirmed = (['bankCode', 'branch', 'account'] as IdentityField[]).filter(k => fields[k] !== 'match').map(k => LABEL[k]);
  if (fields.holderDocument === 'missing' || fields.holderDocument === 'uncertain') unconfirmed.push(LABEL.holderDocument);
  const warnings: string[] = [];
  if (unconfirmed.length) warnings.push(`Não deu para confirmar pelo arquivo: ${unconfirmed.join(', ')}. A importação segue normalmente; confira se escolheu a conta certa.`);
  if (registered.holder_conflict) warnings.push('O titular específico cadastrado nesta conta está inconsistente; o titular não foi conferido.');
  if (opts.sharedRegistration) warnings.push('Existe outro cadastro com o mesmo banco, agência e conta. A importação segue; confira o vínculo das contas.');
  return { verified: !unconfirmed.length && !registered.holder_conflict && !opts.sharedRegistration && amb.size === 0, warnings, fields };
}
/** A stale analysis must never replace the preview for a newer destination/file. */
export class ImportGeneration {
  private version = 0;
  invalidate() { return ++this.version; }
  current(version: number) { return this.version === version; }
}
