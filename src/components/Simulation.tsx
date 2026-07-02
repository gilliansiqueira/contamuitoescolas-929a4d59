import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTypeClassifications } from '@/hooks/useFinancialData';
import { useProjectedEntries } from '@/hooks/useProjectedEntries';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getEffectiveClassification } from '@/lib/classificationUtils';
import { SingleMonthPicker } from '@/components/SingleMonthPicker';

interface SimulationProps { schoolId: string; }

interface Product {
  id: string;
  nome: string;
  sort_order: number;
  isNew?: boolean;
}

interface Cell {
  vendas: number;
  valor: number;
  parcelas: number;
}

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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
  const { entries, saldoInicial } = useProjectedEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  // Mês inicial do filtro (default: mês atual)
  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [startMonth, setStartMonth] = useState<string>(currentMonth);

  // 12 meses começando do startMonth (sem retroativo)
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => addMonths(startMonth, i));
  }, [startMonth]);

  // Produtos
  const { data: dbProducts = [] } = useQuery({
    queryKey: ['simulation_products', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulation_products' as any)
        .select('*').eq('school_id', schoolId).order('sort_order');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!schoolId,
  });

  // Células mensais (qty + valor + parcelas por produto/mês)
  const { data: dbCells = [] } = useQuery({
    queryKey: ['simulation_monthly_quantities', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulation_monthly_quantities' as any)
        .select('*').eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!schoolId,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [cells, setCells] = useState<Record<string, Cell>>({});

  useEffect(() => {
    setProducts(dbProducts.map((r: any) => ({
      id: r.id, nome: r.nome, sort_order: r.sort_order,
    })));
  }, [dbProducts]);

  useEffect(() => {
    const map: Record<string, Cell> = {};
    for (const q of dbCells) {
      map[`${q.product_id}|${q.month}`] = {
        vendas: Number(q.quantity) || 0,
        valor: Number(q.valor_unitario) || 0,
        parcelas: Math.max(1, Number(q.parcelas) || 1),
      };
    }
    setCells(map);
  }, [dbCells]);

  const saveTimer = useRef<Record<string, any>>({});

  const persistProduct = useCallback((p: Product) => {
    clearTimeout(saveTimer.current[`p:${p.id}`]);
    saveTimer.current[`p:${p.id}`] = setTimeout(async () => {
      const payload: any = {
        school_id: schoolId, nome: p.nome,
        valor_unitario: 0, parcelas: 1, sort_order: p.sort_order,
      };
      if (p.isNew) {
        const { error } = await supabase.from('simulation_products' as any).insert({ id: p.id, ...payload });
        if (error) { toast.error(error.message); return; }
        setProducts(ps => ps.map(x => x.id === p.id ? { ...x, isNew: false } : x));
        qc.invalidateQueries({ queryKey: ['simulation_products', schoolId] });
      } else {
        const { error } = await supabase.from('simulation_products' as any)
          .update({ nome: p.nome, sort_order: p.sort_order }).eq('id', p.id);
        if (error) toast.error(error.message);
      }
    }, 500);
  }, [schoolId, qc]);

  const persistCell = useCallback((productId: string, month: string, cell: Cell) => {
    const key = `${productId}|${month}`;
    clearTimeout(saveTimer.current[`q:${key}`]);
    saveTimer.current[`q:${key}`] = setTimeout(async () => {
      const { data: existing } = await supabase
        .from('simulation_monthly_quantities' as any)
        .select('id').eq('product_id', productId).eq('month', month).maybeSingle();
      const empty = cell.vendas === 0 && cell.valor === 0;
      const payload: any = {
        school_id: schoolId, product_id: productId, month,
        quantity: cell.vendas, valor_unitario: cell.valor,
        parcelas: Math.max(1, cell.parcelas || 1),
      };
      if ((existing as any)?.id) {
        if (empty) {
          await supabase.from('simulation_monthly_quantities' as any).delete().eq('id', (existing as any).id);
        } else {
          await supabase.from('simulation_monthly_quantities' as any).update(payload).eq('id', (existing as any).id);
        }
      } else if (!empty) {
        await supabase.from('simulation_monthly_quantities' as any).insert(payload);
      }
    }, 500);
  }, [schoolId]);

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(ps => {
      const next = ps.map(p => p.id === id ? { ...p, [field]: value } : p);
      const updated = next.find(p => p.id === id);
      if (updated) persistProduct(updated);
      return next;
    });
  };

  const updateCell = (productId: string, month: string, field: keyof Cell, value: number) => {
    const key = `${productId}|${month}`;
    setCells(c => {
      const prev = c[key] || { vendas: 0, valor: 0, parcelas: 1 };
      const next = { ...prev, [field]: value };
      if (field === 'parcelas') next.parcelas = Math.max(1, value || 1);
      persistCell(productId, month, next);
      return { ...c, [key]: next };
    });
  };

  const addProduct = () => {
    const p: Product = {
      id: crypto.randomUUID(), nome: '',
      sort_order: products.length, isNew: true,
    };
    setProducts(ps => [...ps, p]);
    persistProduct(p);
  };

  const removeProduct = async (id: string, isNew?: boolean) => {
    setProducts(ps => ps.filter(p => p.id !== id));
    if (!isNew) {
      await supabase.from('simulation_products' as any).delete().eq('id', id);
      qc.invalidateQueries({ queryKey: ['simulation_products', schoolId] });
      qc.invalidateQueries({ queryKey: ['simulation_monthly_quantities', schoolId] });
    }
  };

  // ===== Cálculos =====
  // Receita simulada distribuída por mês a partir das parcelas
  const simuladoPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      for (const m of months) {
        const c = cells[`${p.id}|${m}`];
        if (!c || c.vendas <= 0 || c.valor <= 0) continue;
        const parcelas = Math.max(1, c.parcelas || 1);
        const parcelaValor = (c.vendas * c.valor) / parcelas;
        for (let i = 0; i < parcelas; i++) {
          const mm = addMonths(m, i);
          map[mm] = (map[mm] || 0) + parcelaValor;
        }
      }
    }
    return map;
  }, [products, cells, months]);

  // Receita projetada (sistema) — usa dataProjetada (mesma base de Recebíveis)
  const sistemaProjetadoPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (e.origem === 'fluxo') continue;
      if (e.tipoRegistro !== 'projetado') continue;
      const cls = getEffectiveClassification(e, classifications);
      if (cls !== 'receita') continue;
      const mes = (e.dataProjetada || e.data).slice(0, 7);
      map[mes] = (map[mes] || 0) + e.valor;
    }
    return map;
  }, [entries, classifications]);

  // Contas a pagar projetadas (sistema) — despesas, também por dataProjetada
  const contasPagarPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (e.origem === 'fluxo') continue;
      if (e.tipoRegistro !== 'projetado') continue;
      const cls = getEffectiveClassification(e, classifications);
      if (cls !== 'despesa') continue;
      const mes = (e.dataProjetada || e.data).slice(0, 7);
      map[mes] = (map[mes] || 0) + e.valor;
    }
    return map;
  }, [entries, classifications]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-secondary" /> Simulação — Planilha de Vendas
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">A partir de:</span>
            <SingleMonthPicker value={startMonth} onChange={(m) => m && setStartMonth(m)} />
            <Button size="sm" onClick={addProduct}><Plus className="w-3 h-3 mr-1" /> Produto</Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cada mês: <strong>Vendas × Valor ÷ Parcelas</strong> = valor mensal projetado, distribuído pelas parcelas seguintes. Sem retroativo.
        </p>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface">
                <th className="sticky left-0 z-20 bg-surface px-2 py-2 text-left font-medium text-muted-foreground min-w-[180px] border-b border-r border-border">Produto</th>
                {months.map(m => (
                  <th key={m} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[130px] border-b border-r border-border/50 last:border-r-0">
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="px-2 py-2 w-8 border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={2 + months.length} className="px-2 py-8 text-center text-muted-foreground">
                  Nenhum produto. Clique em "Produto" para começar.
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-muted/10 align-top">
                  <td className="sticky left-0 z-10 bg-card px-2 py-2 border-b border-r border-border/30">
                    <Input
                      value={p.nome}
                      onChange={e => updateProduct(p.id, 'nome', e.target.value)}
                      className="h-8 text-xs"
                      placeholder="Curso X"
                    />
                  </td>
                  {months.map(m => {
                    const c = cells[`${p.id}|${m}`] || { vendas: 0, valor: 0, parcelas: 1 };
                    const mensal = c.vendas > 0 && c.valor > 0
                      ? (c.vendas * c.valor) / Math.max(1, c.parcelas || 1)
                      : 0;
                    return (
                      <td key={m} className="px-1.5 py-2 border-b border-r border-border/20 last:border-r-0">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground w-12">Vendas</span>
                            <Input type="number" min={0} value={c.vendas || ''}
                              onChange={e => updateCell(p.id, m, 'vendas', Number(e.target.value) || 0)}
                              className="h-6 text-[11px] text-right px-1.5" placeholder="0" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground w-12">Valor</span>
                            <Input type="number" step="0.01" min={0} value={c.valor || ''}
                              onChange={e => updateCell(p.id, m, 'valor', Number(e.target.value) || 0)}
                              className="h-6 text-[11px] text-right px-1.5" placeholder="0,00" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground w-12">Parcelas</span>
                            <Input type="number" min={1} value={c.parcelas || ''}
                              onChange={e => updateCell(p.id, m, 'parcelas', Number(e.target.value) || 1)}
                              className="h-6 text-[11px] text-right px-1.5" placeholder="1" />
                          </div>
                          <div className="flex items-center gap-1 pt-0.5 border-t border-border/30">
                            <span className="text-[9px] text-muted-foreground w-12">Mensal</span>
                            <div className="flex-1 text-[11px] text-right font-semibold text-secondary pr-1.5">
                              {mensal > 0 ? formatCurrency(mensal) : '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-b border-border/30 text-center">
                    <button onClick={() => removeProduct(p.id, p.isNew)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Consolidação */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm">Consolidação Mensal</h3>
        <p className="text-xs text-muted-foreground">Simulação isolada: <strong>não</strong> grava em outras abas.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground min-w-[200px]">Linha</th>
                {months.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-medium text-muted-foreground min-w-[90px]">{formatMonth(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/30">
                <td className="px-2 py-2 text-muted-foreground">Receita projetada (sistema)</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right">{formatCurrency(sistemaProjetadoPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t border-border/30">
                <td className="px-2 py-2 text-secondary">Receita simulada</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right text-secondary">{formatCurrency(simuladoPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t border-border/40 bg-muted/20 font-semibold">
                <td className="px-2 py-2">Receita total</td>
                {months.map(m => {
                  const total = (sistemaProjetadoPorMes[m] || 0) + (simuladoPorMes[m] || 0);
                  return <td key={m} className="px-2 py-2 text-right text-success">{formatCurrency(total)}</td>;
                })}
              </tr>
              <tr className="border-t border-border/30">
                <td className="px-2 py-2 text-muted-foreground">Contas a pagar (projetado)</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right text-destructive">{formatCurrency(contasPagarPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t-2 border-border bg-muted/40 font-bold">
                <td className="px-2 py-2 text-foreground">Resultado simulado</td>
                {months.map(m => {
                  const res = (sistemaProjetadoPorMes[m] || 0) + (simuladoPorMes[m] || 0) - (contasPagarPorMes[m] || 0);
                  return (
                    <td key={m} className={`px-2 py-2 text-right ${res >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(res)}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t-2 border-primary/40 bg-primary/5 font-bold">
                <td className="px-2 py-2 text-foreground">
                  Saldo final projetado <span className="text-[10px] font-normal text-muted-foreground">(com simulação)</span>
                </td>
                {(() => {
                  let acc = saldoInicial || 0;
                  return months.map(m => {
                    const res = (sistemaProjetadoPorMes[m] || 0) + (simuladoPorMes[m] || 0) - (contasPagarPorMes[m] || 0);
                    acc += res;
                    return (
                      <td key={m} className={`px-2 py-2 text-right ${acc >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(acc)}
                      </td>
                    );
                  });
                })()}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
