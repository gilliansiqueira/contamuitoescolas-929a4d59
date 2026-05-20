import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEntries, useTypeClassifications } from '@/hooks/useFinancialData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { filterActiveEntries, getEffectiveClassification } from '@/lib/classificationUtils';

interface SimulationProps { schoolId: string; }

interface Product {
  id: string;
  nome: string;
  valor_unitario: number;
  parcelas: number;
  sort_order: number;
  isNew?: boolean;
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
  const { data: entries = [] } = useEntries(schoolId);
  const { data: classifications = [] } = useTypeClassifications(schoolId);

  // 12 meses do ano corrente (Jan..Dez)
  const months = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
  }, []);

  // Produtos
  const { data: dbProducts = [] } = useQuery({
    queryKey: ['simulation_products', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulation_products' as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!schoolId,
  });

  // Quantidades por mês
  const { data: dbQuantities = [] } = useQuery({
    queryKey: ['simulation_monthly_quantities', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulation_monthly_quantities' as any)
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!schoolId,
  });

  const [products, setProducts] = useState<Product[]>([]);
  // qtds locais: chave `${productId}|${month}` => quantity
  const [qty, setQty] = useState<Record<string, number>>({});

  useEffect(() => {
    setProducts(dbProducts.map((r: any) => ({
      id: r.id, nome: r.nome, valor_unitario: Number(r.valor_unitario),
      parcelas: r.parcelas, sort_order: r.sort_order,
    })));
  }, [dbProducts]);

  useEffect(() => {
    const map: Record<string, number> = {};
    for (const q of dbQuantities) map[`${q.product_id}|${q.month}`] = Number(q.quantity);
    setQty(map);
  }, [dbQuantities]);

  // Debounce saves
  const saveTimer = useRef<Record<string, any>>({});

  const persistProduct = useCallback((p: Product) => {
    clearTimeout(saveTimer.current[`p:${p.id}`]);
    saveTimer.current[`p:${p.id}`] = setTimeout(async () => {
      const payload = {
        school_id: schoolId,
        nome: p.nome,
        valor_unitario: p.valor_unitario,
        parcelas: p.parcelas,
        sort_order: p.sort_order,
      };
      if (p.isNew) {
        const { data, error } = await supabase.from('simulation_products' as any).insert({ id: p.id, ...payload } as any).select().single();
        if (error) { toast.error(error.message); return; }
        setProducts(ps => ps.map(x => x.id === p.id ? { ...x, isNew: false } : x));
        qc.invalidateQueries({ queryKey: ['simulation_products', schoolId] });
      } else {
        const { error } = await supabase.from('simulation_products' as any).update(payload as any).eq('id', p.id);
        if (error) toast.error(error.message);
      }
    }, 500);
  }, [schoolId, qc]);

  const persistQty = useCallback((productId: string, month: string, quantity: number) => {
    const key = `${productId}|${month}`;
    clearTimeout(saveTimer.current[`q:${key}`]);
    saveTimer.current[`q:${key}`] = setTimeout(async () => {
      // upsert por (product_id, month)
      const { data: existing } = await supabase
        .from('simulation_monthly_quantities' as any)
        .select('id')
        .eq('product_id', productId)
        .eq('month', month)
        .maybeSingle();
      const payload = { school_id: schoolId, product_id: productId, month, quantity };
      if ((existing as any)?.id) {
        if (quantity === 0) {
          await supabase.from('simulation_monthly_quantities' as any).delete().eq('id', (existing as any).id);
        } else {
          await supabase.from('simulation_monthly_quantities' as any).update(payload as any).eq('id', (existing as any).id);
        }
      } else if (quantity > 0) {
        await supabase.from('simulation_monthly_quantities' as any).insert(payload as any);
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

  const updateQty = (productId: string, month: string, value: number) => {
    const key = `${productId}|${month}`;
    setQty(q => ({ ...q, [key]: value }));
    persistQty(productId, month, value);
  };

  const addProduct = () => {
    const p: Product = {
      id: crypto.randomUUID(),
      nome: '', valor_unitario: 0, parcelas: 1,
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
  // Receita simulada por mês = soma das parcelas distribuídas
  const simuladoPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const parcelas = Math.max(1, p.parcelas || 1);
      const valor = Number(p.valor_unitario) || 0;
      for (const m of months) {
        const q = qty[`${p.id}|${m}`] || 0;
        if (q <= 0) continue;
        const total = q * valor;
        const parcelaValor = total / parcelas;
        for (let i = 0; i < parcelas; i++) {
          const mm = addMonths(m, i);
          map[mm] = (map[mm] || 0) + parcelaValor;
        }
      }
    }
    return map;
  }, [products, qty, months]);

  // Receita projetada (sistema)
  const sistemaProjetadoPorMes = useMemo(() => {
    const active = filterActiveEntries(entries, classifications);
    const map: Record<string, number> = {};
    for (const e of active) {
      if (e.origem === 'fluxo') continue;
      if (e.tipoRegistro !== 'projetado') continue;
      const cls = getEffectiveClassification(e, classifications);
      if (cls !== 'receita') continue;
      map[e.data.slice(0, 7)] = (map[e.data.slice(0, 7)] || 0) + e.valor;
    }
    return map;
  }, [entries, classifications]);

  return (
    <div className="space-y-6">
      {/* Planilha matricial */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-secondary" /> Simulação — Planilha de Vendas
          </h3>
          <Button size="sm" onClick={addProduct}><Plus className="w-3 h-3 mr-1" /> Produto</Button>
        </div>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface">
                <th className="sticky left-0 z-20 bg-surface px-2 py-2 text-left font-medium text-muted-foreground min-w-[180px] border-b border-r border-border">Produto</th>
                <th className="sticky left-[180px] z-20 bg-surface px-2 py-2 text-right font-medium text-muted-foreground w-28 border-b border-r border-border">Valor</th>
                <th className="sticky left-[292px] z-20 bg-surface px-2 py-2 text-right font-medium text-muted-foreground w-20 border-b border-r border-border">Parcelas</th>
                {months.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-medium text-muted-foreground min-w-[70px] border-b border-border">{formatMonth(m)}</th>
                ))}
                <th className="px-2 py-2 w-8 border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4 + months.length} className="px-2 py-8 text-center text-muted-foreground">
                  Nenhum produto. Clique em "Produto" para começar.
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 border-b border-r border-border/30">
                    <Input value={p.nome} onChange={e => updateProduct(p.id, 'nome', e.target.value)} className="h-7 text-xs border-0 shadow-none focus-visible:ring-1" placeholder="Curso X" />
                  </td>
                  <td className="sticky left-[180px] z-10 bg-card px-2 py-1 border-b border-r border-border/30">
                    <Input type="number" step="0.01" value={p.valor_unitario || ''} onChange={e => updateProduct(p.id, 'valor_unitario', Number(e.target.value))} className="h-7 text-xs text-right border-0 shadow-none focus-visible:ring-1" />
                  </td>
                  <td className="sticky left-[292px] z-10 bg-card px-2 py-1 border-b border-r border-border/30">
                    <Input type="number" min={1} value={p.parcelas || ''} onChange={e => updateProduct(p.id, 'parcelas', Math.max(1, Number(e.target.value)))} className="h-7 text-xs text-right border-0 shadow-none focus-visible:ring-1" />
                  </td>
                  {months.map(m => {
                    const v = qty[`${p.id}|${m}`] || 0;
                    return (
                      <td key={m} className="px-1 py-1 border-b border-border/30">
                        <Input
                          type="number"
                          min={0}
                          value={v || ''}
                          onChange={e => updateQty(p.id, m, Number(e.target.value) || 0)}
                          className="h-7 text-xs text-right border-0 shadow-none focus-visible:ring-1"
                          placeholder="—"
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 border-b border-border/30 text-center">
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

      {/* Consolidação mensal */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm">Consolidação Mensal (Projeção + Simulação)</h3>
        <p className="text-xs text-muted-foreground">A simulação é apenas visual: <strong>não</strong> grava receitas em outras abas.</p>
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
                <td className="px-2 py-2 text-muted-foreground">Projeção (sistema)</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right">{formatCurrency(sistemaProjetadoPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t border-border/30">
                <td className="px-2 py-2 text-secondary">Simulação</td>
                {months.map(m => (
                  <td key={m} className="px-2 py-2 text-right text-secondary">{formatCurrency(simuladoPorMes[m] || 0)}</td>
                ))}
              </tr>
              <tr className="border-t-2 border-border bg-muted/40 font-bold">
                <td className="px-2 py-2 text-foreground">Total</td>
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
