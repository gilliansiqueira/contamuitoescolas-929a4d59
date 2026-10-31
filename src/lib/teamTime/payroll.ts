/** Planilha da folha (contabilidade) — regras puras, sem acesso ao banco. */
import { isNationalHoliday } from './holidays';

export const PAYROLL_COLS = [
  { key: 'he50', label: 'Horas Extras 50%', code: 150, kind: 'hora' },
  { key: 'he100', label: 'Horas Extras 100%', code: 200, kind: 'hora' },
  { key: 'atraso', label: 'Atraso', code: 204, kind: 'hora' },
  { key: 'faltas', label: 'Dias Faltas', code: 8792, kind: 'num' },
  { key: 'dsr', label: 'DSR Faltas', code: 8794, kind: 'num' },
  { key: 'vr', label: 'VR', code: 248, kind: 'valor' },
  { key: 'saude_tit', label: 'Mensalidade Plano de Saude TITULAR', code: null, kind: 'valor' },
  { key: 'saude_dep', label: 'Mensalidade Plano de Saúde DEPENDENTE', code: null, kind: 'valor' },
  { key: 'copart_tit', label: 'Coparticipação Plano de Saúde TITULAR', code: null, kind: 'valor' },
  { key: 'copart_dep', label: 'Coparticipação Plano de Saúde DEPENDENTE', code: null, kind: 'valor' },
  { key: 'odonto', label: 'Plano Odontológico', code: 232, kind: 'valor' },
  { key: 'adiantamento', label: 'Adiantamento Salarial', code: 260, kind: 'valor' },
  { key: 'outros', label: 'Outros Eventos', code: 999, kind: 'valor' },
] as const;
export type PayrollKey = typeof PAYROLL_COLS[number]['key'];
/** Horas em minutos; demais em número. null = célula vazia. */
export type PayrollValues = Partial<Record<PayrollKey, number | null>>;

/** Parcela da mensalidade do titular paga pela funcionária (empresa arca com 60%). */
export const TITULAR_SHARE = 0.4;
const cents = (n: number) => Math.round(n * 100 + 1e-9) / 100;

export interface PayrollDay { dia: string; faltaDia: boolean; faltaMin: number; extraMin: number; justificada: boolean; atestado?: boolean }

/** Horas e faltas do mês a partir dos dias já classificados pelo Ponto (classifyDay). */
export function hoursFromDays(days: PayrollDay[]): PayrollValues {
  let he50 = 0, he100 = 0, atraso = 0, faltas = 0;
  for (const d of days) {
    const domingo = new Date(`${d.dia}T12:00:00Z`).getUTCDay() === 0;
    if (domingo || isNationalHoliday(d.dia)) he100 += d.extraMin; else he50 += d.extraMin;
    if (d.justificada || d.atestado) continue;
    if (d.faltaDia) faltas++;
    else atraso += d.faltaMin;
  }
  return { he50: he50 || null, he100: he100 || null, atraso: atraso || null, faltas: faltas || null };
}

export interface PlanItem { titular: string; beneficiario: string; tipo: 'titular' | 'dependente'; bruto: number; func: number; kind: 'mensalidade' | 'coparticipacao' }

/** Valor que entra na planilha (desconto da funcionária). */
export function employeeShare(kind: PlanItem['kind'], tipo: PlanItem['tipo'], bruto: number) {
  return kind === 'mensalidade' && tipo === 'titular' ? cents(bruto * TITULAR_SHARE) : cents(bruto);
}

export const normName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Lê o relatório rel0051 da operadora (HTML salvo como .xls ou CSV com ";"). Valor Unitário vem em centavos. */
export function parseRel0051(html: string): { competencia: string | null; kind: PlanItem['kind']; items: PlanItem[] } {
  const isHtml = /<tr[\s>]/i.test(html);
  const rows = isHtml
    ? [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(r => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()))
    : html.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(';').map(c => c.replace(/^"|"$/g, '').trim()));
  const head = rows.findIndex(r => r.some(c => /Valor Unit/i.test(c)));
  if (head < 0) throw new Error('Não encontrei a coluna "Valor Unitário". Confira se é o relatório do plano (rel0051).');
  const h = rows[head].map(c => normName(c));
  const col = (re: RegExp) => h.findIndex(c => re.test(c));
  const iTit = col(/^nome titular/), iBen = col(/^nome beneficiario/), iTipo = col(/^tipo beneficiario/), iVal = col(/^valor unitario/), iLan = col(/^tipo lancamento/), iComp = col(/^competencia$/);
  const body = rows.slice(head + 1).filter(r => r.length >= h.length - 2 && r[iVal]);
  const isMens = body.some(r => /tit$|dep$|apartamento|enfermaria/i.test(r[iLan] ?? ''));
  const kind: PlanItem['kind'] = isMens ? 'mensalidade' : 'coparticipacao';
  const items = body.map(r => {
    const bruto = Number(String(r[iVal]).replace(/\D/g, '')) / 100;
    const tipo: PlanItem['tipo'] = /titular/i.test(r[iTipo] ?? '') ? 'titular' : 'dependente';
    return { titular: r[iTit], beneficiario: r[iBen], tipo, bruto, func: employeeShare(kind, tipo, bruto), kind };
  });
  return { competencia: body[0]?.[iComp] ?? null, kind, items };
}

export interface PayrollPerson { external_id: string; nomes: string[] }
/** Vínculo por nome: idêntico = automático; mesmo primeiro e último nome = só sugestão (equipe confirma). */
export function matchTitular(titular: string, people: PayrollPerson[]): { exact?: string; suggestion?: string } {
  const n = normName(titular);
  const exact = people.find(p => p.nomes.some(x => normName(x) === n));
  if (exact) return { exact: exact.external_id };
  const t = n.split(' ');
  const sug = people.find(p => p.nomes.some(x => { const y = normName(x).split(' '); return y[0] === t[0] && y[y.length - 1] === t[t.length - 1]; }));
  return { suggestion: sug?.external_id };
}

/** Soma os itens vinculados nos campos da planilha. */
export function planValues(items: (PlanItem & { external_id: string })[], id: string): PayrollValues {
  const out: PayrollValues = {};
  for (const it of items.filter(x => x.external_id === id)) {
    const k: PayrollKey = it.kind === 'mensalidade' ? (it.tipo === 'titular' ? 'saude_tit' : 'saude_dep') : (it.tipo === 'titular' ? 'copart_tit' : 'copart_dep');
    out[k] = cents((out[k] ?? 0) + it.func);
  }
  return out;
}
