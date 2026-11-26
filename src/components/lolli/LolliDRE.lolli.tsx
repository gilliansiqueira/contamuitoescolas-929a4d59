import { useLolliDRE } from '@/hooks/useLolliDRE';
import { useGlobalPeriod } from '@/contexts/GlobalPeriodContext';
import { Button } from '@/components/ui/button';
import { Package, ShoppingBag, TrendingUp } from 'lucide-react';
import type { buildCommerceDRE } from '@/lib/ledgerEngine';

type Result = ReturnType<typeof buildCommerceDRE>;
const lines: { key: keyof Result; label: string; result?: boolean }[] = [
  { key: 'receitaBruta', label: 'Receita bruta' }, { key: 'descontos', label: '(−) Descontos' },
  { key: 'cancelamentos', label: 'Cancelamentos / reembolsos (informativo)' },
  { key: 'receitaLiquida', label: 'Receita líquida', result: true },
  { key: 'cogs', label: '(−) CMV' }, { key: 'lucroBruto', label: 'Lucro bruto', result: true },
  { key: 'fretes', label: '(−) Fretes subsidiados' }, { key: 'freteEmpresa', label: '(−) Frete pago pela empresa' },
  { key: 'taxasPagamento', label: '(−) Taxas de pagamento' }, { key: 'taxasPlataforma', label: '(−) Taxas de marketplace' },
  { key: 'despesasVariaveis', label: '(−) Despesas variáveis' },
  { key: 'margemContribuicao', label: 'Margem de contribuição', result: true },
  { key: 'investimentoMkt', label: '(−) Investimento em marketing' },
  { key: 'despesasFixas', label: '(−) Despesas fixas' }, { key: 'despesasAdmin', label: '(−) Despesas administrativas' },
  { key: 'totalDespesasGrupos', label: '(−) Despesas por grupo' },
  { key: 'resultadoOperacional', label: 'Resultado operacional', result: true },
];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function LolliDRE({ schoolId }: { schoolId: string }) {
  const { months } = useGlobalPeriod();
  const { data, isLoading, error, refetch } = useLolliDRE(schoolId, months);
  if (error) return <div role="alert" className="py-6"><p>Não foi possível carregar a DRE.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div>;
  if (isLoading || !data) return <p className="py-12 text-muted-foreground">Carregando DRE…</p>;
  return <section aria-label="DRE da Srta Lolli" className="space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { label: 'Receita líquida', value: data.receitaLiquida, icon: ShoppingBag },
        { label: 'Lucro bruto', value: data.lucroBruto, icon: Package },
        { label: 'Resultado operacional', value: data.resultadoOperacional, icon: TrendingUp },
      ].map(item => <div key={item.label} className="rounded-md border border-border bg-card p-4"><item.icon className="mb-3 h-4 w-4 text-primary" /><p className={`text-xl font-semibold tabular-nums break-words ${item.value < 0 ? 'text-destructive' : 'text-foreground'}`}>{brl(item.value)}</p><p className="mt-1 text-xs text-muted-foreground">{item.label}</p></div>)}
    </div>
    <h2 className="text-base font-semibold">DRE gerencial</h2>
    <div className="overflow-x-auto border-y border-border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="text-left px-3 py-3">Conta</th><th className="text-right px-3 py-3">Valor</th></tr></thead><tbody>
      {lines.map(line => <tr key={line.key} className={`border-t border-border ${line.result ? 'bg-accent/40 font-semibold' : ''}`}><td className="px-3 py-3">{line.label}</td><td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{brl(Number(data[line.key]))}</td></tr>)}
    </tbody></table></div>
    {data.despesasGrupos.length > 0 && <div><h3 className="mb-3 font-semibold text-sm">Despesas por grupo</h3><div className="divide-y divide-border">{data.despesasGrupos.map(g => <div key={g.grupo} className="flex justify-between gap-3 py-3 text-sm"><span>{g.grupo}</span><span className="tabular-nums whitespace-nowrap">{brl(g.valor)}</span></div>)}</div></div>}
  </section>;
}