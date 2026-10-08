/**
 * Painel "Meu dia" da Central: contas a pagar, conferência de pagamento pela
 * conciliação e alerta de caixa em 15 dias — tudo derivado da SSOT
 * (projectionEngine + classificationUtils). Nenhum valor é recalculado aqui
 * com regras próprias: a classificação vem de getEffectiveClassification e o
 * impacto no caixa de getSaldoImpact (via projectEntries).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { projectEntries, type ProjectedEntry } from '@/lib/projectionEngine';
import { getEffectiveClassification, normalizeTipo } from '@/lib/classificationUtils';
import { syncWeekendAllowedSchools } from '@/lib/dateUtils';
import { fetchBankAccounts } from '@/hooks/useBankPilot';
import { confirmedBankBalance } from '@/lib/bankStatements/confirmedBalance';
import type { FinancialEntry, PaymentDelayRule, TypeClassification } from '@/types/financial';

/** Feriados nacionais (mesma referência do prazo do relatório). */
const BR_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-03-03', '2025-03-04', '2025-04-18', '2025-04-21', '2025-05-01',
  '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20', '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01',
  '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01',
  '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25',
]);

function isBusinessDay(dateStr: string): boolean {
  if (BR_HOLIDAYS.has(dateStr)) return false;
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Dia útil imediatamente anterior (para antecipar avisos de fim de semana/feriado). */
export function previousBusinessDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (!isBusinessDay(d.toISOString().slice(0, 10)));
  return d.toISOString().slice(0, 10);
}

export function nextBusinessDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (!isBusinessDay(d.toISOString().slice(0, 10)));
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tolerância de valor usada na conciliação (regra do produto). */
const VALOR_TOLERANCIA = 20;
/** Janela de dias após o vencimento em que o pagamento ainda é reconhecido. */
const PAGAMENTO_JANELA_DIAS = 3;

export interface MyDayPayable {
  entryId: string;
  schoolId: string;
  schoolName: string;
  descricao: string;
  categoria: string;
  valor: number;
  dueDate: string; // dataProjetada (vencimento ajustado pela SSOT)
  /** true quando o vencimento cai em dia não útil e o aviso foi antecipado */
  antecipado: boolean;
}

export interface MyDayCashRisk {
  schoolId: string;
  schoolName: string;
  firstNegativeDate: string;
  minBalance: number;
}

export interface MyDayData {
  payToday: MyDayPayable[];
  scheduleToday: MyDayPayable[];
  notPaid: MyDayPayable[];
  cashRisks: MyDayCashRisk[];
  acknowledgedCount: number;
}

interface SchoolBundle {
  id: string;
  nome: string;
  /** Saldo oficial do banco (extrato conferido de todas as contas ativas) e sua data. */
  bankBalance: { date: string; balance: number } | null;
  /** Último dia coberto por extrato em todas as contas ativas (null = sem Fluxo Bancário). */
  statementCoverage: string | null;
  allowWeekend: boolean;
  entries: FinancialEntry[];
  rules: PaymentDelayRule[];
  classifications: TypeClassification[];
  hasModel: boolean;
  validKeys: Set<string>;
  paidOuts: { data: string; valor: number }[];
  acks: Set<string>; // `${entry_id}|${due_date}`
}

const ENTRY_COLS = 'id, data, descricao, valor, tipo, categoria, origem, school_id, origem_upload_id, tipo_original, tipo_registro, editado_manualmente, data_original, delay_rule_applied, afeta_saldo';

function mapEntry(e: any): FinancialEntry {
  return {
    id: e.id,
    data: e.data,
    descricao: e.descricao,
    valor: Number(e.valor),
    tipo: e.tipo as 'entrada' | 'saida',
    categoria: e.categoria,
    origem: e.origem as FinancialEntry['origem'],
    school_id: e.school_id,
    origem_upload_id: e.origem_upload_id ?? undefined,
    tipoOriginal: e.tipo_original ?? undefined,
    tipoRegistro: (e.tipo_registro as 'realizado' | 'projetado') || 'realizado',
    editadoManualmente: e.editado_manualmente ?? false,
    dataOriginal: e.data_original ?? undefined,
    delayJaAplicado: !!e.delay_rule_applied,
    afetaSaldo: e.afeta_saldo !== false,
  };
}

async function fetchBundle(schoolId: string, schoolName: string, today: string): Promise<SchoolBundle> {
  const db = supabase as any;
  const { data: school, error: sErr } = await db
    .from('schools')
    .select('id, allow_weekend_entries, financial_model_template_id')
    .eq('id', schoolId)
    .maybeSingle();
  if (sErr) throw sErr;

  const { data: source } = await db.from('school_data_sources')
    .select('status, dashboard_source').eq('school_id', schoolId).maybeSingle();
  const usesBank = source?.status === 'ativo' && source?.dashboard_source === 'fluxo_caixa';
  const accounts = usesBank ? (await fetchBankAccounts(schoolId)).filter(a => a.ativa) : [];
  const bankBalance = usesBank && accounts.length ? confirmedBankBalance(accounts, { allowStaleSporadic: true }) : null;
  // Contas "extrato esporádico" ficam fora da cobertura de extrato: o cliente envia de vez em
  // quando, então não há cobrança diária — e sem conta regular não se afirma que algo "não saiu".
  let statementCoverage: string | null = null;
  const regularAccounts = accounts.filter(a => !a.extrato_esporadico);
  if (regularAccounts.length) {
    const { data: imps } = await db.from('bank_statement_imports').select('account_id, periodo_fim')
      .in('account_id', regularAccounts.map(a => a.id)).gte('periodo_fim', addDays(today, -40));
    const lastBy = new Map<string, string>();
    for (const i of (imps ?? []) as any[]) if (i.periodo_fim && (lastBy.get(i.account_id) ?? '') < i.periodo_fim) lastBy.set(i.account_id, i.periodo_fim);
    const ends = regularAccounts.map(a => lastBy.get(a.id) ?? '');
    statementCoverage = ends.some(e => !e) ? null : ends.sort()[0];
  }
  // Só a janela necessária: margem para prazos de recebimento + 15 dias à frente.
  const from = bankBalance && bankBalance.date < addDays(today, -40) ? bankBalance.date : addDays(today, -40);
  const [entries, rulesRows, itemRows, paidOuts, ackRows] = await Promise.all([
    fetchAllRows<any>('financial_entries', q => q.eq('school_id', schoolId)
      .gte('data', from).lte('data', addDays(today, 20)).order('data'), 1000, ENTRY_COLS),
    supabase.from('payment_delay_rules').select('*').eq('school_id', schoolId).then(r => {
      if (r.error) throw r.error;
      return r.data ?? [];
    }),
    school?.financial_model_template_id
      ? db.from('financial_model_template_items').select('*').eq('template_id', school.financial_model_template_id).then((r: any) => {
          if (r.error) throw r.error;
          return r.data ?? [];
        })
      : Promise.resolve([]),
    // Saídas reais do extrato (conciliadas ou não) para conferir se a conta vencida saiu.
    statementCoverage
      ? fetchAllRows<any>('bank_transactions', q => q
          .eq('school_id', schoolId).eq('tipo', 'saida').eq('is_forecast', false)
          .gte('data', addDays(today, -10)).lte('data', today), 1000, 'data, valor')
      : Promise.resolve([]),
    db.from('payable_acknowledgements').select('entry_id, due_date').eq('school_id', schoolId).then((r: any) => {
      if (r.error) throw r.error;
      return r.data ?? [];
    }),
  ]);

  const classifications: TypeClassification[] = (itemRows as any[]).map(it => {
    const isIgnorar = it.tipo === 'ignorar';
    const impactaCaixa = isIgnorar ? false : !!it.impacta_caixa;
    const entraNoResultado = isIgnorar ? false : !!it.entra_no_resultado;
    return {
      id: it.id,
      school_id: schoolId,
      tipoValor: normalizeTipo(it.name),
      entraNoResultado,
      impactaCaixa,
      classificacao: isIgnorar ? 'ignorar' : entraNoResultado && it.tipo === 'entrada' ? 'receita' : entraNoResultado && it.tipo === 'saida' ? 'despesa' : impactaCaixa ? 'operacao' : 'ignorar',
      operacaoSinal: it.tipo === 'saida' ? 'subtrair' : 'somar',
      label: it.name,
    };
  });

  const hasModel = !!school?.financial_model_template_id && (itemRows as any[]).length > 0;
  const validKeys = new Set([
    ...(itemRows as any[]).map(i => normalizeTipo(i.name)),
    ...classifications.filter(c => c.classificacao !== 'ignorar').map(c => normalizeTipo(c.tipoValor)),
  ]);

  return {
    id: schoolId,
    nome: schoolName,
    bankBalance,
    statementCoverage,
    allowWeekend: !!school?.allow_weekend_entries,
    entries: entries.map(mapEntry),
    rules: rulesRows.map((r: any) => ({
      id: r.id,
      school_id: r.school_id,
      formaCobranca: r.forma_cobranca,
      prazo: r.prazo,
      weekendPolicy: (r.weekend_policy ?? 'proximo') as 'anterior' | 'proximo' | 'manter',
    })),
    classifications,
    hasModel,
    validKeys,
    paidOuts: paidOuts.map((r: any) => ({ data: r.data, valor: Math.abs(Number(r.valor)) })),
    acks: new Set((ackRows as any[]).map(a => `${a.entry_id}|${a.due_date}`)),
  };
}

function computeSchool(bundle: SchoolBundle, today: string): MyDayData {
  const empty: MyDayData = { payToday: [], scheduleToday: [], notPaid: [], cashRisks: [], acknowledgedCount: 0 };
  const projected = projectEntries(bundle.entries, bundle.rules, bundle.classifications, {
    hasModel: bundle.hasModel,
    isInModel: (label: string) => (bundle.hasModel ? bundle.validKeys.has(normalizeTipo(label)) : true),
  });

  const toPayable = (e: ProjectedEntry): MyDayPayable => ({
    entryId: e.id,
    schoolId: bundle.id,
    schoolName: bundle.nome,
    descricao: e.descricao,
    categoria: e.categoria,
    valor: Math.abs(e.valor),
    dueDate: e.dataProjetada,
    antecipado: !isBusinessDay(e.dataProjetada),
  });

  // Contas a pagar: despesas previstas (classificação oficial), janela de
  // 10 dias para trás (conferência de pagamento) até o próximo dia útil.
  const windowStart = addDays(today, -10);
  const payables = projected.filter(e =>
    e.tipoRegistro === 'projetado'
    && e.dataProjetada >= windowStart
    && getEffectiveClassification(e, bundle.classifications) === 'despesa'
    && e.impacto < 0,
  );

  for (const p of payables.map(toPayable)) {
    if (bundle.acks.has(`${p.entryId}|${p.dueDate}`)) {
      empty.acknowledgedCount += 1;
      continue;
    }
    if (p.dueDate < today) {
      // Sem extrato cobrindo vencimento + janela, não dá para afirmar que não saiu.
      if (!bundle.statementCoverage || bundle.statementCoverage < addDays(p.dueDate, PAGAMENTO_JANELA_DIAS)) continue;
      // Conferência pela conciliação: saída conciliada de valor igual
      // (tolerância R$ 20) entre o vencimento e hoje quita a conta.
      const paid = bundle.paidOuts.some(tx =>
        tx.data >= p.dueDate
        && tx.data <= addDays(p.dueDate, PAGAMENTO_JANELA_DIAS)
        && Math.abs(tx.valor - p.valor) <= VALOR_TOLERANCIA,
      );
      if (!paid) empty.notPaid.push(p);
      continue;
    }
    if (p.dueDate === today) {
      empty.payToday.push(p);
      continue;
    }
    // Aviso 1 dia útil antes: se o vencimento cai em dia não útil, o aviso
    // aparece no último dia útil anterior ("agendar hoje").
    if (previousBusinessDay(p.dueDate) === today) empty.scheduleToday.push(p);
  }

  // Alerta de caixa: parte do saldo oficial do banco (extrato conferido, o mesmo
  // do Fluxo Diário) e soma só as projeções (SSOT) posteriores a essa data.
  // Sem saldo bancário conferido não há base confiável: a empresa fica fora do alerta.
  if (bundle.bankBalance) {
    const base = bundle.bankBalance;
    const impactsByDay = new Map<string, number>();
    for (const e of projected) {
      if (!e.impacto || e.tipoRegistro !== 'projetado' || e.dataProjetada <= base.date) continue;
      impactsByDay.set(e.dataProjetada, (impactsByDay.get(e.dataProjetada) ?? 0) + e.impacto);
    }
    let saldo = base.balance;
    let firstNegative: string | null = null;
    let minBalance = Infinity;
    for (let d = addDays(base.date, 1); d <= addDays(today, 15); d = addDays(d, 1)) {
      saldo += impactsByDay.get(d) ?? 0;
      if (d >= today && saldo < 0) {
        if (!firstNegative) firstNegative = d;
        if (saldo < minBalance) minBalance = saldo;
      }
    }
    if (firstNegative) {
      empty.cashRisks.push({ schoolId: bundle.id, schoolName: bundle.nome, firstNegativeDate: firstNegative, minBalance });
    }
  }

  return empty;
}

export function useMyDay(schools: { id: string; nome: string }[], today: string, enabled = true) {
  const key = schools.map(s => s.id).sort().join(',');
  return useQuery({
    queryKey: ['my-day', key, today],
    enabled: enabled && schools.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(today),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MyDayData> => {
      const bundles = await Promise.all(schools.map(s => fetchBundle(s.id, s.nome, today)));
      syncWeekendAllowedSchools(bundles.map(b => ({ id: b.id, allowWeekendEntries: b.allowWeekend })) as any);
      const result: MyDayData = { payToday: [], scheduleToday: [], notPaid: [], cashRisks: [], acknowledgedCount: 0 };
      for (const b of bundles) {
        const part = computeSchool(b, today);
        result.payToday.push(...part.payToday);
        result.scheduleToday.push(...part.scheduleToday);
        result.notPaid.push(...part.notPaid);
        result.cashRisks.push(...part.cashRisks);
        result.acknowledgedCount += part.acknowledgedCount;
      }
      const byValorDesc = (a: MyDayPayable, b: MyDayPayable) => b.valor - a.valor;
      result.payToday.sort(byValorDesc);
      result.scheduleToday.sort(byValorDesc);
      result.notPaid.sort(byValorDesc);
      result.cashRisks.sort((a, b) => a.firstNegativeDate.localeCompare(b.firstNegativeDate));
      return result;
    },
  });
}

/** Marca uma conta como agendada (o aviso some). */
export function useAcknowledgePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { schoolId: string; entryId: string; dueDate: string; kind?: 'agendado' | 'descartado'; note?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('payable_acknowledgements').upsert({
        school_id: p.schoolId,
        entry_id: p.entryId,
        due_date: p.dueDate,
        acknowledged_by: auth.user?.id ?? null,
        kind: p.kind ?? 'agendado',
        note: p.note ?? null,
      }, { onConflict: 'entry_id,due_date' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-day'] }),
  });
}

/** Desfaz o "Agendado". */
export function useUnacknowledgePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { entryId: string; dueDate: string }) => {
      const { error } = await (supabase as any).from('payable_acknowledgements')
        .delete().eq('entry_id', p.entryId).eq('due_date', p.dueDate);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-day'] }),
  });
}
