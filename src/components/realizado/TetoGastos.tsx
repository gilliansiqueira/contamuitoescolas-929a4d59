import { useMemo, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Target, Check, Pencil, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Returns current semester id, e.g. "2026-S1" or "2026-S2" */
function getCurrentSemester(date = new Date()): { id: string; label: string; startMonth: string; endMonth: string; year: number; half: 1 | 2 } {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const half = (m <= 6 ? 1 : 2) as 1 | 2;
  const id = `${y}-S${half}`;
  const label = half === 1 ? `1º Semestre ${y} (Jan–Jun)` : `2º Semestre ${y} (Jul–Dez)`;
  const startMonth = half === 1 ? `${y}-01` : `${y}-07`;
  const endMonth = half === 1 ? `${y}-06` : `${y}-12`;
  return { id, label, startMonth, endMonth, year: y, half };
}

function isInSemester(dateStr: string, year: number, half: 1 | 2): boolean {
  if (!dateStr || dateStr.length < 7) return false;
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(5, 7));
  if (y !== year) return false;
  return half === 1 ? m >= 1 && m <= 6 : m >= 7 && m <= 12;
}

function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}

interface CategoryRow {
  name: string;
  realizado: number;
  ceiling: number;
  saldo: number;
  pct: number;
  ceilingId: string | null;
}

export function TetoGastos({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const semester = useMemo(() => getCurrentSemester(), []);

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('realized_entries').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['chart_of_accounts', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('school_id', schoolId);
      if (error) throw error;
      return data;
    },
  });

  const { data: ceilings = [], isLoading: loadingCeilings } = useQuery({
    queryKey: ['expense_ceilings', schoolId, semester.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_ceilings')
        .select('*')
        .eq('school_id', schoolId)
        .eq('semester', semester.id);
      if (error) throw error;
      return data as { id: string; category_name: string; semester: string; ceiling: number }[];
    },
  });

  const saveCeiling = useMutation({
    mutationFn: async ({ category, value, existingId }: { category: string; value: number; existingId: string | null }) => {
      if (existingId) {
        const { error } = await supabase.from('expense_ceilings').update({ ceiling: value }).eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expense_ceilings').insert({
          school_id: schoolId,
          category_name: category,
          semester: semester.id,
          ceiling: value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_ceilings', schoolId, semester.id] });
      toast.success('Teto salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar teto'),
  });

  // Build group map (categoria filha -> grupo/categoria mãe)
  const contaGrupoMap = useMemo(() => {
    const map: Record<string, string> = {};
    contas.forEach(c => {
      if (c.nivel > 1) {
        map[normalizeStr(c.nome)] = c.grupo || 'Outros';
      }
    });
    return map;
  }, [contas]);

  // Aggregate realized expenses by categoria mãe in current semester
  const rows = useMemo<CategoryRow[]>(() => {
    const totals: Record<string, number> = {};
    entries.forEach(e => {
      if (!isInSemester(e.data || '', semester.year, semester.half)) return;
      const grupo = contaGrupoMap[normalizeStr(e.conta_nome || '')] || 'Outros';
      totals[grupo] = (totals[grupo] || 0) + Number(e.valor || 0);
    });

    // Also include categories that have a ceiling but no expenses yet
    ceilings.forEach(c => {
      if (!(c.category_name in totals)) totals[c.category_name] = 0;
    });

    const ceilingMap = new Map(ceilings.map(c => [c.category_name, c]));

    return Object.entries(totals)
      .map(([name, realizado]) => {
        const c = ceilingMap.get(name);
        const ceiling = Number(c?.ceiling || 0);
        const saldo = ceiling - realizado;
        const pct = ceiling > 0 ? (realizado / ceiling) * 100 : 0;
        return { name, realizado, ceiling, saldo, pct, ceilingId: c?.id || null };
      })
      .sort((a, b) => b.realizado - a.realizado);
  }, [entries, contaGrupoMap, ceilings, semester]);

  const totals = useMemo(() => {
    const tetoTotal = rows.reduce((s, r) => s + r.ceiling, 0);
    const gastoTotal = rows.reduce((s, r) => s + r.realizado, 0);
    const pct = tetoTotal > 0 ? (gastoTotal / tetoTotal) * 100 : 0;
    return { tetoTotal, gastoTotal, pct };
  }, [rows]);

  if (loadingEntries || loadingCeilings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Resumo */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl bg-gradient-to-br from-primary/5 via-card to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Teto de Gastos</h3>
                <p className="text-xs text-muted-foreground">{semester.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryItem label="Teto total do semestre" value={formatCurrency(totals.tetoTotal)} />
              <SummaryItem label="Gasto no semestre" value={formatCurrency(totals.gastoTotal)} />
              <SummaryItem
                label="% utilizado"
                value={totals.tetoTotal > 0 ? `${totals.pct.toFixed(1)}%` : '—'}
                tone={totals.pct > 100 ? 'danger' : totals.pct > 80 ? 'warning' : 'default'}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Cards por categoria */}
      {rows.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-16 text-center">
            <Target className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma despesa registrada neste semestre.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((row, idx) => (
            <CategoryCard
              key={row.name}
              row={row}
              index={idx}
              onSave={(value) => saveCeiling.mutate({ category: row.name, value, existingId: row.ceilingId })}
              saving={saveCeiling.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-amber-600 dark:text-amber-500' : 'text-foreground';
  return (
    <div className="rounded-xl bg-card/60 border border-border/50 p-4">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function CategoryCard({
  row,
  index,
  onSave,
  saving,
}: {
  row: CategoryRow;
  index: number;
  onSave: (value: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!editing) {
      setInput(row.ceiling > 0 ? row.ceiling.toString().replace('.', ',') : '');
    }
  }, [row.ceiling, editing]);

  const handleSave = useCallback(() => {
    const v = parseCurrencyInput(input);
    if (v < 0) {
      toast.error('Valor inválido');
      return;
    }
    onSave(v);
    setEditing(false);
  }, [input, onSave]);

  const hasCeiling = row.ceiling > 0;
  const overLimit = hasCeiling && row.realizado > row.ceiling;
  const fillPct = hasCeiling ? Math.min((row.realizado / row.ceiling) * 100, 100) : 0;
  const overPct = hasCeiling && row.realizado > row.ceiling ? ((row.realizado - row.ceiling) / row.ceiling) * 100 : 0;

  // Color: até 100% usa primary (verde-água do tema), acima usa destructive
  const fillColor = overLimit
    ? 'bg-destructive/80'
    : row.pct > 80
      ? 'bg-amber-400 dark:bg-amber-500'
      : 'bg-primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className="rounded-2xl hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h4 className="text-sm font-semibold text-foreground leading-tight">{row.name}</h4>
            {overLimit && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Acima do teto
              </span>
            )}
            {!overLimit && hasCeiling && row.pct > 80 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                Atenção
              </span>
            )}
          </div>

          {/* Barra horizontal */}
          <div className="mb-4">
            <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${fillColor}`}
              />
            </div>
            {hasCeiling && (
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                <span>{row.pct.toFixed(1)}% utilizado</span>
                {overLimit && <span className="text-destructive font-semibold">+{overPct.toFixed(0)}% acima</span>}
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
            <div>
              <p className="text-muted-foreground">Teto</p>
              <p className="font-semibold text-foreground">{hasCeiling ? formatCurrency(row.ceiling) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gasto</p>
              <p className="font-semibold text-foreground">{formatCurrency(row.realizado)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Saldo</p>
              <p className={`font-semibold ${row.saldo < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {hasCeiling ? formatCurrency(row.saldo) : '—'}
              </p>
            </div>
          </div>

          {/* Mensagem comportamental */}
          {!hasCeiling ? (
            <p className="text-xs text-muted-foreground italic mb-3">
              Defina um teto semestral para essa categoria
            </p>
          ) : overLimit ? (
            <p className="text-xs text-destructive font-medium mb-3">
              Você ultrapassou o limite em {formatCurrency(Math.abs(row.saldo))}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              Você ainda pode gastar <span className="font-semibold text-foreground">{formatCurrency(row.saldo)}</span> neste semestre
            </p>
          )}

          {/* Editor de teto */}
          {editing ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">R$</span>
              <Input
                autoFocus
                className="rounded-xl h-9"
                placeholder="0,00"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <Button size="sm" className="rounded-xl h-9" onClick={handleSave} disabled={saving}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="rounded-xl h-9" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl w-full"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {hasCeiling ? 'Editar teto' : 'Definir teto'}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
