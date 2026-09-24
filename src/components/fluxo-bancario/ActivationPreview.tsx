import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Power, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool, usePaymentDelayRules, useTypeClassifications, useRawEntriesFromBaseDate } from '@/hooks/useFinancialData';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useSetDataSourceStatus, type CashflowEntry, type DataSourceConfig } from '@/hooks/useBankPilot';
import { projectEntries } from '@/lib/projectionEngine';
import { applyCashflowOverlay } from '@/lib/bankCashflowOverlay';
import { buildMonthMovement, computeSaldoInicial } from '@/lib/periodMovement';
import { fmtBRL, fmtDate } from './shared';

interface Props {
  schoolId: string; cfg: DataSourceConfig; gen: CashflowEntry[];
  bankIni: number; bankFim: number; bankTo: string;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Prévia: como o Dashboard e o Fluxo Diário ficariam com o Fluxo de Caixa, usando os motores oficiais. */
export function ActivationPreview({ schoolId, cfg, gen, bankIni, bankFim, bankTo }: Props) {
  const month = cfg.start_month;
  const start = `${month}-01`;
  const { data: school } = useSchool(schoolId);
  const { data: raw = [], isLoading } = useRawEntriesFromBaseDate(schoolId, school?.saldoInicialData, !!school);
  const { data: rules = [] } = usePaymentDelayRules(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const model = useSchoolModel(schoolId);
  const { ctx, isInModel } = usePeriodMovementCtx(schoolId);
  const setStatus = useSetDataSourceStatus(schoolId);

  const p = useMemo(() => {
    const newCtx = { ...ctx, entries: projectEntries(applyCashflowOverlay(raw, gen, start, schoolId), rules, classifications, model) };
    const opts = { isInModel };
    const mk = (c: typeof ctx) => {
      const mov = buildMonthMovement(month, c, opts);
      const ini = computeSaldoInicial(month, c, opts);
      return { mov, ini, fimReal: ini + mov.saldoMovimentoRealizado };
    };
    const genIn = gen.filter(e => e.data >= start && e.data <= bankTo && e.tipo === 'entrada').reduce((s, e) => s + Number(e.valor), 0);
    const genOut = gen.filter(e => e.data >= start && e.data <= bankTo && e.tipo === 'saida').reduce((s, e) => s + Number(e.valor), 0);
    const aClass = gen.filter(e => e.data >= start && e.tipo_nome === 'A classificar');
    const ign = gen.filter(e => e.data >= start && e.data <= bankTo && e.tipo_nome === 'Ignorar')
      .reduce((s, e) => s + (e.tipo === 'entrada' ? 1 : -1) * Number(e.valor), 0);
    return { next: mk(newCtx), bankMov: genIn - genOut, genIn, genOut, ign, aClass };
  }, [ctx, raw, rules, classifications, model, gen, start, month, schoolId, isInModel, bankTo]);

  const movOk = r2(p.next.mov.saldoMovimentoRealizado - p.bankMov) === 0;
  const iniDiff = r2(p.next.ini - bankIni);
  const ok = movOk && p.aClass.length === 0;
  const active = cfg.status === 'ativo';

  const row = (label: string, v: number, bank?: number) => (
    <tr className="border-t border-border"><td className="py-1.5">{label}</td>
      <td className="text-right font-semibold tabular-nums">{fmtBRL(v)}</td>
      <td className="text-right tabular-nums">{bank === undefined ? '—' : fmtBRL(bank)}</td></tr>
  );
  const m = p.next.mov;

  const act = (s: 'ativo' | 'pausado') => setStatus.mutate(s, {
    onSuccess: () => toast.success(s === 'ativo' ? 'Fluxo de Caixa ativado no Dashboard e no Fluxo Diário' : 'Voltou a usar a planilha'),
    onError: (e: any) => toast.error(e.message ?? 'Erro'),
  });

  return (
    <section className="space-y-3 rounded-xl border-2 border-primary/40 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">Prévia da ativação — {month.split('-').reverse().join('/')}</h3>
          <p className="text-xs text-muted-foreground">Como o Dashboard e o Fluxo Diário ficam com o Fluxo de Caixa (os dois usam o mesmo cálculo). Realizado até {fmtDate(cfg.synced_through ?? undefined)}; depois disso seguem as projeções.</p>
        </div>
        {active
          ? <Button variant="outline" disabled={setStatus.isPending} onClick={() => act('pausado')}><Undo2 className="mr-1 h-4 w-4" />Pausar e voltar para a planilha</Button>
          : <Button disabled={setStatus.isPending || isLoading || !ok} onClick={() => { if (confirm('Ativar o Fluxo de Caixa no Dashboard e no Fluxo Diário desta empresa? Pode ser pausado a qualquer momento.')) act('ativo'); }}><Power className="mr-1 h-4 w-4" />Aprovar e ativar</Button>}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Calculando prévia…</p> : (<>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-medium">Mês</th><th className="text-right font-medium">Dashboard / Fluxo Diário</th><th className="text-right font-medium">Banco</th></tr></thead>
          <tbody>
            {row('Saldo inicial (fechamento de agosto)', p.next.ini, bankIni)}
            {row('Entradas no banco', p.genIn, p.genIn)}
            {row('Saídas no banco', p.genOut, p.genOut)}
            {row('Receitas realizadas', m.receitasRealizadas)}
            {row('Despesas realizadas', m.despesasRealizadas)}
            {row('Resultado realizado', m.receitasRealizadas - m.despesasRealizadas)}
            {row('Operações fora do resultado (inclui ignoradas do banco)', m.operacoesIn - m.operacoesOut)}
            {row('   dessas, Movimentações ignoradas (banco)', p.ign)}
            {row('Movimento realizado no caixa', m.saldoMovimentoRealizado, p.bankMov)}
            {row(`Saldo realizado em ${fmtDate(bankTo)}`, p.next.fimReal, bankFim)}
          </tbody></table></div>

        <ul className="space-y-1 text-sm">
          <li>{movOk ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className="mr-1 inline h-4 w-4 text-destructive" />}
            Movimento do mês {movOk ? 'bate com o banco' : `difere do banco em ${fmtBRL(p.next.mov.saldoMovimentoRealizado - p.bankMov)}`}</li>
          <li>{p.aClass.length === 0 ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className="mr-1 inline h-4 w-4 text-warning" />}
            {p.aClass.length === 0 ? 'Nenhuma movimentação a classificar' : `${p.aClass.length} movimentações ainda a classificar`}</li>
          <li>{iniDiff === 0 ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className="mr-1 inline h-4 w-4 text-warning" />}
            {iniDiff === 0 ? 'Saldo inicial do Dashboard igual ao saldo do banco' : `Saldo inicial do Dashboard (vem de agosto, congelado) difere do banco em ${fmtBRL(iniDiff)} — apenas informativo, não impede a ativação`}</li>
        </ul>
        {!active && !ok && <p className="text-xs text-muted-foreground">O botão de ativar libera quando o movimento bater com o banco e não houver nada a classificar.</p>}
      </>)}
    </section>
  );
}
