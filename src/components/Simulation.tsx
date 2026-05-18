import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Plus, Trash2, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { filterActiveEntries, getEffectiveClassification } from '@/lib/classificationUtils';

interface SimulationProps { schoolId: string; }

interface SimRow {
  id: string;
  nome: string;
  valor: number;
  parcelas: number;
  mes_inicio: string; // YYYY-MM
  isNew?: boolean;
  dirty?: boolean;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]}/${y.slice(2)}`;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Simulation({ schoolId }: SimulationProps) {
  const qc = useQueryClient();
  const { data: entries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  // 11 meses: atual + 10 à frente
  const baseMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const months = useMemo(() => Array.from({ length: 11 }, (_, i) => addMonths(baseMonth, i)), [baseMonth]);

  const { data: dbRows = [] } = useQuery({
    queryKey: ['simulation_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulation_entries' as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!schoolId,
  });

  const [rows, setRows] = useState<SimRow[]>([]);
  useEffect(() => {
    setRows(dbRows.map((r: any) => ({
      id: r.id, nome: r.nome, valor: Number(r.valor), parcelas: r.parcelas, mes_inicio: r.mes_inicio,
    })));
  }, [dbRows]);

  const addRow = () => setRows(rs => [...rs, {
    id: crypto.randomUUID(), nome: '', valor: 0, parcelas: 1, mes_inicio: baseMonth, isNew: true, dirty: true,
  }]);

  const updateRow = (id: string, field: keyof SimRow, value: any) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value, dirty: true } : r));
  };

  const removeRow = async (id: string, isNew?: boolean) => {
    setRows(rs => rs.filter(r => r.id !== id));
    if (!isNew) {
      await supabase.from('simulation_entries' as any).delete().eq('id', id);
      qc.invalidateQueries({ queryKey: ['simulation_entries', schoolId] });
    }
  };

  const saveAll = async () => {
    const dirty = rows.filter(r => r.dirty);
    if (dirty.length === 0) {
      toast.info('Nada para salvar.');
      return;
    }
    try {
      const payload = dirty.map((r, i) => ({
        id: r.id, school_id: schoolId, nome: r.nome || 'Sem nome',
        valor: r.valor, parcelas: r.parcelas, mes_inicio: r.mes_inicio, sort_order: i,
      }));
      const { error } = await supabase
        .from('simulation_entries' as any)
        .upsert(payload as any, { onConflict: 'id' });
      if (error) throw error;
      toast.success(`${dirty.length} simulação(ões) salva(s).`);
      qc.invalidateQueries({ queryKey: ['simulation_entries', schoolId] });
    } catch (err: any) {
      toast.error(`Erro: ${err?.message ?? 'desconhecido'}`);
    }
  };

  // Distribui parcelas de uma simulação nos meses correspondentes
  const distributeRow = (r: SimRow): Record<string, number> => {
    const map: Record<string, number> = {};
    for (let i = 0; i < r.parcelas; i++) {
      const m = addMonths(r.mes_inicio, i);
      map[m] = (map[m] || 0) + (Number(r.valor) || 0);
    }
    return map;
  };

  // Receita projetada do sistema por mês (apenas projetados, ignora realizado)
  const sistemaProjetadoPorMes = useMemo(() => {
    const active = filterActiveEntries(entries, classifications);
    const map: Record<string, number> = {};
    for (const e of active) {
      if (e.origem === 'fluxo') continue;
      if (e.tipoRegistro !== 'projetado') continue;
      const cls = getEffectiveClassification(e, classifications);
      if (cls !== 'receita') continue;
      const m = e.data.slice(0, 7);
      map[m] = (map[m] || 0) + e.valor;
    }
    return map;
  }, [entries, classifications]);

  // Soma das simulações por mês
  const simuladoPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const dist = distributeRow(r);
      for (const [m, v] of Object.entries(dist)) map[m] = (map[m] || 0) + v;
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-secondary" /> Simulação de Vendas / Matrículas
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-3 h-3 mr-1" /> Nova linha</Button>
            <Button size="sm" onClick={saveAll}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground min-w-[160px]">Matrícula / Venda</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground w-28">Valor</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground w-20">Parcelas</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground w-32">Início</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground w-28">Total</th>
                {months.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-medium text-muted-foreground min-w-[80px]">{formatMonth(m)}</th>
                ))}
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6 + months.length} className="px-2 py-6 text-center text-muted-foreground">
                  Nenhuma simulação. Clique em "Nova linha" para começar.
                </td></tr>
              ) : rows.map(r => {
                const dist = distributeRow(r);
                const total = (Number(r.valor) || 0) * (r.parcelas || 0);
                return (
                  <tr key={r.id} className="border-t border-border/30">
                    <td className="px-2 py-1.5">
                      <Input value={r.nome} onChange={e => updateRow(r.id, 'nome', e.target.value)} className="h-7 text-xs" placeholder="Ex: Matrícula Ensino Fundamental" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={r.valor || ''} onChange={e => updateRow(r.id, 'valor', Number(e.target.value))} className="h-7 text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" min={1} value={r.parcelas || ''} onChange={e => updateRow(r.id, 'parcelas', Math.max(1, Number(e.target.value)))} className="h-7 text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.mes_inicio}
                        onChange={e => updateRow(r.id, 'mes_inicio', e.target.value)}
                        className="h-7 w-full border rounded px-1 text-xs bg-background"
                      >
                        {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-foreground">{formatCurrency(total)}</td>
                    {months.map(m => {
                      const v = dist[m] || 0;
                      return (
                        <td key={m} className={`px-2 py-1.5 text-right ${v > 0 ? 'text-success' : 'text-muted-foreground/40'}`}>
                          {v > 0 ? formatCurrency(v) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeRow(r.id, r.isNew)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Tabela consolidada: Projetado sistema + Simulado */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm">Projeção Consolidada (Sistema + Simulado)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground min-w-[200px]">Receita</th>
                {months.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-medium text-muted-foreground min-w-[80px]">{formatMonth(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/30">
                <td className="px-2 py-2 text-muted-foreground">Receita Projetada (sistema)</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right">{formatCurrency(sistemaProjetadoPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t border-border/30">
                <td className="px-2 py-2 text-secondary">Receita Simulada</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right text-secondary">{formatCurrency(simuladoPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t-2 border-border bg-muted/40 font-bold">
                <td className="px-2 py-2 text-foreground">Total Consolidado</td>
                {months.map(m => {
                  const total = (sistemaProjetadoPorMes[m] || 0) + (simuladoPorMes[m] || 0);
                  return <td key={m} className="px-2 py-2 text-right text-success">{formatCurrency(total)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
