import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { distribuicaoValida, valoresExpedicao, type ExpedicaoSimulada, type ModeloExpedicao } from '@/lib/previsao';

const cur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mes = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;
const numero = (v: string) => Math.max(0, Number(v) || 0);

export function ExpedicoesEditor({ modelos, expedicoes, meses, onChange }: {
  modelos: ModeloExpedicao[]; expedicoes: ExpedicaoSimulada[]; meses: string[];
  onChange: (expedicoes: ExpedicaoSimulada[]) => void;
}) {
  const modeloNovo = (modelo: ModeloExpedicao): ExpedicaoSimulada => ({
    id: crypto.randomUUID(), centro: modelo.centro, nome: modelo.centro, participantes: 0,
    ticket: modelo.ticket, custoPessoa: modelo.custoPessoa,
    entradasPct: { [meses[0]]: 100 }, saidasPct: { [meses[0]]: 100 },
  });
  const alterar = (id: string, next: Partial<ExpedicaoSimulada>) => onChange(expedicoes.map(e => e.id === id ? { ...e, ...next } : e));

  return <section className="space-y-3" aria-label="Expedições a vender">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Expedições a vender</h4>
      <Button size="sm" variant="outline" disabled={!modelos.length} onClick={() => {
        const modelo = modelos[0]; if (modelo) onChange([...expedicoes, modeloNovo(modelo)]);
      }}><Plus className="mr-1 h-3.5 w-3.5" />Expedição</Button>
    </div>
    {!modelos.length && <p className="text-xs text-muted-foreground">Nenhum centro de expedição cadastrado.</p>}
    {expedicoes.map(e => {
      const modelo = modelos.find(m => m.centro === e.centro);
      const valores = valoresExpedicao(e, meses);
      return <div key={e.id} className="border border-border rounded-lg p-3 space-y-3" data-expedicao={e.id}>
        <div className="flex items-center gap-2">
          <Select value={e.centro} onValueChange={centro => {
            const m = modelos.find(x => x.centro === centro);
            if (m) alterar(e.id, { centro, nome: centro, ticket: m.ticket, custoPessoa: m.custoPessoa });
          }}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Centro da expedição"><SelectValue /></SelectTrigger>
            <SelectContent>{modelos.map(m => <SelectItem key={m.centro} value={m.centro}>{m.centro}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="icon" variant="ghost" title="Remover expedição" aria-label={`Remover ${e.nome}`} onClick={() => onChange(expedicoes.filter(x => x.id !== e.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="text-xs space-y-1"><span>Nome</span><Input aria-label={`Nome ${e.centro}`} value={e.nome} onChange={v => alterar(e.id, { nome: v.target.value })} /></label>
          <label className="text-xs space-y-1"><span>Novos participantes</span><Input aria-label={`Novos participantes ${e.centro}`} type="number" min={0} step={1} value={e.participantes} onChange={v => alterar(e.id, { participantes: Math.floor(numero(v.target.value)) })} /></label>
          <label className="text-xs space-y-1"><span>Ticket médio (R$)</span><Input aria-label={`Ticket ${e.centro}`} type="number" min={0} step="0.01" value={e.ticket ?? ''} placeholder="Não disponível" onChange={v => alterar(e.id, { ticket: v.target.value === '' ? null : numero(v.target.value) })} /></label>
          <label className="text-xs space-y-1 text-destructive"><span>Custo por participante (R$)</span><Input aria-label={`Custo ${e.centro}`} className="text-destructive" type="number" min={0} step="0.01" value={e.custoPessoa ?? ''} placeholder="Não disponível" onChange={v => alterar(e.id, { custoPessoa: v.target.value === '' ? null : numero(v.target.value) })} /></label>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-muted-foreground">Base 2026: {modelo?.participantes || 0} pagantes · Ticket {modelo?.ticket != null ? cur(modelo.ticket) : 'não disponível'} · Custo {modelo?.custoPessoa != null ? cur(modelo.custoPessoa) : 'não disponível'}</span>
          <span>Receita: <strong>{cur(valores.receita)}</strong></span>
          <span className="text-destructive">Custo: <strong>{cur(valores.custo)}</strong></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="text-left min-w-40">Distribuição mensal</th>{meses.map(m => <th key={m} className="min-w-24 px-1 text-right">{mes(m)}</th>)}<th className="min-w-20 text-right">Total</th></tr></thead>
            <tbody>{(['entradasPct', 'saidasPct'] as const).map(k => {
              const saida = k === 'saidasPct';
              const valido = distribuicaoValida(e[k], meses);
              const total = Object.values(e[k]).reduce((s, v) => s + v, 0);
              return <tr key={k} className={saida ? 'text-destructive' : ''}>
                <td>{saida ? 'Pagamentos (%)' : 'Recebimentos (%)'}</td>
                {meses.map(m => <td key={m} className="p-1"><Input aria-label={`${saida ? 'Pagamento' : 'Recebimento'} ${e.centro} ${m}`} className={`h-8 text-right text-xs ${saida ? 'text-destructive' : ''}`} type="number" min={0} max={100} step="0.01" value={e[k][m] || 0} onChange={v => alterar(e.id, { [k]: { ...e[k], [m]: Math.min(100, numero(v.target.value)) } })} /></td>)}
                <td className={`text-right font-semibold ${!valido ? 'text-destructive' : ''}`}>{total.toLocaleString('pt-BR')}%</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!valores.pronta && <p role="status" className="text-xs text-destructive">Expedição fora do resultado: preencha ticket e custo e complete 100% dos recebimentos e dos pagamentos.</p>}
      </div>;
    })}
  </section>;
}