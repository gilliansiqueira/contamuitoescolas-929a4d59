/**
 * Leitura do "Relatório de Cartão Ponto Individual" (PontoFopag) em PDF.
 * Trabalha com os textos posicionados (x/y) de cada página. CPF e PIS são
 * descartados aqui e nunca saem deste módulo.
 * Situação do dia vem só do que o relatório informa — sem classificar atraso por conta própria.
 */
export interface PdfToken { page: number; x: number; y: number; s: string }

export type CartaoSituacao = 'regular' | 'sem_marcacao' | 'incompleta' | 'falta' | 'hora_extra' | 'aguardando';

export interface CartaoDia {
  dia: string; // yyyy-mm-dd
  jornada: string | null;
  marcacoes: string[];
  trabalhadas: string | null;
  extras: string | null;
  faltas: string | null;
  observacao: string | null;
  situacao: CartaoSituacao;
}
export interface CartaoFuncionario {
  codigo: string; nome: string; matricula: string | null; departamento: string | null; funcao: string | null;
  dias: CartaoDia[];
  totais: { trabalhadas: string | null; extras: string | null; faltas: string | null };
  somados: { trabalhadas: string; extras: string; faltas: string };
  divergencias: string[];
}
export interface CartaoRelatorio {
  periodoInicio: string | null; periodoFim: string | null; funcionarios: CartaoFuncionario[]; divergencias: string[];
}

const TIME = /^\d{1,3}:\d{2}$/;
export const toMin = (v?: string | null) => { if (!v || !TIME.test(v)) return 0; const [h, m] = v.split(':').map(Number); return h * 60 + m; };
export const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isoFromBr = (d: string) => { const m = d.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/); if (!m) return null; const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2]}-${m[1]}`; };

type Line = { page: number; y: number; items: { x: number; s: string }[] };

function toLines(tokens: PdfToken[]): Line[] {
  const map = new Map<string, Line>();
  for (const t of tokens) {
    if (!t.s.trim()) continue;
    const y = Math.round(t.y);
    const k = `${t.page}|${y}`;
    const l = map.get(k) ?? { page: t.page, y, items: [] };
    l.items.push({ x: t.x, s: t.s.trim() }); map.set(k, l);
  }
  return [...map.values()].sort((a, b) => a.page - b.page || b.y - a.y).map(l => ({ ...l, items: l.items.sort((a, b) => a.x - b.x) }));
}

const text = (l: Line) => l.items.map(i => i.s).join(' ');
const DATE = /^\d{2}\/\d{2}\/\d{2}$/;

export function parseCartaoPonto(tokens: PdfToken[]): CartaoRelatorio {
  const lines = toLines(tokens);
  const out: CartaoRelatorio = { periodoInicio: null, periodoFim: null, funcionarios: [], divergencias: [] };
  let cur: CartaoFuncionario | null = null;
  // Colunas (x) lidas do cabeçalho; valores padrão do layout PontoFopag.
  let col = { marcIni: 165, marcFim: 345, trab: 365, extra: 405, falta: 450, obs: 495 };
  const dayLines: { line: Line; dia: CartaoDia }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]; const t = text(l);
    const per = t.match(/Período de (\d{2}\/\d{2}\/\d{4}) à (\d{2}\/\d{2}\/\d{4})/);
    if (per && !out.periodoInicio) { out.periodoInicio = isoFromBr(per[1]); out.periodoFim = isoFromBr(per[2]); }
    const f = t.match(/Funcionário:\s*(\d+)\s*-\s*(.+)$/);
    if (f) {
      const codigo = f[1]; const nome = f[2].trim();
      const existing = out.funcionarios.find(x => x.codigo === codigo);
      if (existing) { cur = existing; continue; }
      cur = { codigo, nome, matricula: null, departamento: null, funcao: null, dias: [], totais: { trabalhadas: null, extras: null, faltas: null }, somados: { trabalhadas: '00:00', extras: '00:00', faltas: '00:00' }, divergencias: [] };
      out.funcionarios.push(cur); continue;
    }
    if (!cur) continue;
    const mat = t.match(/Matrícula:\s*(\S+)/); if (mat) { cur.matricula = mat[1]; continue; } // CPF/PIS da mesma linha são ignorados
    const dep = t.match(/Departamento:\s*(.*?)\s*(Função:\s*(.*))?$/);
    if (dep) { cur.departamento = dep[1] || null; cur.funcao = dep[3]?.trim() || null; continue; }
    if (/Ent\.\s+Sai\./.test(t) && /Diu\./.test(t)) {
      const xs = l.items; const diu = xs.filter(x => x.s === 'Diu.').map(x => x.x); const obs = xs.find(x => x.s.startsWith('Observa'));
      const ent = xs.filter(x => x.s === 'Ent.' || x.s === 'Sai.').map(x => x.x);
      if (diu.length >= 3 && ent.length) col = { marcIni: Math.min(...ent) - 5, marcFim: Math.max(...ent) + 17, trab: diu[0] - 8, extra: diu[1] - 12, falta: diu[2] - 12, obs: obs ? obs.x - 35 : col.obs };
      continue;
    }
    const tot = t.match(/^(Trabalhadas|Extras|Faltas)\s+(\d{1,3}:\d{2})/);
    if (tot) { const k = tot[1].toLowerCase() as 'trabalhadas' | 'extras' | 'faltas'; cur.totais[k] = tot[2]; continue; }
    if (l.items[0] && DATE.test(l.items[0].s) && l.items[0].x < 40) {
      const dia = isoFromBr(l.items[0].s)!;
      const rest = l.items.slice(1);
      const jornadaTimes = rest.filter(x => x.x < col.marcIni - 10 && TIME.test(x.s)).map(x => x.s);
      const marcacoes = rest.filter(x => x.x >= col.marcIni && x.x < col.marcFim && TIME.test(x.s.replace('*', ''))).map(x => x.s.replace('*', ''));
      const pickCol = (a: number, b: number) => rest.find(x => x.x >= a && x.x < b && TIME.test(x.s))?.s ?? null;
      const trabalhadas = pickCol(col.trab, col.trab + 25);
      const extras = pickCol(col.extra, col.extra + 30);
      const faltas = pickCol(col.falta, col.falta + 30);
      const obsTxt = rest.filter(x => x.x >= col.obs && !TIME.test(x.s)).map(x => x.s).join(' ').trim();
      const d: CartaoDia = { dia, jornada: jornadaTimes.length ? jornadaTimes.join(' ') : null, marcacoes, trabalhadas, extras, faltas, observacao: obsTxt || null, situacao: 'regular' };
      cur.dias.push(d); dayLines.push({ line: l, dia: d });
      continue;
    }
    // Observação impressa um pouco acima/abaixo da linha do dia (ex.: "Férias").
    if (l.items.every(x => x.x >= col.obs) && t) {
      const near = dayLines.filter(d => d.line.page === l.page && Math.abs(d.line.y - l.y) <= 4).sort((a, b) => Math.abs(a.line.y - l.y) - Math.abs(b.line.y - l.y))[0];
      if (near && !near.dia.observacao) near.dia.observacao = t;
    }
  }

  for (const f of out.funcionarios) {
    for (const d of f.dias) d.situacao = situacaoDoDia(d);
    const sum = (k: 'trabalhadas' | 'extras' | 'faltas') => f.dias.reduce((s, d) => s + toMin(d[k]), 0);
    f.somados = { trabalhadas: fmtMin(sum('trabalhadas')), extras: fmtMin(sum('extras')), faltas: fmtMin(sum('faltas')) };
    (['trabalhadas', 'extras', 'faltas'] as const).forEach(k => {
      const imp = f.totais[k];
      if (imp == null) f.divergencias.push(`Total de ${k} não encontrado no relatório.`);
      else if (toMin(imp) !== sum(k)) f.divergencias.push(`${k}: relatório ${imp}, soma dos dias ${f.somados[k]} (diferença ${fmtMin(Math.abs(toMin(imp) - sum(k)))}).`);
    });
    f.divergencias.forEach(m => out.divergencias.push(`${f.codigo} - ${f.nome}: ${m}`));
  }
  if (!out.funcionarios.length) out.divergencias.push('Nenhum funcionário encontrado. Confira se é o "Relatório de Cartão Ponto Individual".');
  return out;
}

function situacaoDoDia(d: CartaoDia): CartaoSituacao {
  const obs = (d.observacao ?? '').toLowerCase();
  if (obs.includes('incorret')) return 'incompleta';
  if (obs) return 'aguardando';
  if (!d.jornada && !d.marcacoes.length) return 'regular';
  if (d.jornada && !d.marcacoes.length) return toMin(d.faltas) > 0 ? 'falta' : 'sem_marcacao';
  if (d.marcacoes.length % 2 !== 0) return 'incompleta';
  if (toMin(d.extras) > 0) return 'hora_extra';
  if (toMin(d.faltas) > 0) return 'aguardando';
  return 'regular';
}

/** Lê o PDF no navegador e devolve os textos posicionados. */
export async function readPdfTokens(buf: ArrayBuffer): Promise<PdfToken[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: PdfToken[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    for (const it of content.items as any[]) if (it.str?.trim()) out.push({ page: p, x: it.transform[4], y: it.transform[5], s: it.str });
  }
  return out;
}
