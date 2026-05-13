import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { PiggyBank, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  selectedMonth: string; // 'all' | 'YYYY-MM' | 'YYYY-MM,YYYY-MM,...'
}

interface InvestmentRow {
  id?: string;
  school_id: string;
  month: string;
  aplicacao: number;
  resgate: number;
  rendimentos: number;
  encargos: number;
  rendimento_provisionado: number;
  saldo_inicial: number;
  saldo_final: number;
}

const FIELDS: { key: keyof InvestmentRow; label: string }[] = [
  { key: 'saldo_inicial', label: 'Saldo Inicial' },
  { key: 'aplicacao', label: 'Aplicação' },
  { key: 'resgate', label: 'Resgate' },
  { key: 'rendimentos', label: 'Rendimentos' },
  { key: 'encargos', label: 'Encargos' },
  { key: 'rendimento_provisionado', label: 'Rendimento Provisionado' },
  { key: 'saldo_final', label: 'Saldo Final' },
];

function emptyRow(schoolId: string, month: string): InvestmentRow {
  return {
    school_id: schoolId,
    month,
    aplicacao: 0,
    resgate: 0,
    rendimentos: 0,
    encargos: 0,
    rendimento_provisionado: 0,
    saldo_inicial: 0,
    saldo_final: 0,
  };
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBR(v: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

export function InvestimentoSection({ schoolId, selectedMonth }: Props) {
  const qc = useQueryClient();

  // Determina o mês alvo do formulário
  const targetMonth = useMemo(() => {
    if (selectedMonth === 'all') return new Date().toISOString().slice(0, 7);
    const first = selectedMonth.split(',')[0].trim();
    return first || new Date().toISOString().slice(0, 7);
  }, [selectedMonth]);

  const [editMonth, setEditMonth] = useState(targetMonth);
  useEffect(() => setEditMonth(targetMonth), [targetMonth]);

  const { data: rows = [] } = useQuery({
    queryKey: ['investment_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_entries' as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvestmentRow[];
    },
    enabled: !!schoolId,
  });

  const existing = useMemo(() => rows.find(r => r.month === editMonth), [rows, editMonth]);
  const [form, setForm] = useState<InvestmentRow>(() => emptyRow(schoolId, editMonth));
  useEffect(() => {
    setForm(existing ?? emptyRow(schoolId, editMonth));
  }, [existing, editMonth, schoolId]);

  const upsert = useMutation({
    mutationFn: async (payload: InvestmentRow) => {
      const { error } = await supabase
        .from('investment_entries' as any)
        .upsert(payload as any, { onConflict: 'school_id,month' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] });
      toast.success('Investimento salvo');
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + e.message),
  });

  // Meses visíveis (linhas a exibir): se filtro 'all', mostra todos os meses persistidos;
  // caso contrário, mostra os meses do filtro.
  const visibleMonths = useMemo(() => {
    if (selectedMonth === 'all') return rows.map(r => r.month);
    return selectedMonth.split(',').map(s => s.trim()).filter(Boolean).sort();
  }, [selectedMonth, rows]);

  const visibleRows = useMemo(() => {
    return visibleMonths
      .map(m => rows.find(r => r.month === m))
      .filter((r): r is InvestmentRow => !!r);
  }, [visibleMonths, rows]);

  const totals = useMemo(() => {
    const t = { aplicacao: 0, resgate: 0, rendimentos: 0, encargos: 0, rendimento_provisionado: 0 };
    for (const r of visibleRows) {
      t.aplicacao += Number(r.aplicacao) || 0;
      t.resgate += Number(r.resgate) || 0;
      t.rendimentos += Number(r.rendimentos) || 0;
      t.encargos += Number(r.encargos) || 0;
      t.rendimento_provisionado += Number(r.rendimento_provisionado) || 0;
    }
    return t;
  }, [visibleRows]);

  // Lista de meses para o seletor (12 meses ao redor + meses já cadastrados)
  const monthOptions = useMemo(() => {
    const set = new Set<string>(rows.map(r => r.month));
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort();
  }, [rows]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
        <PiggyBank className="w-4 h-4" /> Investimentos
      </h3>

      <div className="glass-card rounded-xl p-5 space-y-5">
        {/* Editor do mês */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Mês:</span>
            <Select value={editMonth} onValueChange={setEditMonth}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {monthOptions.map(m => (
                  <SelectItem key={m} value={m}>{m.split('-').reverse().join('/')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {existing ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FIELDS.map(f => (
              <div key={f.key as string}>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={String(form[f.key] ?? '')}
                  onChange={(e) => setForm({ ...form, [f.key]: parseBR(e.target.value) })}
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tabela com linhas existentes */}
        {visibleRows.length > 0 && (
          <div className="overflow-x-auto border-t border-border/30 pt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-2 pr-3">Mês</th>
                  {FIELDS.map(f => (
                    <th key={f.key as string} className="text-right py-2 px-2">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => (
                  <tr key={r.id} className="border-t border-border/20 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setEditMonth(r.month)}>
                    <td className="py-2 pr-3 font-medium">{r.month.split('-').reverse().join('/')}</td>
                    {FIELDS.map(f => (
                      <td key={f.key as string} className="text-right py-2 px-2 tabular-nums">
                        {formatCurrency(Number(r[f.key]) || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleRows.length > 1 && (
                  <tr className="border-t border-border/40 font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="text-right py-2 px-2">—</td>
                    <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.aplicacao)}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.resgate)}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.rendimentos)}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.encargos)}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(totals.rendimento_provisionado)}</td>
                    <td className="text-right py-2 px-2">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
