/**
 * Leitores de extratos bancários originais (OFX, CSV, Excel, PDF).
 * Lógica adaptada do projeto de referência "Fluxo de Caixa CM".
 * Valores sempre positivos; o sentido vem de `tipo`.
 */
import * as XLSX from 'xlsx';

export interface ParsedBankTx {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  bankRef?: string; // FITID (OFX)
  futuro?: boolean; // "Lançamentos futuros" do PDF — entra como previsto
}

export interface BankParseResult {
  formato: 'ofx' | 'csv' | 'xlsx' | 'pdf';
  banco?: string;
  periodoInicio?: string;
  periodoFim?: string;
  saldoFinalInformado?: number;
  saldoDisponivelInformado?: number;
  /** Saldo total (em conta + aplicação automática), lido do próprio arquivo quando existir. */
  saldoComAplicacaoInformado?: number;
  transactions: ParsedBankTx[];
  avisos: string[];
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function toIsoDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m1 = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m2) {
    const yy = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${yy}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }
  const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
  const n = Number(s);
  if (!isNaN(n) && n > 20000 && n < 80000) {
    const d = XLSX.SSF.parse_date_code(n);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return null;
}

export function parseBRNumber(v: string | number): number {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  let str = String(v).trim().replace(/\s/g, '').replace(/R\$/i, '');
  let neg = false;
  if (/^\(.*\)$/.test(str)) { neg = true; str = str.slice(1, -1); }
  if (/[-]$/.test(str)) { neg = true; str = str.slice(0, -1); }
  if (/[DC]$/i.test(str)) { if (/D$/i.test(str)) neg = true; str = str.slice(0, -1); }
  if (/,\d{1,2}$/.test(str)) str = str.replace(/\./g, '').replace(',', '.');
  else str = str.replace(/,/g, '');
  const n = parseFloat(str);
  if (isNaN(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

const SKIP_RE = /^(saldo\s+anterior|s\s*a\s*l\s*d\s*o|saldo\s+bloqueado|saldo\s+a\s+disp|saldo\s+do\s+dia|saldo\s+final|saldo\s+total)/i;

/**
 * Depósito de cheque bloqueado (ex.: Sicoob "DEP.CHEQUE BLOQ.1D", "DEP CH.CANAL ATEND.1D").
 * Não entra no saldo: o valor só entra na linha "LIBERAÇÃO DE DEPÓSITO BLOQUEADO".
 */
export const BLOCKED_DEPOSIT_RE = /DEP\.?\s?CH(EQUE)?\.?\s?BLOQ|DEP\s?CH\.?\s?CANAL\s?ATEND/i;
const fmtBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const avisoBloqueados = (n: number, total: number) => n
  ? [`${n} depósito(s) de cheque bloqueado(s) deixado(s) de fora (R$ ${fmtBR(total)}): o valor entra na linha "Liberação de depósito bloqueado", como no saldo do banco.`]
  : [];

function finish(formato: BankParseResult['formato'], txs: ParsedBankTx[], extra: Partial<BankParseResult> = {}): BankParseResult {
  const dates = txs.map(t => t.data).sort();
  return { formato, periodoInicio: dates[0], periodoFim: dates[dates.length - 1], transactions: txs, avisos: [], ...extra };
}

export function parseOFX(content: string): BankParseResult {
  const txs: ParsedBankTx[] = [];
  let bloqN = 0, bloqT = 0;
  const bank = content.match(/<BANKID>([^<\r\n]+)/i)?.[1]?.trim();
  for (const s of content.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi)) {
    const body = s[1];
    const data = toIsoDate(body.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1] ?? '');
    const valor = parseBRNumber(body.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] ?? '0');
    const memo = (body.match(/<MEMO>([^<\r\n]+)/i)?.[1] ?? body.match(/<NAME>([^<\r\n]+)/i)?.[1] ?? '').trim();
    const fitid = body.match(/<FITID>([^<\r\n]+)/i)?.[1]?.trim();
    if (!data || valor === 0) continue;
    if (valor > 0 && BLOCKED_DEPOSIT_RE.test(memo)) { bloqN++; bloqT += valor; continue; }
    txs.push({ data, descricao: memo || 'Transação', valor: Math.abs(valor), tipo: valor < 0 ? 'saida' : 'entrada', bankRef: fitid || undefined });
  }
  const bal = content.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i)?.[1];
  const avail = content.match(/<AVAILBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i)?.[1];
  const r = finish('ofx', txs, { banco: bank, saldoFinalInformado: bal ? parseBRNumber(bal) : undefined, saldoDisponivelInformado: avail ? parseBRNumber(avail) : undefined });
  r.avisos = avisoBloqueados(bloqN, bloqT);
  return r;
}

function findHeader(headers: string[], candidates: string[], exclude: number[] = []): number {
  const norm = headers.map(h => stripAccents(String(h ?? '').toLowerCase().trim()));
  const cands = candidates.map(c => stripAccents(c.toLowerCase()));
  for (const c of cands) for (let i = 0; i < norm.length; i++) if (!exclude.includes(i) && norm[i] === c) return i;
  for (const c of cands) for (let i = 0; i < norm.length; i++) if (!exclude.includes(i) && norm[i].includes(c)) return i;
  return -1;
}

function detectHeaderRow(rows: (string | number)[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = (rows[i] ?? []).map(c => String(c ?? ''));
    const hasData = findHeader(row, ['data', 'date']) >= 0;
    const hasValue = findHeader(row, ['valor', 'amount', 'montante', 'credito', 'entrada', 'debito', 'saida']) >= 0;
    if (hasData && hasValue) return i;
  }
  return -1;
}

function rowsToTx(rows: (string | number)[][]): ParsedBankTx[] {
  const h = detectHeaderRow(rows);
  if (h < 0) return [];
  const header = rows[h].map(c => String(c ?? ''));
  const iData = findHeader(header, ['data', 'date']);
  const iDesc = findHeader(header, ['descri', 'histor', 'memo', 'lanca'], [iData]);
  const iValor = findHeader(header, ['valor', 'amount', 'montante']);
  const iCD = findHeader(header, ['movimenta', 'natureza', 'd/c', 'entrada/saida', 'inf.']);
  const iCred = findHeader(header, ['credito', 'entrada', 'credit'], [iData, iCD]);
  const iDeb = findHeader(header, ['debito', 'saida', 'debit'], [iData, iCD]);
  const iSaldo = findHeader(header, ['saldo', 'balance']);
  const iTipo = findHeader(header, ['tipo', 'type']);
  const iDest = findHeader(header, ['destino', 'favorecido', 'contraparte']);

  const cdToTipo = (s: string): 'entrada' | 'saida' | null => {
    const t = stripAccents(s.toLowerCase().trim());
    if (!t) return null;
    if (/^(c|cr|credito|credit|entrada|recebid)/.test(t)) return 'entrada';
    if (/^(d|db|debito|debit|saida|enviad|pagament)/.test(t)) return 'saida';
    return null;
  };

  type Row = ParsedBankTx & { saldo: number | null };
  const txs: Row[] = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.length) continue;
    const data = toIsoDate(String(row[iData] ?? ''));
    if (!data) continue;
    let descricao = iDesc >= 0 ? String(row[iDesc] ?? '').trim() : '';
    if (!descricao) {
      descricao = [iTipo >= 0 ? String(row[iTipo] ?? '').trim() : '', iDest >= 0 ? String(row[iDest] ?? '').trim() : '']
        .filter(s => s && s.toLowerCase() !== 'desconhecido').join(' — ');
    }
    if (SKIP_RE.test(descricao)) continue;
    let valor = 0;
    let tipo: 'entrada' | 'saida' = 'entrada';
    if (iCred >= 0 || iDeb >= 0) {
      const c = iCred >= 0 ? Math.abs(parseBRNumber(row[iCred] as string)) : 0;
      const d = iDeb >= 0 ? Math.abs(parseBRNumber(row[iDeb] as string)) : 0;
      if (c > 0) { valor = c; tipo = 'entrada'; } else if (d > 0) { valor = d; tipo = 'saida'; }
    } else if (iValor >= 0) {
      const v = parseBRNumber(row[iValor] as string);
      valor = Math.abs(v);
      const cd = iCD >= 0 ? cdToTipo(String(row[iCD] ?? '')) : null;
      if (cd) tipo = cd;
      else if (v < 0) tipo = 'saida';
      else if (iTipo >= 0) tipo = /(saida|debito|enviad|pagament)/.test(stripAccents(String(row[iTipo] ?? '').toLowerCase())) ? 'saida' : 'entrada';
    }
    if (valor === 0) continue;
    const saldo = iSaldo >= 0 ? parseBRNumber(row[iSaldo] as string) : NaN;
    txs.push({ data, descricao: descricao || 'Transação', valor, tipo, saldo: isNaN(saldo) ? null : saldo });
  }
  // Corrige o sentido pela variação do saldo quando o banco usa coluna única
  if (iSaldo >= 0) {
    for (let i = 1; i < txs.length; i++) {
      const a = txs[i - 1].saldo, b = txs[i].saldo;
      if (a == null || b == null) continue;
      const delta = b - a;
      if (Math.abs(Math.abs(delta) - txs[i].valor) > 0.01) continue;
      txs[i].tipo = delta >= 0 ? 'entrada' : 'saida';
    }
  }
  return txs.map(({ saldo: _s, ...t }) => t);
}

function parseBancoDoBrasilCSV(content: string): ParsedBankTx[] | null {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const first = lines[0]?.split(';') ?? [];
  if (first.length < 12 || !/^\d{2}\.\d{2}\.\d{4}$/.test((first[3] ?? '').trim())) return null;
  const txs: ParsedBankTx[] = [];
  for (const line of lines) {
    const cols = line.split(';');
    if (cols.length < 12) continue;
    const data = toIsoDate((cols[3] ?? '').trim());
    const descricao = (cols[9] ?? '').trim();
    if (!data || !descricao || SKIP_RE.test(descricao)) continue;
    const valor = parseBRNumber(cols[10] ?? '');
    if (valor === 0) continue;
    txs.push({ data, descricao, valor: Math.abs(valor), tipo: (cols[11] ?? '').trim().toUpperCase() === 'D' ? 'saida' : 'entrada' });
  }
  return txs.length ? txs : null;
}

function parseBancoDoBrasilXLSX(rows: (string | number)[][]): ParsedBankTx[] | null {
  const norm = (v: unknown) => stripAccents(String(v ?? '').toLowerCase().trim());
  let h = -1; let cols: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const map: Record<string, number> = {};
    (rows[i] ?? []).forEach((c, idx) => { map[norm(c)] = idx; });
    if (map['data'] !== undefined && map['historico'] !== undefined && map['cod. historico'] !== undefined && map['valor r$'] !== undefined && map['inf.'] !== undefined) { h = i; cols = map; break; }
  }
  if (h < 0) return null;
  const txs: ParsedBankTx[] = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.length) continue;
    const data = toIsoDate(String(row[cols['data']] ?? ''));
    if (!data) continue;
    const inf = String(row[cols['inf.']] ?? '').trim().toUpperCase();
    if (inf !== 'C' && inf !== 'D') continue;
    const hist = String(row[cols['historico']] ?? '').trim();
    const iDet = cols['detalhamento hist.'];
    const descricao = (iDet !== undefined ? String(row[iDet] ?? '').trim() : '') || hist;
    if (!descricao || SKIP_RE.test(descricao) || SKIP_RE.test(hist)) continue;
    const valor = Math.abs(parseBRNumber(row[cols['valor r$']] as string));
    if (valor === 0) continue;
    txs.push({ data, descricao, valor, tipo: inf === 'D' ? 'saida' : 'entrada' });
  }
  return txs.length ? txs : null;
}

export function parseCSV(content: string): BankParseResult {
  const bb = parseBancoDoBrasilCSV(content);
  if (bb) return finish('csv', bb, { banco: 'Banco do Brasil' });
  const wb = XLSX.read(content, { type: 'string', raw: true });
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  return finish('csv', rowsToTx(rows));
}

export function parseXLSX(buffer: ArrayBuffer): BankParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const bb = parseBancoDoBrasilXLSX(rows);
  if (bb) return finish('xlsx', bb, { banco: 'Banco do Brasil' });
  return finish('xlsx', rowsToTx(rows));
}

/**
 * PDF: leitura por linhas "data ... valor". Sempre exige conferência manual.
 * Se o PDF tiver o bloco "Lançamentos futuros" (ex.: Banco do Brasil), somente
 * essas linhas são importadas, como PREVISTAS — os lançamentos efetivados vêm do
 * OFX, evitando duplicidade. O lançamento real substitui o previsto ao chegar.
 */
export function parsePdfLines(lines: string[]): BankParseResult {
  const txs: ParsedBankTx[] = [];
  const futuros: ParsedBankTx[] = [];
  let inFuturos = false;
  let saldoConta: number | undefined; let saldoContaData: string | undefined;
  let investido: number | undefined; let saldoTotal: number | undefined;
  const all = stripAccents(lines.join(' '));
  // Só o PDF do Banco do Brasil é usado apenas para futuros/saldos (os efetivados vêm do OFX).
  const isBB = /banco do brasil|bb rende facil|invest\.?\s*resgate\s*autom|s a l d o|total diario/i.test(all);
  // Ano de referência para bancos que imprimem a data sem ano (ex.: Sicoob "01/09").
  const anoRef = all.match(/\d{2}\/\d{2}\/(\d{4})/)?.[1] ?? String(new Date().getFullYear());
  const VAL = /(-?\s?R?\$?\s?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?\s?[-DC*]?)/gi;
  const lastVal = (s: string) => { const v = [...s.matchAll(VAL)].map(m => m[1]); return v.length ? parseBRNumber(v[v.length - 1]) : undefined; };
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const plain = stripAccents(line);
    if (/lancamentos\s+futuros/i.test(plain)) { inFuturos = true; continue; }
    if (/^invest\.?\s*resgate\s*autom/i.test(plain)) { investido = lastVal(line); continue; }
    if (/^saldo\s+-?\s*\d/i.test(plain) && investido !== undefined && saldoTotal === undefined) { saldoTotal = lastVal(line); continue; }
    const dm = line.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*)$/);
    if (!dm) continue;
    const data = toIsoDate(dm[1].length === 5 ? `${dm[1]}/${anoRef}` : dm[1]);
    if (!data) continue;
    if (!inFuturos && /\bs\s*a\s*l\s*d\s*o\b/i.test(dm[2]) && !/anterior/i.test(dm[2])) {
      const v = lastVal(dm[2]); if (v !== undefined) { saldoConta = v; saldoContaData = data; }
      continue;
    }
    const vals = [...dm[2].matchAll(VAL)].map(m => m[1]);
    if (!vals.length) continue;
    const valStr = vals.length >= 2 ? vals[vals.length - 2] : vals[0];
    const v = parseBRNumber(valStr);
    const descricao = dm[2].slice(0, dm[2].indexOf(vals[0])).replace(/\s*R\$\s*$/i, '').trim();
    if (!descricao || SKIP_RE.test(descricao) || v === 0) continue;
    // Sentido: sinal/marcador D-C; sem marcador, "DÉB."/"PIX EMITIDO" etc. na descrição indicam saída.
    const s = valStr.trim();
    const temMarcador = /^[-(]/.test(s) || /[-DC)]$/i.test(s);
    const debDesc = /^(deb|debito|pagamento|pgto|pix emitido|saque|tarifa)/i.test(stripAccents(descricao));
    const tipo: 'entrada' | 'saida' = v < 0 ? 'saida' : (!temMarcador && debDesc ? 'saida' : 'entrada');
    const tx: ParsedBankTx = { data, descricao, valor: Math.abs(v), tipo };
    if (inFuturos) futuros.push({ ...tx, futuro: true }); else txs.push(tx);
  }
  const saldos: Partial<BankParseResult> = {};
  if (saldoConta !== undefined && saldoContaData) {
    saldos.saldoFinalInformado = saldoConta;
    saldos.periodoFim = saldoContaData;
    if (saldoTotal === undefined && investido !== undefined) saldoTotal = Math.round((saldoConta + investido) * 100) / 100;
    if (saldoTotal !== undefined) saldos.saldoComAplicacaoInformado = saldoTotal;
  }
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const avisoSaldo = saldos.saldoComAplicacaoInformado !== undefined
    ? [`Saldos lidos do PDF em ${saldoContaData!.split('-').reverse().join('/')}: em conta ${fmt(saldoConta!)} · total com aplicação ${fmt(saldos.saldoComAplicacaoInformado)}.`]
    : [];
  if (isBB && (futuros.length || saldos.saldoComAplicacaoInformado !== undefined)) {
    const r = finish('pdf', futuros, { avisos: [
      ...avisoSaldo,
      futuros.length
        ? `Encontrados ${futuros.length} lançamento(s) futuro(s). Só eles serão importados, como "Previsto — aguardando extrato"; os lançamentos já efetivados devem vir do OFX.`
        : 'Nenhum lançamento futuro. Do PDF entram só os saldos; os lançamentos efetivados devem vir do OFX.',
      'Quando o próximo OFX trouxer o lançamento real (mesmo valor e sentido, até 3 dias depois), ele substitui o previsto automaticamente.',
    ] });
    return { ...r, ...saldos, periodoInicio: saldos.periodoFim ?? r.periodoInicio };
  }
  // Demais bancos (ex.: Sicoob): efetivados + futuros como previstos.
  const r = finish('pdf', [...txs, ...futuros], { avisos: [
    ...avisoSaldo,
    'Leitura de PDF é aproximada: confira cada linha, os totais e o sentido (entrada/saída) antes de importar.',
    ...(futuros.length ? [`${futuros.length} lançamento(s) futuro(s) entram como "Previsto — aguardando extrato" e são trocados pelo real quando ele chegar.`] : []),
  ] });
  const efet = txs.map(t => t.data).sort();
  return { ...r, ...saldos, periodoInicio: efet[0] ?? r.periodoInicio, periodoFim: saldos.periodoFim ?? efet[efet.length - 1] ?? r.periodoFim };
}

async function readPdfLines(buf: ArrayBuffer): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      const y = Math.round(it.transform[5]);
      const arr = byY.get(y) ?? [];
      arr.push({ x: it.transform[4], s: it.str });
      byY.set(y, arr);
    }
    [...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => out.push(items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ')));
  }
  return out;
}

/** Bancos brasileiros costumam gerar OFX/CSV em Windows-1252; UTF-8 é usado só quando o arquivo é UTF-8 válido. */
export function decodeBankText(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

export async function parseBankFile(file: File): Promise<BankParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.ofx')) return parseOFX(decodeBankText(await file.arrayBuffer()));
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCSV(decodeBankText(await file.arrayBuffer()));
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseXLSX(await file.arrayBuffer());
  if (name.endsWith('.pdf')) return parsePdfLines(await readPdfLines(await file.arrayBuffer()));
  throw new Error('Formato não suportado. Use OFX, CSV, Excel ou PDF.');
}

async function sha256(text: string | ArrayBuffer): Promise<string> {
  const buf = typeof text === 'string' ? new TextEncoder().encode(text) : new Uint8Array(text);
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const fileHash = async (file: File) => sha256(await file.arrayBuffer());

export const normalizeDesc = (s: string) => stripAccents(s.toLowerCase()).replace(/\s+/g, ' ').trim();

/**
 * Chave anti-duplicidade por conta. Com identificador do banco (OFX), usa-o.
 * Sem ele: data + sentido + valor + descrição + ordem da ocorrência idêntica no arquivo,
 * para que lançamentos iguais no mesmo dia não sejam descartados e extratos
 * sobrepostos não dupliquem.
 */
export async function computeDedupHashes(accountId: string, txs: ParsedBankTx[]): Promise<string[]> {
  const seen = new Map<string, number>();
  return Promise.all(txs.map(t => {
    if (t.bankRef) return sha256(`${accountId}|ref|${t.bankRef}`);
    const base = `${t.futuro ? 'fut|' : ''}${accountId}|${t.data}|${t.tipo}|${t.valor.toFixed(2)}|${normalizeDesc(t.descricao)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return sha256(`${base}|${n}`);
  }));
}
