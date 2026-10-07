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
  /** Cheque/depósito bloqueado: já está nos lançamentos, mas fora do saldo disponível impresso. */
  saldoRetidoInformado?: number;
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
  const bradSeen = new Set<string>(); let bradDup = 0;
  for (const s of content.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi)) {
    const body = s[1];
    const data = toIsoDate(body.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1] ?? '');
    const valor = parseBRNumber(body.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] ?? '0');
    const memo = (body.match(/<MEMO>([^<\r\n]+)/i)?.[1] ?? body.match(/<NAME>([^<\r\n]+)/i)?.[1] ?? '').trim();
    const fitid = body.match(/<FITID>([^<\r\n]+)/i)?.[1]?.trim();
    if (!data || valor === 0) continue;
    // Bradesco repete no OFX o lançamento exibido também em "Últimos lançamentos" (mesmo documento, outro FITID).
    const checknum = body.match(/<CHECKNUM>([^<\r\n]+)/i)?.[1]?.trim();
    if (bank && /^0*237$/.test(bank) && checknum) {
      const k = `${data}|${valor}|${checknum}|${memo}`;
      if (bradSeen.has(k)) { bradDup++; continue; }
      bradSeen.add(k);
    }
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
  // Só está em compensação se o cheque for do último dia do próprio arquivo (DTEND); se o extrato
  // vai além (ex.: até 02/10 com cheque de 30/09), o cheque já compensou e está no saldo.
  const fileEnd = toIsoDate(content.match(/<DTEND>([^<\r\n]+)/i)?.[1] ?? '');
  const chequeAindaRetido = !fileEnd || fileEnd <= lastDate;
  const chequesComp = chequeAindaRetido ? txs.filter(t => t.data === lastDate && t.tipo === 'entrada' && /^cheque recebido/i.test(t.descricao)) : [];
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
  if (bradDup) avisosExtra.push(`${bradDup} lançamento(s) repetido(s) pelo Bradesco no arquivo (mesmo documento, data e valor) foram considerados uma vez só.`);
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

const MESES_ABREV: Record<string, string> = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };

/**
 * Planilha "Fluxo de caixa" da equipe (ex.: Pinheirinho – CEF): colunas "Saldo inicial:", Data, Valor,
 * Observação, Tipo Movimentação, Categoria, Entrada/Saída, Saldo. Sentido SEMPRE pela coluna "Entrada/Saída";
 * a coluna "Saldo" confere linha a linha e qualquer diferença bloqueia a importação.
 */
export function parseCashFlowSheet(rows: unknown[][]): BankParseResult | null {
  const norm = (v: unknown) => stripAccents(String(v ?? '').toLowerCase().trim());
  const h = rows.slice(0, 15).findIndex(r => {
    const c = (r ?? []).map(norm);
    return c.some(x => x.startsWith('saldo inicial')) && c.some(x => /^entrada\s*\/\s*saida$/.test(x)) && c.includes('data') && c.includes('valor');
  });
  if (h < 0) return null;
  const hdr = (rows[h] ?? []).map(norm);
  const iIni = hdr.findIndex(x => x.startsWith('saldo inicial'));
  const iData = hdr.indexOf('data'), iValor = hdr.indexOf('valor');
  const iCD = hdr.findIndex(x => /^entrada\s*\/\s*saida$/.test(x));
  const iSaldo = hdr.findIndex(x => x === 'saldo');
  const iDesc = hdr.findIndex(x => /observ|descri|histor|empresa/.test(x));
  const ano = rows.slice(0, h).flat().map(c => String(c ?? '').match(/\b(20\d{2})\b/)?.[1]).find(Boolean);
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v ?? '').trim();
    return s && /\d/.test(s) ? parseBRNumber(s) : null;
  };
  const toIso = (v: unknown): string | null => {
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN((v as Date).getTime())) return new Date((v as Date).getTime() + 12 * 3600e3).toISOString().slice(0, 10);
    const s = norm(v);
    const m = s.match(/^(\d{1,2})[/\-.\s]([a-z]{3})/);
    if (m && MESES_ABREV[m[2]] && ano) return `${ano}-${MESES_ABREV[m[2]]}-${m[1].padStart(2, '0')}`;
    return toIsoDate(String(v ?? ''));
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let saldo: number | undefined;
  const txs: ParsedBankTx[] = [];
  const divergencias: string[] = [];
  rows.slice(h + 1).forEach((r, k) => {
    if (!r) return;
    const linha = h + 2 + k;
    if (saldo === undefined && iIni >= 0) { const ini = num(r[iIni]); if (ini !== null) saldo = r2(ini); }
    const data = toIso(r[iData]);
    const v = num(r[iValor]);
    if (!data || v === null || v === 0) return; // linhas só com fórmulas
    const cd = norm(r[iCD]);
    const tipo: 'entrada' | 'saida' | null = cd.startsWith('entrada') ? 'entrada' : cd.startsWith('saida') ? 'saida' : null;
    if (!tipo) { divergencias.push(`Linha ${linha}: coluna "Entrada/Saída" vazia.`); return; }
    const valor = r2(Math.abs(v));
    txs.push({ data, descricao: (iDesc >= 0 ? String(r[iDesc] ?? '').trim() : '') || 'Lançamento', valor, tipo });
    if (saldo !== undefined) {
      saldo = r2(saldo + (tipo === 'entrada' ? valor : -valor));
      const imp = iSaldo >= 0 ? num(r[iSaldo]) : null;
      if (imp !== null && Math.abs(imp - saldo) > 0.01) divergencias.push(`Linha ${linha} (${data.split('-').reverse().join('/')}): saldo da planilha ${imp.toFixed(2)}, calculado ${saldo.toFixed(2)}.`);
    }
  });
  if (!txs.length) return null;
  if (saldo === undefined) divergencias.unshift('Saldo inicial não encontrado na coluna "Saldo inicial:".');
  const res = finish('xlsx', txs, { saldoFinalInformado: divergencias.length ? undefined : saldo, bloqueiaImportacao: divergencias.length > 0, divergencias });
  res.avisos = [`Planilha de fluxo de caixa: ${txs.length} lançamento(s); sentido pela coluna "Entrada/Saída", conferidos pelo saldo.`, ...divergencias];
  return res;
}

export function parseCSV(content: string): BankParseResult {
  const bb = parseBancoDoBrasilCSV(content);
  if (bb) return finish('csv', bb, { banco: 'Banco do Brasil' });
  const wb = XLSX.read(content, { type: 'string', raw: true });
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const cf = parseCashFlowSheet(rows);
  if (cf) { cf.formato = 'csv'; return cf; }
  return finish('csv', rowsToTx(rows));
}

export const TEMPLATE_HEADER = ['Data', 'Descrição', 'Entrada', 'Saída', 'Saldo do dia'];

/** Gera o modelo de planilha de extrato (quando o PDF do banco não pode ser lido). */
export function buildBankTemplateXlsx(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADER,
    ['Saldo anterior', '', '', '', 0],
    ['01/09/2026', 'Exemplo: tarifa (apague esta linha)', '', 75, -75],
  ]);
  ws['!cols'] = [{ wch: 14 }, { wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

/**
 * Modelo de planilha do sistema. Sentido pela coluna (Entrada/Saída); "Saldo do dia", quando preenchido,
 * confere linha a linha. Qualquer diferença bloqueia a importação.
 */
export function parseBankTemplate(rows: unknown[][]): BankParseResult | null {
  const norm = (v: unknown) => stripAccents(String(v ?? '').toLowerCase().trim());
  const want = TEMPLATE_HEADER.map(norm);
  const h = rows.slice(0, 10).findIndex(r => want.every((w, j) => norm(r?.[j]) === w));
  if (h < 0) return null;
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v ?? '').trim();
    return s && /\d/.test(s) ? parseBRNumber(s) : null;
  };
  const toIso = (v: unknown): string | null => {
    if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getTime() + 12 * 3600e3).toISOString().slice(0, 10);
    return toIsoDate(String(v ?? ''));
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let saldo: number | undefined;
  const txs: ParsedBankTx[] = [];
  const divergencias: string[] = [];
  rows.slice(h + 1).forEach((r, k) => {
    if (!r || r.every(c => String(c ?? '').trim() === '')) return;
    const linha = h + 2 + k;
    if (norm(r[0]).startsWith('saldo anterior')) { saldo = r2(num(r[4]) ?? num(r[2]) ?? 0); return; }
    const data = toIso(r[0]);
    if (!data) { divergencias.push(`Linha ${linha}: data inválida.`); return; }
    const ent = num(r[2]), sai = num(r[3]);
    if ((ent && sai) || (!ent && !sai)) { divergencias.push(`Linha ${linha}: preencha Entrada OU Saída.`); return; }
    const tipo = ent ? 'entrada' : 'saida';
    const valor = r2(Math.abs((ent ?? sai) as number));
    txs.push({ data, descricao: String(r[1] ?? '').trim() || 'Lançamento', valor, tipo });
    if (saldo !== undefined) {
      saldo = r2(saldo + (tipo === 'entrada' ? valor : -valor));
      const imp = num(r[4]);
      if (imp !== null && Math.abs(imp - saldo) > 0.01) divergencias.push(`Linha ${linha} (${data.split('-').reverse().join('/')}): saldo da planilha ${imp.toFixed(2)}, calculado ${saldo.toFixed(2)}.`);
    }
  });
  if (saldo === undefined) divergencias.unshift('Falta a linha "Saldo anterior" com o valor na coluna "Saldo do dia".');
  if (!txs.length) divergencias.push('Nenhum lançamento preenchido.');
  return finish('xlsx', txs, {
    saldoFinalInformado: divergencias.length ? undefined : saldo,
    bloqueiaImportacao: divergencias.length > 0,
    divergencias,
  });
}

export function parseXLSX(buffer: ArrayBuffer): BankParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const tpl = parseBankTemplate(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }));
  const cf = parseCashFlowSheet(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }));
  if (cf) return cf;
  if (tpl) { tpl.avisos = [`Modelo de planilha do sistema: ${tpl.transactions.length} lançamento(s), conferidos pelo saldo.`, ...(tpl.divergencias ?? [])]; return tpl; }
  const bb = parseBancoDoBrasilXLSX(rows);
  if (bb) return finish('xlsx', bb, { banco: 'Banco do Brasil' });
  const txs = rowsToTx(rows);
  if (txs.length) return finish('xlsx', txs);
  const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  return parseLooseCashSheet(raw) ?? finish('xlsx', []);
}

/**
 * Planilha manual (ex.: caixa em dinheiro) sem títulos "Data"/"Valor": data e valor são descobertos
 * pelo conteúdo; o sentido vem da coluna "Entrada/Saída" e a coluna "Saldo" confere linha a linha.
 */
export function parseLooseCashSheet(rows: unknown[][]): BankParseResult | null {
  const norm = (v: unknown) => stripAccents(String(v ?? '').toLowerCase().trim());
  const toIso = (v: unknown): string | null => {
    if (v instanceof Date && !isNaN(v.getTime())) {
      const d = new Date(v.getTime() + 12 * 3600e3); // evita deslocamento de fuso
      return d.toISOString().slice(0, 10);
    }
    return typeof v === 'string' ? toIsoDate(v) : null;
  };
  const num = (v: unknown): number | null => typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && /\d/.test(v) && !isNaN(parseBRNumber(v)) ? parseBRNumber(v) : null);
  let h = -1, iCD = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const idx = (rows[i] ?? []).findIndex(c => /^entrada\s*\/\s*saida$/.test(norm(c)));
    if (idx >= 0) { h = i; iCD = idx; break; }
  }
  if (h < 0) return null;
  const header = (rows[h] ?? []).map(norm);
  const iSaldo = header.findIndex(c => c.startsWith('saldo'));
  const iDesc = header.findIndex(c => /observ|descri|histor|empresa/.test(c));
  const width = Math.max(...rows.slice(h, h + 40).map(r => r?.length ?? 0));
  const dateHits = new Array(width).fill(0);
  for (const r of rows.slice(h + 1, h + 40)) r?.forEach((c, j) => { if (toIso(c)) dateHits[j]++; });
  const iData = dateHits.indexOf(Math.max(...dateHits));
  if (iData < 0 || dateHits[iData] === 0) return null;
  let iValor = -1;
  for (let j = 0; j < width && iValor < 0; j++) {
    if (j === iData || j === iSaldo || j === iCD || header[j]) continue;
    if (rows.slice(h + 1, h + 40).some(r => toIso(r?.[iData]) && num(r?.[j]) !== null)) iValor = j;
  }
  if (iValor < 0) return null;
  let saldoAnterior: number | undefined;
  let saldo: number | undefined;
  let quebra: string | undefined;
  const txs: ParsedBankTx[] = [];
  for (const r of rows.slice(h + 1)) {
    if (!r) continue;
    const label = norm(r[iData]);
    if (saldoAnterior === undefined && label.startsWith('saldo')) { saldoAnterior = Math.round((num(r[iValor]) ?? 0) * 100) / 100; saldo = saldoAnterior; continue; }
    const data = toIso(r[iData]);
    const v = num(r[iValor]);
    if (!data || v === null || v === 0) continue;
    const cd = norm(r[iCD]);
    const tipo: 'entrada' | 'saida' | null = cd.startsWith('entrada') ? 'entrada' : cd.startsWith('saida') ? 'saida' : null;
    if (!tipo) continue;
    const valor = Math.round(Math.abs(v) * 100) / 100;
    const descricao = (iDesc >= 0 ? String(r[iDesc] ?? '').trim() : '') || 'Lançamento';
    txs.push({ data, descricao, valor, tipo });
    if (saldo !== undefined) {
      saldo = Math.round((saldo + (tipo === 'entrada' ? valor : -valor)) * 100) / 100;
      const impresso = iSaldo >= 0 ? num(r[iSaldo]) : null;
      if (impresso !== null && Math.abs(impresso - saldo) > 0.01 && !quebra) quebra = `Saldo não fecha em ${data.split('-').reverse().join('/')} (${descricao}): planilha ${impresso.toFixed(2)}, calculado ${saldo.toFixed(2)}.`;
    }
  }
  if (!txs.length) return null;
  const avisos = [`Planilha manual lida pelo conteúdo: ${txs.length} lançamento(s); sentido pela coluna "Entrada/Saída".`];
  if (quebra) avisos.push(quebra);
  const r = finish('xlsx', txs, { saldoFinalInformado: quebra ? undefined : saldo });
  r.avisos = avisos;
  return r;
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
  let sicData: string | undefined; let sicBloq: number | undefined; let sicRetido: number | undefined;
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
    // O lançamento fica (o Sicredi não cria outra linha ao liberar); o valor vira "retido", como no Inter.
    sicRetido = Math.round(sicBloq * 100) / 100;
  }
  // Conferência interna: saldo anterior + movimento deve dar o saldo final do PDF.
  let avisoFecha: string[] = [];
  if (saldoAnterior !== undefined && saldoConta !== undefined) {
    const mov = txs.reduce((a, t) => a + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    const dif = Math.round((saldoAnterior + mov - saldoConta - (sicRetido ?? 0)) * 100) / 100;
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
    if (sicRetido) saldos.saldoRetidoInformado = sicRetido;
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
    ...(sicRetido ? [`Cheque bloqueado de R$ ${fmt(sicRetido)}: o lançamento entra normalmente e o valor aparece como "bloqueado" até a liberação (em conta ${fmt(saldoConta!)}).`] : []),
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
  // rows já está em ordem de horário: o último lançamento do dia traz o saldo de fechamento.
  for (const r of rows) if (!saldosDia.has(r.data)) fechamento.set(r.data, r.saldoLinha);
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
  const txs = rows.map(({ hora: _h, saldoLinha: _s, ...t }) => t);
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

const MESES_PT: Record<string, string> = { janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };

/**
 * Extrato PicPay (PDF com texto): blocos por dia "dd de mês aaaa — Saldo ao final do dia".
 * O sentido vem do indicador impresso pelo banco (+R$ crédito / −R$ débito). Cada dia precisa fechar
 * com o saldo do fim do dia; qualquer diferença bloqueia a importação.
 */
export function parsePicPayLines(lines: string[]): BankParseResult {
  const dayRe = /^\s*(\d{1,2}) de ([a-zç]+) (\d{4})\s+saldo ao final do dia:\s*(-|−)?\s*r\$\s*([\d.,]+)/i;
  const txRe = /^\s*(\d{2}:\d{2})\s+(.+?)\s*([+\-−])\s*R\$\s*([\d.]+,\d{2})\s*$/;
  const skipRe = /^\s*(hora|tipo|documento emitido|\d{2}\/\d{2}\/\d{4} às|\d+ de \d+$|cpf:|extrato de conta|per[ií]odo|saldo final do per)/i;
  const saldos = new Map<string, number>();
  const txs: (ParsedBankTx & { prev: string; needsNext: boolean })[] = [];
  let dia: string | null = null;
  let prev = '';
  let last: (typeof txs)[number] | null = null;
  const titular = lines.find(l => l.trim())?.trim() ?? '';
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, '');
    const plain = stripAccents(l.toLowerCase());
    const d = plain.match(dayRe);
    if (d && MESES_PT[d[2]]) {
      dia = `${d[3]}-${MESES_PT[d[2]]}-${d[1].padStart(2, '0')}`;
      saldos.set(dia, (d[4] ? -1 : 1) * parseBRNumber(d[5]));
      prev = ''; last = null; continue;
    }
    const t = l.match(txRe);
    if (t && dia) {
      const cols = t[2].split(/\s{3,}/).map(c => c.trim()).filter(c => c && !/^com saldo$/i.test(c));
      const tipoTx = cols[0] ?? 'Lançamento';
      const nome = cols.slice(1).join(' ').replace(/\s*com saldo$/i, '').trim();
      const tx = { data: dia, descricao: nome ? `${tipoTx} ${nome}` : tipoTx, valor: parseBRNumber(t[4]), tipo: (t[3] === '+' ? 'entrada' : 'saida') as 'entrada' | 'saida', prev, needsNext: !nome && !!prev };
      if (!nome && prev) tx.descricao = `${tipoTx} ${prev}`;
      txs.push(tx); last = tx; prev = ''; continue;
    }
    if (skipRe.test(l) || !l.trim() || l.trim() === titular) { prev = ''; continue; }
    if (last?.needsNext) { last.descricao = `${last.descricao} ${l.trim()}`; last.needsNext = false; prev = ''; last = null; continue; }
    prev = l.trim(); last = null;
  }
  const out: ParsedBankTx[] = txs.map(({ data, descricao, valor, tipo }) => ({ data, descricao: descricao.replace(/\s+/g, ' '), valor, tipo }));
  const dias = [...saldos.keys()].sort();
  const divergencias: string[] = [];
  const net = new Map<string, number>();
  for (const x of out) net.set(x.data, Math.round(((net.get(x.data) ?? 0) + (x.tipo === 'entrada' ? x.valor : -x.valor)) * 100) / 100);
  for (let i = 1; i < dias.length; i++) {
    const esperado = Math.round((saldos.get(dias[i - 1])! + (net.get(dias[i]) ?? 0)) * 100) / 100;
    if (Math.abs(esperado - saldos.get(dias[i])!) > 0.01) divergencias.push(`Dia ${dias[i].split('-').reverse().join('/')}: saldo do extrato ${saldos.get(dias[i])!.toFixed(2)}, calculado ${esperado.toFixed(2)}.`);
  }
  const all = lines.join('\n');
  const finalM = stripAccents(all).match(/Saldo final do periodo[\s\S]{0,120}?R\$\s*([\d.]+,\d{2})/i);
  const saldoFim = dias.length ? saldos.get(dias[dias.length - 1])! : undefined;
  if (finalM && saldoFim !== undefined && Math.abs(parseBRNumber(finalM[1]) - saldoFim) > 0.01) divergencias.push(`Saldo final do período (${finalM[1]}) diferente do último dia (${saldoFim.toFixed(2)}).`);
  if (!out.length) divergencias.push('Nenhum lançamento lido neste PDF do PicPay.');
  const per = stripAccents(all).match(/(\d{1,2}) de ([a-z]+) de (\d{4}) a\s+(?:R\$\s*[\d.,]+\s+)?(\d{1,2}) de ([a-z]+) de (\d{4})/i);
  const res = finish('pdf', out, { banco: 'PicPay', saldoFinalInformado: divergencias.length ? undefined : saldoFim, bloqueiaImportacao: divergencias.length > 0, divergencias });
  if (per && MESES_PT[per[2].toLowerCase()] && MESES_PT[per[5].toLowerCase()]) {
    res.periodoInicio = `${per[3]}-${MESES_PT[per[2].toLowerCase()]}-${per[1].padStart(2, '0')}`;
    res.periodoFim = `${per[6]}-${MESES_PT[per[5].toLowerCase()]}-${per[4].padStart(2, '0')}`;
  }
  res.avisos = [`Extrato PicPay: ${out.length} lançamento(s) em ${dias.length} dia(s), conferidos pelo saldo do fim de cada dia.`, ...divergencias];
  return res;
}

export const isBradescoPdf = (lines: string[]) => {
  const all = stripAccents(lines.join(' '));
  return /extrato mensal \/ por periodo/i.test(all) && /total disponivel/i.test(all) && /dcto\./i.test(all);
};

/**
 * Bradesco "Extrato Mensal / Por Período": descrição em duas linhas (antes e depois do valor) e
 * um bloco "Últimos Lançamentos" que repete lançamentos já listados. Saldo final = último saldo
 * impresso; "Saldo Invest Fácil" nunca é saldo da conta. Cada bloco precisa fechar com os saldos.
 */
export function parseBradescoPdfLines(lines: string[]): BankParseResult {
  const VALLINE = /^(?:(\d{2}\/\d{2}\/\d{4})\s+)?(.*?)\s*(\d{3,})\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})$/;
  const L = lines.map(l => l.replace(/\s+/g, ' ').trim());
  const out: ParsedBankTx[] = []; const seen = new Set<string>();
  const divergencias: string[] = [];
  let data: string | null = null; let head = ''; let last: ParsedBankTx | null = null;
  let saldo: number | undefined; let saldoFinal: number | undefined; let repetidos = 0;
  for (let i = 0; i < L.length; i++) {
    const line = L[i]; const plain = stripAccents(line);
    if (!line) continue;
    if (/^saldos invest/i.test(plain)) break;
    const sa = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+SALDO ANTERIOR\s+(-?[\d.]+,\d{2})$/i);
    if (sa) { data = toIsoDate(sa[1]); saldo = parseBRNumber(sa[2]); last = null; head = ''; continue; }
    if (/^(total|data |os dados|extrato|agencia|ultimos lanc|\d{5} \|)/i.test(plain)) { last = null; continue; }
    const m = line.match(VALLINE);
    if (m && data !== null || (m && m[1])) {
      if (m![1]) data = toIsoDate(m![1]);
      const v = parseBRNumber(m![4]); const s = parseBRNumber(m![5]);
      const descricao = [head, m![2]].filter(Boolean).join(' ').trim() || 'Lançamento';
      head = '';
      if (saldo !== undefined && Math.abs(Math.round((saldo + v - s) * 100)) >= 1) divergencias.push(`Linha "${descricao}" (${m![4]}) não fecha com o saldo impresso ${m![5]}.`);
      saldo = s; saldoFinal = s;
      const key = `${data}|${m![3]}|${v}`;
      if (seen.has(key)) { repetidos++; last = null; continue; }
      seen.add(key);
      last = { data: data!, descricao, valor: Math.abs(v), tipo: v < 0 ? 'saida' : 'entrada' };
      out.push(last);
      continue;
    }
    // Linha só de texto: cabeçalho do próximo lançamento (se a seguinte for valor sem descrição) ou complemento do anterior.
    const next = L[i + 1]?.match(VALLINE);
    if (next && !next[2]) { head = line; continue; }
    if (last) { last.descricao = `${last.descricao} - ${line}`; last = null; continue; }
    head = line;
  }
  if (saldoFinal === undefined || !out.length) throw new Error('Não foi possível ler os lançamentos deste PDF do Bradesco. Nada foi importado.');
  const res = finish('pdf', out, { banco: 'Bradesco', saldoFinalInformado: saldoFinal });
  const datas = out.map(t => t.data).sort();
  res.periodoInicio = datas[0]; res.periodoFim = datas[datas.length - 1];
  res.saldoFinalInformado = saldoFinal;
  if (divergencias.length) res.bloqueiaImportacao = true;
  res.avisos = [
    `Extrato Bradesco: ${out.length} lançamento(s), saldo final em conta ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    ...(repetidos ? [`${repetidos} lançamento(s) repetido(s) em "Últimos Lançamentos" considerados uma vez só.`] : []),
    'O PDF não separa o valor aplicado: o aplicado segue calculado (informe-o em Contas e Extratos se precisar).',
    ...divergencias,
  ];
  return res;
}

export const isNiboContasPdf = (lines: string[]) => {
  const all = stripAccents(lines.join(' '));
  return /contas & extratos/i.test(all) && /identif\./i.test(all) && /saldo anterior/i.test(all);
};

/**
 * Nibo "Contas & Extratos": a data aparece só na 1ª linha de cada dia; saídas vêm entre parênteses;
 * o "Saldo" impresso (no fim do dia) é usado para conferir — se não fechar, bloqueia a importação.
 */
export function parseNiboContasPdfLines(lines: string[]): BankParseResult {
  const MONEY = /\(?-?[\d.]+,\d{2}\)?/;
  const TAIL = new RegExp(`^(?:(\\d{2}\\/\\d{2}\\/\\d{2,4})\\s+)?(.*?)\\s*(${MONEY.source})(?:\\s+(${MONEY.source}))?$`);
  const val = (s: string) => (s.startsWith('(') || s.startsWith('-') ? -1 : 1) * parseBRNumber(s.replace(/[()\-]/g, ''));
  const out: ParsedBankTx[] = []; const divergencias: string[] = [];
  let data: string | null = null; let saldo: number | undefined; let inicial: number | undefined; let started = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const plain = stripAccents(line.toLowerCase());
    if (!line || /^https?:/.test(plain) || /contas & extratos/.test(plain) || /^data nome/.test(plain)) continue;
    const sa = line.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+Saldo anterior\s+(\(?-?[\d.]+,\d{2}\)?)$/i);
    if (sa) { saldo = val(sa[2]); inicial = saldo; started = true; continue; }
    if (!started) continue;
    const m = line.match(TAIL);
    if (!m || (!m[1] && !data) || !m[2]) continue;
    if (m[1]) data = toIsoDate(m[1]);
    if (!data) continue;
    const v = val(m[3]);
    const descricao = m[2].replace(/\bSem descri[cç][aã]o\b/i, '').replace(/\s+/g, ' ').trim() || 'Lançamento';
    out.push({ data, descricao, valor: Math.abs(v), tipo: v < 0 ? 'saida' : 'entrada' });
    if (saldo !== undefined) saldo = Math.round((saldo + v) * 100) / 100;
    if (m[4] !== undefined) {
      const impresso = val(m[4]);
      if (saldo !== undefined && Math.abs(saldo - impresso) > 0.005) {
        divergencias.push(`Dia ${data.split('-').reverse().join('/')}: saldo impresso ${m[4]}, calculado ${saldo.toFixed(2)}.`);
      }
      saldo = impresso;
    }
  }
  if (!out.length || inicial === undefined) throw new Error('Não foi possível ler os lançamentos deste PDF do Nibo. Nada foi importado.');
  const res = finish('pdf', out, { banco: 'Nibo', saldoFinalInformado: divergencias.length ? undefined : saldo, bloqueiaImportacao: divergencias.length > 0, divergencias });
  const datas = out.map(t => t.data).sort();
  res.periodoInicio = datas[0]; res.periodoFim = datas[datas.length - 1];
  res.saldoFinalInformado = divergencias.length ? undefined : saldo;
  res.avisos = [`Extrato Nibo: ${out.length} lançamento(s), conferidos pelos saldos impressos.`, ...divergencias];
  return res;
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
    if (isBradescoPdf(lines)) return parseBradescoPdfLines(lines);
    if (isNiboContasPdf(lines)) return parseNiboContasPdfLines(lines);
    if (/picpay servi/i.test(stripAccents(lines.join(' '))) && /saldo ao final do dia/i.test(lines.join(' '))) return parsePicPayLines(lines);
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
/** Hash alternativo quando o código do banco já pertence a OUTRO lançamento (Itaú renumera a cada download). */
export function refCollisionHash(accountId: string, t: ParsedBankTx): Promise<string> {
  return sha256(`${accountId}|ref|${t.bankRef}|${t.data}|${t.tipo}|${t.valor.toFixed(2)}`);
}

/** O lançamento gravado com o mesmo código é de fato o mesmo? (data, sentido e valor iguais) */
export function sameRefTx(row: { data: string; tipo: string; valor: number | string; descricao?: string | null }, t: ParsedBankTx): boolean {
  if (row.data !== t.data || row.tipo !== t.tipo || Math.abs(Number(row.valor) - t.valor) >= 0.005) return false;
  // Bradesco reaproveita o código em outro lançamento do mesmo dia e valor: a descrição desempata.
  return row.descricao == null || normalizeDesc(row.descricao) === normalizeDesc(t.descricao);
}

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
