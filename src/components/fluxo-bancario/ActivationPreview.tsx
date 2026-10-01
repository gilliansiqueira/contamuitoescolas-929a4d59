import { BANK_SMALL_DIFF_TOLERANCE } from '@/lib/bankStatements/confirmedBalance';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { BankAccount } from '@/lib/bankStatements/bankCashflowEngine';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Power, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool, usePaymentDelayRules, useTypeClassifications, useRawEntriesFromBaseDate } from '@/hooks/useFinancialData';
import { useSchoolModel } from '@/hooks/useSchoolModel';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useSetDataSourceStatus, useSetRetido, type CashflowEntry, type DataSourceConfig } from '@/hooks/useBankPilot';
import { projectEntries } from '@/lib/projectionEngine';
import { applyCashflowOverlay } from '@/lib/bankCashflowOverlay';
import { buildMonthMovement, computeSaldoInicial, computeSaldoInicialRealizado } from '@/lib/periodMovement';
import { fmtBRL, fmtDate } from './shared';

interface Props {
  schoolId: string; cfg: DataSourceConfig; gen: CashflowEntry[];
  bankIni: number; bankFim: number; bankTo: string; holder?: string; accounts?: BankAccount[];
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Prévia: como o Dashboard e o Fluxo Diário ficariam com o Fluxo de Caixa, usando os motores oficiais. */
export function ActivationPreview({ schoolId, cfg, gen, bankIni, bankFim, bankTo, holder, accounts = [] }: Props) {
  const setRetido = useSetRetido(schoolId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const latest = accounts.map(a => ({ acc: a, anc: (a.anchors ?? [])[0] })).filter(x => x.anc && x.anc.data <= bankTo);
  const retidoTotal = r2(latest.reduce((s, x) => s + Number(x.anc!.retido ?? 0), 0));
  const parseBR = (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? r2(n) : NaN; };
  const saveRetido = (importId: string, raw: string) => {
    const v = raw.trim() === '' ? null : parseBR(raw);
    if (v !== null && (isNaN(v) || v < 0)) { toast.error('Valor inválido'); return; }
    setRetido.mutate({ importId, valor: v || null }, { onSuccess: () => toast.success('Valor retido salvo'), onError: (e: any) => toast.error(e.message ?? 'Erro') });
  };
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
    const opts = { isInModel };
    // Mesma data de corte nas duas colunas: só o realizado até bankTo entra na comparação.
    const genCut = gen.filter(e => e.data <= bankTo);
    const entries = projectEntries(applyCashflowOverlay(raw, genCut, start, schoolId), rules, classifications, model);
    // Histórico antigo (sem âncora): só informativo.
    const oldCtx = { ...ctx, entries, cashflowAnchor: undefined };
    const planIni = computeSaldoInicial(month, oldCtx, opts);
    const planIniReal = computeSaldoInicialRealizado(month, oldCtx, opts);
    const adjust = Math.round((bankIni - planIni) * 100) / 100;
    const newCtx = { ...ctx, entries, cashflowAnchor: { month, saldo: bankIni } };
    const mk = (c: typeof ctx) => {
      const mov = buildMonthMovement(month, c, opts);
      const ini = computeSaldoInicial(month, c, opts);
      return { mov, ini, fimReal: ini + mov.saldoMovimentoRealizado };
    };
    // Mesma janela nas duas colunas: o mês comparado com o banco até o fim do mês.
    const [yy, mm] = month.split('-').map(Number);
    const monthEnd = `${month}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`;
    const cut = bankTo < monthEnd ? bankTo : monthEnd;
    const inMonth = gen.filter(e => e.data >= start && e.data <= cut);
    const sgn = (e: CashflowEntry) => (e.tipo === 'entrada' ? 1 : -1) * Number(e.valor);
    const genIn = inMonth.filter(e => e.tipo === 'entrada').reduce((s, e) => s + Number(e.valor), 0);
    const genOut = inMonth.filter(e => e.tipo === 'saida').reduce((s, e) => s + Number(e.valor), 0);
    const aClass = gen.filter(e => e.data >= start && e.tipo_nome === 'A classificar');
    const ign = inMonth.filter(e => e.tipo_nome === 'Ignorar').reduce((s, e) => s + sgn(e), 0);
    const after = gen.filter(e => e.data > monthEnd && e.data <= bankTo);
    const afterNet = r2(after.reduce((s, e) => s + sgn(e), 0));
    const bankFimMonth = r2(bankFim - afterNet);
    const bankRec = inMonth.filter(e => e.tipo_nome === 'Receita').reduce((s, e) => s + sgn(e), 0);
    const bankDesp = -inMonth.filter(e => e.tipo_nome === 'Despesa').reduce((s, e) => s + sgn(e), 0);
    return { next: mk(newCtx), planIni, planIniReal, adjust, bankMov: genIn - genOut, genIn, genOut, ign, aClass,
      monthEnd, cut, after, afterNet, bankFimMonth, bankRec, bankDesp };
  }, [ctx, raw, rules, classifications, model, gen, start, month, schoolId, isInModel, bankTo, bankIni, bankFim]);

  const movOk = r2(p.next.mov.saldoMovimentoRealizado - p.bankMov) === 0;
  const iniDiff = r2(p.next.ini - bankIni);
  const fimDiff = r2(p.next.fimReal - bankFim);
  // Diferenças pequenas (rendimento/centavos) ficam "A confirmar no próximo extrato" e não bloqueiam.
  const SMALL_DIFF_TOLERANCE = BANK_SMALL_DIFF_TOLERANCE;
  const fimSmall = fimDiff !== 0 && Math.abs(fimDiff) <= SMALL_DIFF_TOLERANCE;
  const fimOk = fimDiff === 0;
  const ok = movOk && iniDiff === 0 && (fimOk || fimSmall) && p.aClass.length === 0;
  const active = cfg.status === 'ativo';

  const row = (label: string, v: number, bank?: number) => (
    <tr className="border-t border-border"><td className="py-1.5">{label}</td>
      <td className="text-right font-semibold tabular-nums">{fmtBRL(v)}</td>
      <td className="text-right tabular-nums">{bank === undefined ? '—' : fmtBRL(bank)}</td></tr>
  );
  const m = p.next.mov;

  const act = (s: 'ativo' | 'pausado') => setStatus.mutate(s === 'ativo' ? { status: 'ativo', openingBalance: bankIni } : s, {
    onSuccess: () => toast.success(s === 'ativo' ? 'Fluxo de Caixa ativado no Dashboard e no Fluxo Diário' : 'Voltou a usar a planilha'),
    onError: (e: any) => toast.error(e.message ?? 'Erro'),
  });

  return (
    <section className="space-y-3 rounded-xl border-2 border-primary/40 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">Prévia da ativação — {month.split('-').reverse().join('/')}</h3>
          <p className="text-xs text-muted-foreground">Como o Dashboard e o Fluxo Diário ficam com o Fluxo de Caixa (os dois usam o mesmo cálculo). Realizado até {fmtDate(cfg.synced_through ?? undefined)}; depois disso seguem as projeções.</p>
          {holder && <p className="mt-1 text-xs font-medium text-warning">Realizado até {fmtDate(bankTo)} porque {holder} só tem extrato até essa data. Suba o extrato mais recente dessa conta, mesmo sem movimento.</p>}
        </div>
        {active
          ? <Button variant="outline" disabled={setStatus.isPending} onClick={() => act('pausado')}><Undo2 className="mr-1 h-4 w-4" />Pausar e voltar para a planilha</Button>
          : <Button disabled={setStatus.isPending || isLoading || !ok} onClick={() => { if (confirm('Ativar o Fluxo de Caixa no Dashboard e no Fluxo Diário desta empresa? Pode ser pausado a qualquer momento.')) act('ativo'); }}><Power className="mr-1 h-4 w-4" />Aprovar e ativar</Button>}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Calculando prévia…</p> : (<>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-medium">Mês</th><th className="text-right font-medium">Dashboard / Fluxo Diário</th><th className="text-right font-medium">Banco</th></tr></thead>
          <tbody>
            {row('Saldo inicial (saldo do banco no dia anterior)', p.next.ini, bankIni)}
            {row('Entradas no banco', p.genIn, p.genIn)}
            {row('Saídas no banco', p.genOut, p.genOut)}
            {row('Receitas realizadas', m.receitasRealizadas)}
            {row('Despesas realizadas', m.despesasRealizadas)}
            {row('Resultado realizado', m.receitasRealizadas - m.despesasRealizadas)}
            {row('Operações fora do resultado', m.operacoesIn - m.operacoesOut - p.ign)}
            {p.ign !== 0 && row('Ignorados (banco) — só no saldo', p.ign)}
            {row('Movimento realizado no caixa', m.saldoMovimentoRealizado, p.bankMov)}
            {row(`Saldo realizado em ${fmtDate(bankTo)}`, p.next.fimReal, bankFim)}
            {retidoTotal !== 0 && <tr className="text-muted-foreground"><td className="py-1 pl-4 text-xs" colSpan={2}>dos quais cheques retidos pelo banco (liberam nos próximos dias)</td><td className="text-right text-xs tabular-nums">{fmtBRL(retidoTotal)}</td></tr>}
          </tbody></table></div>

        <ul className="space-y-1 text-sm">
          <li>{movOk ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className="mr-1 inline h-4 w-4 text-destructive" />}
            Movimento do mês {movOk ? 'bate com o banco' : `difere do banco em ${fmtBRL(p.next.mov.saldoMovimentoRealizado - p.bankMov)}`}</li>
          <li>{p.aClass.length === 0 ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className="mr-1 inline h-4 w-4 text-warning" />}
            {p.aClass.length === 0 ? 'Nenhuma movimentação a classificar' : `${p.aClass.length} movimentações ainda a classificar`}</li>
          <li>{iniDiff === 0 ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className="mr-1 inline h-4 w-4 text-warning" />}
            {iniDiff === 0 ? 'Saldo inicial igual ao saldo do banco' : `Saldo inicial difere do banco em ${fmtBRL(iniDiff)}`}</li>
          <li>{fimOk ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" /> : <AlertTriangle className={`mr-1 inline h-4 w-4 ${fimSmall ? 'text-warning' : 'text-destructive'}`} />}
            {fimOk ? (retidoTotal ? `Saldo final bate com o banco (inclui ${fmtBRL(retidoTotal)} em cheques retidos)` : 'Saldo final igual ao saldo do banco')
              : fimSmall ? `Saldo final: ${fmtBRL(Math.abs(fimDiff))} a confirmar no próximo extrato (rendimento/centavos)${retidoTotal ? ` · inclui ${fmtBRL(retidoTotal)} em cheques retidos` : ''} — não bloqueia a ativação`
              : `Saldo final difere do banco em ${fmtBRL(fimDiff)}`}</li>
          {(p.adjust !== 0 || r2(p.planIniReal - bankIni) !== 0) && <li className="text-muted-foreground">Informativo: o histórico antigo terminava agosto com {fmtBRL(p.planIni)} (projetado) e {fmtBRL(p.planIniReal)} (realizado); a diferença entre eles ({fmtBRL(p.planIniReal - p.planIni)}) vem de previsões antigas que nunca viraram realizado. Agosto não é alterado; com o Fluxo de Caixa, setembro começa pelo saldo do banco nos dois.</li>}
        </ul>
        {(!fimOk || retidoTotal !== 0) && latest.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Cheques retidos pelo banco</p>
            <p className="mb-2 text-xs text-muted-foreground">Se o extrato mostra cheques depositados que o banco ainda segura, informe o valor retido na conta. Ele soma ao saldo disponível (o dinheiro já está nos lançamentos) e some sozinho quando o próximo extrato vier com o cheque liberado. Sobras de até R$ 20,00 (rendimento/centavos) ficam "a confirmar no próximo extrato" e não bloqueiam.</p>
            <div className="space-y-1.5">
              {latest.map(({ acc, anc }) => (
                <div key={acc.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-40 truncate">{acc.nome}</span>
                  <span className="text-xs text-muted-foreground">extrato {fmtDate(anc!.data)}</span>
                  <Input className="h-8 w-36" placeholder="0,00" value={draft[anc!.id] ?? (anc!.retido ? String(anc!.retido.toFixed(2)).replace('.', ',') : '')}
                    onChange={e => setDraft(d => ({ ...d, [anc!.id]: e.target.value }))} />
                  <Button size="sm" variant="outline" disabled={setRetido.isPending || draft[anc!.id] === undefined} onClick={() => saveRetido(anc!.id, draft[anc!.id] ?? '')}>Salvar</Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!active && !ok && <p className="text-xs text-muted-foreground">O botão de ativar libera quando saldo inicial, movimento e saldo final baterem com o banco e não houver nada a classificar.</p>}
      </>)}
    </section>
  );
}
