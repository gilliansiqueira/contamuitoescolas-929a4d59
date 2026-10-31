import { computeSaldoInicial, isRealFluxo, monthOf, type PeriodMovementCtx } from '@/lib/periodMovement';

export interface BankBalance {
  id: string;
  nome: string;
  tipo: string;
  saldo: number | null;
  data_ref: string;
  entity_id: string | null;
  sort_order: number;
}

/** Soma dos saldos informados (contas sem saldo ficam de fora). */
export function totalInformado(rows: Pick<BankBalance, 'saldo'>[]): number {
  return rows.reduce((s, r) => s + (r.saldo == null ? 0 : Number(r.saldo)), 0);
}

/**
 * Saldo que o sistema calcula no fim do dia `refDate` (YYYY-MM-DD):
 * saldo inicial do mês + lançamentos realizados do mês até a data.
 */
export function saldoCalculadoNaData(
  ctx: PeriodMovementCtx,
  refDate: string,
  opts: { isInModel?: (label: string) => boolean } = {},
): number {
  const m = refDate.slice(0, 7);
  let saldo = computeSaldoInicial(m, ctx, opts);
  for (const e of ctx.entries) {
    if (monthOf(e.dataProjetada) !== m || e.dataProjetada > refDate) continue;
    if (!isRealFluxo(e as any)) continue;
    saldo += e.impacto;
  }
  return saldo;
}

/**
 * Novo saldo da âncora para que o saldo calculado na data de referência
 * fique igual ao informado — recalcula todo o histórico de trás para frente.
 */
export function novaAncora(saldoBaseAtual: number, informado: number, calculado: number): number {
  return Math.round((saldoBaseAtual + (informado - calculado)) * 100) / 100;
}
