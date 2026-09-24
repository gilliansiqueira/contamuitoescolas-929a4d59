import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBankAccounts, useBankTransactions } from '@/hooks/useBankPilot';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { summarize, accountBalance, lastDateByAccount } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, todayIso } from './shared';
import { BankTransactionsTable } from './BankTransactionsTable';
import { BankAccountsImports } from './BankAccountsImports';
import { Landmark, ShieldCheck } from 'lucide-react';

interface Props { schoolId: string; selectedMonth: string }

function monthRange(m: string) {
  const [y, mo] = m.slice(0, 7).split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return { from: `${m.slice(0, 7)}-01`, to: `${m.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

export function FluxoBancario({ schoolId, selectedMonth }: Props) {
  const { data: accounts = [] } = useBankAccounts(schoolId);
  const { data: txs = [], isLoading } = useBankTransactions(schoolId);
  const { entries: projected } = useProjectedEntries(schoolId);
  const today = todayIso();
  const { from, to } = monthRange(selectedMonth);
  const active = accounts.filter(a => a.ativa);

  const summary = useMemo(() => summarize(active, txs, from, to, today), [active, txs, from, to, today]);
  const lastDates = useMemo(() => lastDateByAccount(txs), [txs]);

  // Saldo projetado: saldo bancário atual + lançamentos futuros já existentes da projeção (SSOT).
  const horizon = to > today ? to : today;
  const futuro = useMemo(
    () => projected.filter(e => e.origem !== 'fluxo' && e.dataProjetada > today && e.dataProjetada <= horizon).reduce((s, e) => s + e.impacto, 0),
    [projected, today, horizon],
  );
  const saldoProjetado = summary.saldoAtual + futuro;
  const ultimaAtualizacao = [...lastDates.values()].sort().pop();

  const cards = [
    { label: 'Saldo atual', value: fmtBRL(summary.saldoAtual), hint: `em ${fmtDate(today)}` },
    { label: 'Entradas realizadas', value: fmtBRL(summary.entradasRealizadas), hint: 'no mês, sem transferências internas' },
    { label: 'Saídas realizadas', value: fmtBRL(summary.saidasRealizadas), hint: 'no mês, sem transferências internas' },
    { label: 'Saldo projetado', value: fmtBRL(saldoProjetado), hint: `até ${fmtDate(horizon)}` },
    { label: 'Última atualização', value: fmtDate(ultimaAtualizacao), hint: 'último lançamento importado' },
    { label: 'Conciliado', value: `${summary.percentConciliado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, hint: 'dos lançamentos do mês' },
    { label: 'Pendências', value: String(summary.pendentesQtd), hint: 'lançamentos do mês' },
    { label: 'Valor pendente', value: fmtBRL(summary.pendentesValor), hint: 'soma dos pendentes do mês' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Fluxo Bancário</h2>
          <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Piloto</span>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Visível apenas para administradores. Não altera Dashboard, Fluxo Diário nem relatórios.</p>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="contas">Contas e Extratos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(c => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-1 font-display text-xl font-bold text-foreground">{isLoading ? '…' : c.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Saldo por conta</h3>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada. Cadastre em "Contas e Extratos".</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Conta</th><th>Atualizada até</th><th className="text-right">Saldo atual</th></tr></thead>
                <tbody>
                  {active.map(a => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 font-medium">{a.nome} <span className="text-xs text-muted-foreground">{a.banco}</span></td>
                      <td>{fmtDate(lastDates.get(a.id))}</td>
                      <td className="text-right tabular-nums">{fmtBRL(accountBalance(a, txs, today))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-bold"><td className="py-2">Consolidado</td><td /><td className="text-right tabular-nums">{fmtBRL(summary.saldoAtual)}</td></tr>
                </tbody>
              </table>
            )}
            {summary.transferenciasInternas > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Transferências entre contas próprias no mês: {fmtBRL(summary.transferenciasInternas)} (fora de entradas e saídas).</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="movimentacoes">
          <BankTransactionsTable schoolId={schoolId} accounts={accounts} txs={txs} defaultFrom={from} defaultTo={to} />
        </TabsContent>

        <TabsContent value="contas">
          <BankAccountsImports schoolId={schoolId} accounts={accounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
