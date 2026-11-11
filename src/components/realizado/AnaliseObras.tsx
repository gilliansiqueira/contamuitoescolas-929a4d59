import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  resultadoPorObra, topObras, topFornecedores, evolucaoCategorias, obraVsEstrutura, obrasEmDestaque,
  type CCItem, type CCGroup,
} from '@/lib/costCenterAnalytics';

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const ymLabel = (ym: string) => `${ym.slice(5)}/${ym.slice(2, 4)}`;

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl"><CardContent className="p-4 space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>{children}
    </CardContent></Card>
  );
}

function Ranking({ rows }: { rows: { nome: string; valor: number; pct: number }[] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">Sem dados no período.</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={r.nome} className="text-xs">
          <div className="flex justify-between gap-2"><span className="truncate">{i + 1}. {r.nome}</span>
            <span className="whitespace-nowrap font-medium">{formatCurrency(r.valor)} · {pct(r.pct)}</span></div>
          <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.max(2, r.pct * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function AnaliseObras({ items, allItems, groups, meses }: { items: CCItem[]; allItems: CCItem[]; groups: CCGroup[]; meses: string[] }) {
  const ms = useMemo(() => meses.slice().sort(), [meses.join(',')]);
  const ultimo = ms[ms.length - 1];
  const res = useMemo(() => resultadoPorObra(items, groups), [items, groups]);
  const obras = useMemo(() => topObras(items, groups), [items, groups]);
  const forn = useMemo(() => topFornecedores(items), [items]);
  const evol = useMemo(() => evolucaoCategorias(items, ms), [items, ms]);
  const ove = useMemo(() => obraVsEstrutura(items, groups), [items, groups]);
  const dest = useMemo(() => (ultimo ? obrasEmDestaque(allItems, groups, ultimo) : []), [allItems, groups, ultimo]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Box title="Obra x estrutura">
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span>Obras</span><b>{formatCurrency(ove.obras)} · {pct(ove.pctObras)}</b></div>
            <div className="flex justify-between"><span>Estrutura (ATHER ENGENHARIA)</span><b>{formatCurrency(ove.estrutura)} · {pct(ove.pctEstrutura)}</b></div>
            <div className="flex h-2 rounded overflow-hidden bg-muted mt-2">
              <div className="bg-primary" style={{ width: `${ove.pctObras * 100}%` }} />
              <div className="bg-accent" style={{ width: `${ove.pctEstrutura * 100}%` }} />
            </div>
          </div>
        </Box>
        <Box title={`Obras em destaque${ultimo ? ` (${ymLabel(ultimo)})` : ''}`}>
          {dest.length ? dest.slice(0, 6).map(d => (
            <div key={d.nome} className="text-xs flex justify-between gap-2"><span className="truncate">{d.nome}</span>
              <span className="whitespace-nowrap text-destructive font-medium">+{pct(d.variacao)} ({formatCurrency(d.atual)})</span></div>
          )) : <p className="text-xs text-muted-foreground">Nenhuma obra acima de 30% da média anterior.</p>}
        </Box>
        <Box title="Top 10 obras por gasto"><Ranking rows={obras} /></Box>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Box title="Top 10 fornecedores"><Ranking rows={forn} /></Box>
        <Box title="Evolução das maiores categorias">
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Categoria</th>
              {ms.map(m => <th key={m} className="text-right font-normal">{ymLabel(m)}</th>)}<th className="text-right font-normal">Var.</th></tr></thead>
            <tbody>{evol.map(e => (
              <tr key={e.categoria} className="border-t border-border/40"><td className="truncate max-w-[160px] py-1">{e.categoria}</td>
                {e.valores.map((v, i) => <td key={i} className="text-right whitespace-nowrap">{formatCurrency(v)}</td>)}
                <td className={`text-right ${e.variacao != null && e.variacao > 0 ? 'text-destructive' : 'text-primary'}`}>{pct(e.variacao)}</td></tr>
            ))}</tbody>
          </table></div>
        </Box>
      </div>
      <Box title="Resultado por obra">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Obra</th><th className="text-right font-normal">Receita</th>
            <th className="text-right font-normal">Despesa</th><th className="text-right font-normal">Resultado</th><th className="text-right font-normal">Margem</th></tr></thead>
          <tbody>{res.map(r => (
            <tr key={r.id} className="border-t border-border/40"><td className="py-1">{r.name}</td>
              <td className="text-right">{formatCurrency(r.receita)}</td><td className="text-right">{formatCurrency(r.despesa)}</td>
              <td className={`text-right font-medium ${r.resultado < 0 ? 'text-destructive' : ''}`}>{formatCurrency(r.resultado)}</td>
              <td className="text-right">{pct(r.margem)}</td></tr>
          ))}</tbody>
        </table></div>
        <p className="text-[11px] text-muted-foreground">Meses sem receitas lançadas mostram só despesas (margem "—").</p>
      </Box>
    </div>
  );
}
