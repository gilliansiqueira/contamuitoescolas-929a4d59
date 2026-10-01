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
  /** Saldo atual destacado no cabeçalho, quando diferente do último saldo diário do quadro. */
  saldoAtualCabecalho?: number;
  /** Impede confirmar quando a leitura visual não fecha com os saldos impressos. */
  bloqueiaImportacao?: boolean;
  divergencias?: string[];
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
  // FITID só identifica o lançamento se for único no arquivo e não for só zeros (CEF/Sisprime repetem).
  const freq = new Map<string, number>();
  for (const t of txs) if (t.bankRef) freq.set(t.bankRef, (freq.get(t.bankRef) ?? 0) + 1);
  for (const t of txs) if (t.bankRef && (freq.get(t.bankRef)! > 1 || /^0+$/.test(t.bankRef))) t.bankRef = undefined;
  const bal = content.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i)?.[1];
  const avail = content.match(/<AVAILBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i)?.[1];
  let saldoFinal = bal ? parseBRNumber(bal) : undefined;
  // Inter: o OFX informa só o saldo disponível. Cheques recebidos no último dia ficam "bloqueados"
  // (em compensação), mas já estão nos lançamentos → o saldo real é disponível + esses cheques.
  const avisosExtra: string[] = [];
  const lastDate = txs.reduce((m, t) => (t.data > m ? t.data : m), '');
  const chequesComp = txs.filter(t => t.data === lastDate && t.tipo === 'entrada' && /^cheque recebido/i.test(t.descricao));
  if (saldoFinal !== undefined && chequesComp.length) {
    const soma = Math.round(chequesComp.reduce((s, t) => s + t.valor, 0) * 100) / 100;
    saldoFinal = Math.round((saldoFinal + soma) * 100) / 100;
    avisosExtra.push(`${chequesComp.length} cheque(s) recebido(s) em ${lastDate.split('-').reverse().join('/')} ainda em compensação (R$ ${soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). O saldo do extrato foi somado a eles: o banco mostra só o disponível.`);
  }
  const r = finish('ofx', txs, { banco: bank, saldoFinalInformado: saldoFinal, saldoDisponivelInformado: avail ? parseBRNumber(avail) : undefined });
  // Período do próprio arquivo (DTSTART/DTEND): vale mesmo sem lançamentos e estende o fim até a data do extrato.
  const dtStart = toIsoDate(content.match(/<DTSTART>([^<\r\n]+)/i)?.[1] ?? '');
  const dtEnd = toIsoDate(content.match(/<DTEND>([^<\r\n]+)/i)?.[1] ?? '');
  if (dtStart && (!r.periodoInicio || dtStart < r.periodoInicio)) r.periodoInicio = dtStart;
  const hoje = new Date().toISOString().slice(0, 10);
  if (dtEnd && dtEnd <= hoje && (!r.periodoFim || dtEnd > r.periodoFim)) r.periodoFim = dtEnd;
  // Saldo com data posterior ao extrato (ex.: Inter informa o saldo do dia do download): não é o saldo do fim do período.
  const asOf = toIsoDate(content.match(/<LEDGERBAL>[\s\S]*?<DTASOF>([^<\r\n]+)/i)?.[1] ?? '');
  if (asOf && r.periodoFim && asOf > r.periodoFim && r.saldoFinalInformado !== undefined) {
    avisosExtra.push(`O saldo do arquivo (R$ ${r.saldoFinalInformado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é de ${asOf.split('-').reverse().join('/')}, depois do fim do extrato; não usado na conferência.`);
    r.saldoAtualCabecalho = r.saldoFinalInformado;
    r.saldoFinalInformado = undefined;
  }
  r.avisos = [...avisoBloqueados(bloqN, bloqT), ...avisosExtra];
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
  let bloqN = 0, bloqT = 0;
  let saldoConta: number | undefined; let saldoContaData: string | undefined;
  let investido: number | undefined; let saldoTotal: number | undefined;
  let fundos: number | undefined; let inFundos = false;
  const all = stripAccents(lines.join(' '));
  // Só o PDF do Banco do Brasil é usado apenas para futuros/saldos (os efetivados vêm do OFX).
  // Sicredi: saldos vêm no rodapé ("Saldo Atual", "Saldo bloqueado", "Saldo de investimentos com resgate automático").
  const isSicredi = /saldo de investimentos com resgate autom/i.test(all);
  let sicData: string | undefined; let sicBloq: number | undefined;
  const isBB = /banco do brasil|bb\.com\.br|bb rende facil|invest\.?\s*resgate\s*autom|s a l d o|total diario/i.test(all);
  // Ano de referência para bancos que imprimem a data sem ano (ex.: Sicoob "01/09").
  const anoRef = all.match(/\d{2}\/\d{2}\/(\d{4})/)?.[1] ?? String(new Date().getFullYear());
  const VAL = /(-?\s?R?\$?\s?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[DC*]|\s?-(?!\s?\d))?)/gi;
  const lastVal = (s: string) => { const v = [...s.matchAll(VAL)].map(m => m[1]); return v.length ? parseBRNumber(v[v.length - 1]) : undefined; };
  // Sicoob e outros: o PDF quebra o lançamento em pedaços — o valor pode vir sozinho na linha
  // de cima e o marcador D/C sozinho na linha de baixo. Juntamos os pedaços (não se aplica ao BB).
  let pendVal: string | undefined;
  let semMarcador: ParsedBankTx | null = null;
  let saldoAnterior: number | undefined;
  // BB: a linha logo abaixo do lançamento traz o complemento (quem pagou/recebeu).
  let bbUltimo: ParsedBankTx | null = null;
  const bbLimpa = (d: string) => d
    .replace(/^(\d{2}\/\d{2}\/\d{4}\s+)?\d{4}\s+\d{5}\s+/, '')
    .replace(/\s+[\d.]+$/, '').trim();
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const plain = stripAccents(line);
    if (isBB && !line) continue;
    if (isBB && bbUltimo && line && !/^\d{2}\/\d{2}\/\d{4}\s/.test(line)) {
      const comp = line.replace(/^\d{2}\/\d{2}\s+\d{2}:\d{2}\s+/, '').replace(/^[\d.\/-]{8,}\s+/, '').replace(/^\d{3}\s+\d{4}\s+\d{11,14}\s+/, '').trim();
      if (comp && !/^(https?:|lancamentos|data\b|cobranca referente)/i.test(stripAccents(comp)) && comp.length <= 60) bbUltimo.descricao = `${bbUltimo.descricao} - ${comp}`;
      bbUltimo = null;
      if (comp && !/^https?:/i.test(comp)) continue;
    }
    bbUltimo = null;
    if (/lancamentos\s+futuros/i.test(plain)) { inFuturos = true; continue; }
    // BB: "Saldo de fundos de investimento" traz o saldo real da aplicação (com rendimento).
    // O "Saldo" do resumo já desconta débitos aprovisionados (futuros) — não usar como total.
    if (/saldo\s+de\s+fundos\s+de\s+investimento/i.test(plain)) { inFundos = true; continue; }
    if (inFundos) { const v = lastVal(line); if (v !== undefined) fundos = Math.round(((fundos ?? 0) + v) * 100) / 100; continue; }
    if (isSicredi && !inFuturos) {
      const md = plain.match(/saldo em (\d{2}\/\d{2}\/\d{4})/i); if (md) { sicData = toIsoDate(md[1]) ?? undefined; continue; }
      if (/^saldo\s+atual/i.test(plain)) { const v = lastVal(line); if (v !== undefined) { saldoConta = v; saldoContaData = sicData; } continue; }
      if (/^saldo\s+bloqueado/i.test(plain)) { sicBloq = lastVal(line); continue; }
      if (/^saldo\s+de\s+investimentos/i.test(plain)) { investido = lastVal(line); continue; }
    }
    if (/^invest\.?\s*resgate\s*autom/i.test(plain)) { investido = lastVal(line); continue; }
    if (/^saldo\s+aprovisionado/i.test(plain)) continue;
    if (/^saldo\s+-?\s*\d/i.test(plain) && investido !== undefined) continue;
    if (!isBB && /^[DC]\*?$/i.test(line)) {
      if (semMarcador) semMarcador.tipo = /^d/i.test(line) ? 'saida' : 'entrada';
      semMarcador = null; continue;
    }
    if (!isBB && /^-?\d{1,3}(?:\.\d{3})*,\d{2}\s?[DC*]?$/i.test(line)) { pendVal = line; continue; }
    const dm = line.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*)$/);
    if (!dm) continue;
    const pv = pendVal; pendVal = undefined; semMarcador = null;
    const data = toIsoDate(dm[1].length === 5 ? `${dm[1]}/${anoRef}` : dm[1]);
    if (!data) continue;
    if (/\bs\s*a\s*l\s*d\s*o\b/i.test(dm[2]) && /anterior/i.test(dm[2]) && !/bloq/i.test(dm[2])) {
      const v = lastVal(dm[2]) ?? (pv ? parseBRNumber(pv) : undefined); if (v !== undefined) saldoAnterior = v;
      continue;
    }
    if (!inFuturos && /\bs\s*a\s*l\s*d\s*o\b/i.test(dm[2]) && !/anterior/i.test(dm[2])) {
      const v = lastVal(dm[2]) ?? (!isBB && pv ? parseBRNumber(pv) : undefined);
      // Alguns PDFs (BB "Extrato de Conta Corrente") listam do dia mais novo para o mais antigo: vale o saldo mais recente.
      if (v !== undefined && (!saldoContaData || data >= saldoContaData)) { saldoConta = v; saldoContaData = data; }
      continue;
    }
    let vals = [...dm[2].matchAll(VAL)].map(m => m[1]);
    let body = dm[2];
    if (!vals.length && !isBB && pv) { vals = [pv]; body = `${dm[2]} ${pv}`; }
    if (!vals.length) continue;
    const valStr = vals.length >= 2 ? vals[vals.length - 2] : vals[0];
    const v = parseBRNumber(valStr);
    let descricao = body.slice(0, body.indexOf(vals[0])).replace(/\s*R\$\s*$/i, '').trim();
    if (isBB) descricao = bbLimpa(descricao);
    if (!descricao || SKIP_RE.test(descricao) || v === 0) continue;
    if (BLOCKED_DEPOSIT_RE.test(descricao) || /\*$/.test(valStr.trim())) { bloqN++; bloqT += Math.abs(v); continue; }
    // Sentido: sinal/marcador D-C; sem marcador, "DÉB."/"PIX EMIT." etc. na descrição indicam saída.
    const s = valStr.trim();
    const temMarcador = /^[-(]/.test(s) || /[-DC)]$/i.test(s);
    const debDesc = /^(deb|debito|pagamento|pgto|pix emit|saque|tarifa)/i.test(stripAccents(descricao));
    const tipo: 'entrada' | 'saida' = v < 0 ? 'saida' : (!temMarcador && debDesc ? 'saida' : 'entrada');
    const tx: ParsedBankTx = { data, descricao, valor: Math.abs(v), tipo };
    if (inFuturos) futuros.push({ ...tx, futuro: true }); else { txs.push(tx); if (isBB) bbUltimo = tx; }
    if (!temMarcador && !isBB) semMarcador = inFuturos ? futuros[futuros.length - 1] : tx;
  }
  // Sicredi: depósito de cheque cujo valor está em "Saldo bloqueado" ainda não conta no saldo.
  if (isSicredi && sicBloq && sicBloq > 0) {
    const i = txs.findIndex(t => t.tipo === 'entrada' && /dep\.?\s*cheque/i.test(stripAccents(t.descricao)) && Math.abs(t.valor - sicBloq!) < 0.005);
    if (i >= 0) { bloqN++; bloqT += txs[i].valor; txs.splice(i, 1); }
  }
  // Conferência interna: saldo anterior + movimento deve dar o saldo final do PDF.
  let avisoFecha: string[] = [];
  if (saldoAnterior !== undefined && saldoConta !== undefined) {
    const mov = txs.reduce((a, t) => a + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    const dif = Math.round((saldoAnterior + mov - saldoConta) * 100) / 100;
    if (Math.abs(dif) >= 0.01) avisoFecha = [`Atenção: a leitura do PDF não fecha com o saldo final do extrato (diferença de ${dif.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Confira as linhas antes de importar.`];
  }
  const saldos: Partial<BankParseResult> = {};
  // BB: sem movimento depois do último saldo, o extrato cobre até a data de emissão/impressão.
  if (isBB && saldoContaData && !inFuturos) {
    const em = all.match(/data de emissao.*?(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? all.match(/impresso .{0,80}? em (\d{2}\/\d{2}\/\d{4})/i)?.[1];
    const emIso = em ? toIsoDate(em) : null;
    if (emIso && emIso > saldoContaData && !txs.some(t => t.data > saldoContaData!)) saldoContaData = emIso;
  }
  if (saldoConta !== undefined && saldoContaData) {
    saldos.saldoFinalInformado = saldoConta;
    saldos.periodoFim = saldoContaData;
    const aplic = fundos ?? investido;
    if (saldoTotal === undefined && aplic !== undefined) saldoTotal = Math.round((saldoConta + aplic) * 100) / 100;
    if (saldoTotal !== undefined) saldos.saldoComAplicacaoInformado = saldoTotal;
  }
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const avisoSaldo = saldos.saldoComAplicacaoInformado !== undefined
    ? [`Saldos lidos do PDF em ${saldoContaData!.split('-').reverse().join('/')}: em conta ${fmt(saldoConta!)} · total com aplicação ${fmt(saldos.saldoComAplicacaoInformado)}.`]
    : [];
  if (isBB && (futuros.length || saldos.saldoComAplicacaoInformado !== undefined)) {
    const r = finish('pdf', [...txs, ...futuros], { avisos: [
      ...avisoSaldo,
      ...avisoFecha,
      `${txs.length} lançamento(s) efetivado(s) lidos do PDF. Os que já existirem na conta (mesma data, valor e sentido, ex.: vindos do OFX) não serão gravados de novo.`,
      ...(futuros.length ? [`${futuros.length} lançamento(s) futuro(s) entram como "Previsto — aguardando extrato" e são trocados pelo real quando ele chegar.`] : []),
    ] });
    const efet = txs.map(t => t.data).sort();
    return { ...r, ...saldos, periodoInicio: efet[0] ?? saldos.periodoFim ?? r.periodoInicio, periodoFim: saldos.periodoFim ?? r.periodoFim };
  }
  // Demais bancos (ex.: Sicoob): efetivados + futuros como previstos.
  const r = finish('pdf', [...txs, ...futuros], { avisos: [
    ...avisoSaldo,
    ...avisoFecha,
    ...avisoBloqueados(bloqN, bloqT),
    'Leitura de PDF é aproximada: confira cada linha, os totais e o sentido (entrada/saída) antes de importar.',
    ...(futuros.length ? [`${futuros.length} lançamento(s) futuro(s) entram como "Previsto — aguardando extrato" e são trocados pelo real quando ele chegar.`] : []),
  ] });
  const efet = txs.map(t => t.data).sort();
  return { ...r, ...saldos, periodoInicio: efet[0] ?? r.periodoInicio, periodoFim: saldos.periodoFim ?? efet[efet.length - 1] ?? r.periodoFim };
}

/**
 * Itaú também entrega o extrato pelo navegador como PDF somente-imagem. Esta rotina recebe
 * exclusivamente o texto reconhecido da imagem e aceita o resultado apenas quando os saldos
 * diários impressos fecham com os lançamentos. Dados do titular são deliberadamente ignorados.
 */
export function parseItauImageText(text: string): BankParseResult {
  const normalized = text.replace(/\u00a0/g, ' ');
  const lines = normalized.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const joined = stripAccents(normalized).toLowerCase();
  if (!joined.includes('itau') || !joined.includes('extrato') || !joined.includes('lancamentos')) {
    throw new Error('A imagem não foi reconhecida como um extrato do Itaú. Nada foi importado.');
  }

  const moneyAtEnd = /(-?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
  const saldoHeaderMatch = normalized.match(/saldo em conta[\s\S]{0,180}?R\$\s*(-?\s*\d{1,3}(?:\.\d{3})*,\d{2})/i);
  const periodo = normalized.match(/per[ií]odo de visualiza[cç][aã]o:\s*de\s*(\d{2}\/\d{2}\/\d{4})\s*at[eé]\s*(\d{2}\/\d{2}\/\d{4})/i);
  const saldoAtualCabecalho = saldoHeaderMatch ? parseBRNumber(saldoHeaderMatch[1]) : undefined;
  let saldoAnterior: number | undefined;
  const saldosDiarios = new Map<string, number>();
  type VisualTx = ParsedBankTx & { sinalExplicito: boolean };
  const visualTxs: VisualTx[] = [];

  for (const line of lines) {
    const dm = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (!dm) continue;
    const data = toIsoDate(dm[1]);
    let valueMatch = dm[2].match(moneyAtEnd);
    // Em valores muito pequenos e verdes, o OCR do PDF do Itaú pode apagar a vírgula
    // ("0,16" vira "016"). Só aceitamos essa correção em rendimento identificado.
    if (!valueMatch && /rend pago aplic aut mais/i.test(stripAccents(dm[2]))) {
      const compact = dm[2].match(/\b(\d{3})\s*$/);
      if (compact) {
        const corrected = `${compact[1][0]},${compact[1].slice(1)}`;
        valueMatch = Object.assign([compact[0], corrected], { index: compact.index ?? 0, input: dm[2], groups: undefined }) as RegExpMatchArray;
      }
    }
    if (!data || !valueMatch) continue;
    const valor = parseBRNumber(valueMatch[1]);
    const descricao = dm[2].slice(0, valueMatch.index).trim();
    const plain = stripAccents(descricao).toLowerCase();
    if (/saldo anterior/.test(plain)) { saldoAnterior = valor; continue; }
    if (/saldo total disponivel dia/.test(plain)) { saldosDiarios.set(data, valor); continue; }
    if (!descricao || valor === 0 || /saldo/.test(plain)) continue;
    visualTxs.push({ data, descricao, valor: Math.abs(valor), tipo: valor < 0 ? 'saida' : 'entrada', sinalExplicito: /^\s*-/.test(valueMatch[1]) });
  }

  if (saldoAnterior === undefined || saldosDiarios.size === 0 || visualTxs.length === 0) {
    throw new Error('Não foi possível ler com segurança o saldo e os lançamentos deste PDF do Itaú. Nada foi importado.');
  }

  const divergencias: string[] = [];
  let saldoCalculado = saldoAnterior;
  const datasSaldo = [...saldosDiarios.keys()].sort();
  let ultimaData = '';
  for (const dataSaldo of datasSaldo) {
    const trecho = visualTxs.filter(t => t.data > ultimaData && t.data <= dataSaldo);
    const informado = saldosDiarios.get(dataSaldo) ?? 0;
    const semSinal = trecho.filter(t => !t.sinalExplicito);
    // Quando a imagem apaga um sinal, os saldos oficiais tornam o sentido determinístico.
    // Testamos as combinações e só aceitamos se houver uma única solução exata.
    const possibilidades: Array<Array<'entrada' | 'saida'>> = [];
    if (semSinal.length <= 12) {
      for (let mask = 0; mask < 2 ** semSinal.length; mask++) {
        const kinds = semSinal.map((_, i) => (mask & (1 << i)) ? 'saida' as const : 'entrada' as const);
        let candidato = saldoCalculado;
        let u = 0;
        trecho.forEach(t => {
          const tipo = t.sinalExplicito ? t.tipo : kinds[u++];
          candidato += tipo === 'entrada' ? t.valor : -t.valor;
        });
        if (Math.abs(candidato - informado) < 0.005) possibilidades.push(kinds);
      }
    }
    if (possibilidades.length === 1) {
      let u = 0;
      trecho.forEach(t => { if (!t.sinalExplicito) t.tipo = possibilidades[0][u++]; });
    }
    trecho.forEach(t => { saldoCalculado += t.tipo === 'entrada' ? t.valor : -t.valor; });
    const diferenca = Math.round((saldoCalculado - informado) * 100) / 100;
    if (Math.abs(diferenca) >= 0.01) {
      divergencias.push(`${dataSaldo.split('-').reverse().join('/')}: diferença de R$ ${fmtBR(Math.abs(diferenca))} entre as linhas reconhecidas e o saldo do banco.`);
    }
    saldoCalculado = informado;
    ultimaData = dataSaldo;
  }

  const ultimoSaldo = saldosDiarios.get(datasSaldo[datasSaldo.length - 1]);
  const diferencaCabecalho = saldoAtualCabecalho !== undefined && ultimoSaldo !== undefined
    ? Math.round((saldoAtualCabecalho - ultimoSaldo) * 100) / 100
    : 0;
  const avisos = [
    'Este PDF do Itaú é uma imagem. A leitura visual exige conferência de todas as linhas antes da importação.',
    ...(Math.abs(diferencaCabecalho) >= 0.01
      ? [`O saldo atual do cabeçalho (${fmtBR(saldoAtualCabecalho ?? 0)}) difere em R$ ${fmtBR(Math.abs(diferencaCabecalho))} do último saldo diário (${fmtBR(ultimoSaldo ?? 0)}). Essa diferença não foi criada como lançamento.`]
      : []),
    ...divergencias,
  ];
  const txs = visualTxs.map(({ sinalExplicito: _sinal, ...tx }) => tx);
  const result = finish('pdf', txs, {
    banco: 'Itaú',
    periodoInicio: periodo ? toIsoDate(periodo[1]) ?? undefined : undefined,
    periodoFim: datasSaldo[datasSaldo.length - 1],
    saldoFinalInformado: ultimoSaldo,
    saldoAtualCabecalho,
    bloqueiaImportacao: divergencias.length > 0,
    divergencias,
    avisos,
  });
  result.periodoInicio = periodo ? toIsoDate(periodo[1]) ?? result.periodoInicio : result.periodoInicio;
  result.periodoFim = datasSaldo[datasSaldo.length - 1] ?? (periodo ? toIsoDate(periodo[2]) ?? result.periodoFim : result.periodoFim);
  return result;
}

/**
 * Caixa "Extrato por período" (pdfmake, somente-imagem). Lê só o texto reconhecido e
 * aceita apenas se, dia a dia, saldo anterior + lançamentos = "SALDO DIA" impresso.
 */
export function parseCaixaImageText(text: string): BankParseResult {
  const lines = text.replace(/\u00a0/g, ' ').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const money = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})\\s*([CD])';
  const ant = text.match(new RegExp(`saldo anterior[^\\n]*?R\\$\\s*${money}`, 'i'));
  const periodo = text.match(/per[ií]odo dos lan[cç]amentos\s*(\d{2}\/\d{2}\/\d{4})\s*at[eé]\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!ant) throw new Error('Não foi possível ler o saldo anterior deste PDF da Caixa. Nada foi importado.');
  const signed = (v: string, cd: string) => (cd.toUpperCase() === 'D' ? -1 : 1) * parseBRNumber(v);
  const saldoAnterior = signed(ant[1], ant[2]);
  const rowRe = new RegExp(`^(\\d{2}\\/\\d{2}\\/\\d{4})\\s*-\\s*(\\d{2}:\\d{2}:\\d{2})\\s+(\\d+)\\s+(.+?)\\s+${money}\\s+${money}$`, 'i');
  const saldosDia = new Map<string, number>();
  const rows: Array<ParsedBankTx & { hora: string; saldoLinha: number }> = [];
  for (const line of lines) {
    const m = line.match(rowRe);
    if (!m) continue;
    const data = toIsoDate(m[1]);
    if (!data) continue;
    const desc = m[4].replace(/\s*\*\*[\d./*]+\s*$/, '').trim();
    if (/^saldo dia/i.test(stripAccents(desc))) { saldosDia.set(data, signed(m[7], m[8])); continue; }
    const valor = parseBRNumber(m[5]);
    if (!valor) continue;
    rows.push({ data, hora: m[2], descricao: desc, valor, tipo: m[6].toUpperCase() === 'D' ? 'saida' : 'entrada', saldoLinha: signed(m[7], m[8]) });
  }
  if (rows.length === 0 || saldosDia.size === 0) throw new Error('Não foi possível ler com segurança os lançamentos deste PDF da Caixa. Nada foi importado.');
  rows.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const divergencias: string[] = [];
  // Fechamento por dia: usa "SALDO DIA" quando reconhecido; senão, o saldo impresso na própria linha
  // (na Caixa, cada linha traz o saldo de fechamento do dia).
  const fechamento = new Map<string, number>(saldosDia);
  for (const r of rows) if (!fechamento.has(r.data)) fechamento.set(r.data, r.saldoLinha);
  let saldo = saldoAnterior;
  for (const dia of [...new Set(rows.map(r => r.data))].sort()) {
    rows.filter(r => r.data === dia).forEach(r => { saldo += r.tipo === 'entrada' ? r.valor : -r.valor; });
    saldo = Math.round(saldo * 100) / 100;
    const esperado = fechamento.get(dia)!;
    const diff = Math.round((saldo - esperado) * 100) / 100;
    if (Math.abs(diff) >= 0.01) { divergencias.push(`${dia.split('-').reverse().join('/')}: diferença de R$ ${fmtBR(Math.abs(diff))} entre as linhas reconhecidas e o saldo do banco.`); saldo = esperado; }
  }
  const dias = [...saldosDia.keys()].sort();
  const ultimoSaldo = saldosDia.get(dias[dias.length - 1])!;
  if (dias[dias.length - 1] >= rows[rows.length - 1].data && Math.abs(saldo - ultimoSaldo) >= 0.01 && !divergencias.length)
    divergencias.push(`Saldo final não fecha: calculado R$ ${fmtBR(saldo)}, banco R$ ${fmtBR(ultimoSaldo)}.`);
  const txs = rows.map(({ hora: _h, ...t }) => t);
  const fim = periodo ? toIsoDate(periodo[2]) ?? dias[dias.length - 1] : dias[dias.length - 1];
  const result = finish('pdf', txs, {
    banco: 'Caixa',
    periodoInicio: periodo ? toIsoDate(periodo[1]) ?? undefined : undefined,
    periodoFim: fim,
    saldoFinalInformado: saldosDia.get(dias[dias.length - 1]),
    bloqueiaImportacao: divergencias.length > 0,
    divergencias,
    avisos: ['Este PDF da Caixa é uma imagem. A leitura visual exige conferência de todas as linhas antes da importação.', ...divergencias],
  });
  if (periodo) result.periodoInicio = toIsoDate(periodo[1]) ?? result.periodoInicio;
  result.periodoFim = fim ?? result.periodoFim;
  return result;
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

async function readPdfImageText(buf: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const { createWorker, PSM } = await import('tesseract.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const worker = await createWorker('por');
  // O extrato é uma única tabela; este modo preserva data, descrição e valor na mesma linha.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  const parts: string[] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      // Aproxima 300 dpi para preservar vírgulas e sinais em valores pequenos.
      const viewport = page.getViewport({ scale: 4.2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Não foi possível preparar a leitura visual do PDF.');
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      parts.push(result.data.text);
    }
  } finally {
    await worker.terminate();
  }
  return parts.join('\n');
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
  if (name.endsWith('.pdf')) {
    const buffer = await file.arrayBuffer();
    const lines = await readPdfLines(buffer.slice(0));
    // PDF "print da tela"/foto não tem camada de texto: nada é legível e a conferência
    // ficaria vazia sem explicação. Avisamos o que enviar no lugar.
    if (lines.join('').replace(/\s+/g, '').length < 40) {
      const recognized = await readPdfImageText(buffer);
      const plain = stripAccents(recognized).toLowerCase();
      if (plain.includes('caixa') && plain.includes('saldo dia')) return parseCaixaImageText(recognized);
      return parseItauImageText(recognized);
    }
    return parsePdfLines(lines);
  }
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
