import { useMemo, useState } from 'react';
import { useEntries } from '@/hooks/useFinancialData';
import { FinancialEntry } from '@/types/financial';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Plus, Trash2, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface SimulationProps { schoolId: string; }
function formatCurrency(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
interface SimEntry { id: string; descricao: string; valor: number; tipo: 'entrada' | 'saida'; }

export function Simulation({ schoolId }: SimulationProps) {
  const { data: entries = [] } = useEntries(schoolId);
  const [matriculas, setMatriculas] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [inadimplencia, setInadimplencia] = useState(0);
  const [extras, setExtras] = useState<SimEntry[]>([]);
  const totalReceitas = entries.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const totalDespesas = entries.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);
  const receitaMatriculas = matriculas * ticketMedio * (1 - inadimplencia / 100);
  const extrasEntradas = extras.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0);
  const extrasSaidas = extras.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0);
  const receitaSimulada = totalReceitas + receitaMatriculas + extrasEntradas;
  const despesaSimulada = totalDespesas + extrasSaidas;
  const resultadoSimulado = receitaSimulada - despesaSimulada;
  const metaValor = resultadoSimulado < 0 ? Math.abs(resultadoSimulado) : 0;
  const metaMatriculas = ticketMedio > 0 && inadimplencia < 100 ? Math.ceil(metaValor / (ticketMedio * (1 - inadimplencia / 100))) : 0;
  const addExtra = (tipo: 'entrada' | 'saida') => setExtras([...extras, { id: crypto.randomUUID(), descricao: '', valor: 0, tipo }]);
  const updateExtra = (id: string, field: keyof SimEntry, value: any) => setExtras(extras.map(e => e.id === id ? { ...e, [field]: value } : e));
  const removeExtra = (id: string) => setExtras(extras.filter(e => e.id !== id));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-xl p-6 space-y-4">
          <h3 className="font-display font-semibold flex items-center gap-2"><Calculator className="w-5 h-5 text-secondary" />Parâmetros da Simulação</h3>
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-muted-foreground">Novas Matrículas</label><Input type="number" value={matriculas || ''} onChange={e => setMatriculas(Number(e.target.value))} className="bg-surface mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Ticket Médio (R$)</label><Input type="number" value={ticketMedio || ''} onChange={e => setTicketMedio(Number(e.target.value))} className="bg-surface mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Inadimplência (%)</label><Input type="number" value={inadimplencia || ''} onChange={e => setInadimplencia(Number(e.target.value))} className="bg-surface mt-1" min={0} max={100} /></div>
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addExtra('entrada')} className="text-xs"><Plus className="w-3 h-3 mr-1" /> Receita</Button>
              <Button size="sm" variant="outline" onClick={() => addExtra('saida')} className="text-xs"><Plus className="w-3 h-3 mr-1" /> Despesa</Button>
            </div>
            {extras.map(ex => (
              <div key={ex.id} className="flex gap-2 items-center">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${ex.tipo === 'entrada' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{ex.tipo === 'entrada' ? 'REC' : 'DES'}</span>
                <Input placeholder="Descrição" value={ex.descricao} onChange={e => updateExtra(ex.id, 'descricao', e.target.value)} className="bg-surface text-xs h-8" />
                <Input type="number" placeholder="Valor" value={ex.valor || ''} onChange={e => updateExtra(ex.id, 'valor', Number(e.target.value))} className="bg-surface text-xs h-8 w-28" />
                <button onClick={() => removeExtra(ex.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="glass-card rounded-xl p-6 space-y-3">
            <h3 className="font-display font-semibold">Resultado da Simulação</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Receitas base</span><span className="text-success">{formatCurrency(totalReceitas)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">+ Matrículas simuladas</span><span className="text-success">{formatCurrency(receitaMatriculas)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">+ Receitas extras</span><span className="text-success">{formatCurrency(extrasEntradas)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>Total Receitas</span><span className="text-success">{formatCurrency(receitaSimulada)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Despesas base</span><span className="text-destructive">{formatCurrency(totalDespesas)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">+ Despesas extras</span><span className="text-destructive">{formatCurrency(extrasSaidas)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>Total Despesas</span><span className="text-destructive">{formatCurrency(despesaSimulada)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between text-lg font-bold font-display"><span>Resultado</span><span className={resultadoSimulado >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(resultadoSimulado)}</span></div>
            </div>
          </div>
          <div className={`glass-card rounded-xl p-6 ${metaValor > 0 ? 'glow-orange' : 'glow-green'}`}>
            <div className="flex items-center gap-2 mb-3"><Target className={`w-5 h-5 ${metaValor > 0 ? 'text-secondary' : 'text-success'}`} /><h3 className="font-display font-semibold text-sm">Meta para não ficar negativo</h3></div>
            {metaValor > 0 ? (<div className="space-y-1 text-sm"><p>Valor necessário: <span className="font-semibold text-secondary">{formatCurrency(metaValor)}</span></p>{metaMatriculas > 0 && <p>Ou <span className="font-semibold text-secondary">{metaMatriculas}</span> matrículas adicionais</p>}</div>) : (<p className="text-sm text-success font-medium">Resultado positivo! ✓</p>)}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
