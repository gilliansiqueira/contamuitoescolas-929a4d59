import { useMemo, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Check, Pencil, AlertTriangle, X, ChevronDown, ChevronRight, Unlink, Link2, Trash2, Eye, EyeOff, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePresentation } from '@/components/presentation-provider';

interface Props {
  schoolId: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

interface SemesterInfo { id: string; label: string; startMonth: string; endMonth: string; year: number; half: 1 | 2 }

function makeSemester(year: number, half: 1 | 2): SemesterInfo {
  const id = `${year}-S${half}`;
  const label = half === 1 ? `1º Semestre ${year} (Jan–Jun)` : `2º Semestre ${year} (Jul–Dez)`;
  const startMonth = half === 1 ? `${year}-01` : `${year}-07`;
  const endMonth = half === 1 ? `${year}-06` : `${year}-12`;
  return { id, label, startMonth, endMonth, year, half };
}

function getCurrentSemester(date = new Date()): SemesterInfo {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return makeSemester(y, (m <= 6 ? 1 : 2) as 1 | 2);
}

function parseSemesterId(id: string): SemesterInfo {
  const [ys, hs] = id.split('-S');
  return makeSemester(parseInt(ys, 10), (hs === '1' ? 1 : 2) as 1 | 2);
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

interface Ceiling {
  id: string;
  category_name: string;
  semester: string;
  ceiling: number;
  scope: 'group' | 'subcategory';
  parent_group: string | null;
}

interface SubRow {
  name: string;
  realizado: number;
  ceiling: number;
  ceilingId: string | null;
  detached: boolean; // has its own ceiling, excluded from parent
}

interface CategoryRow {
  name: string;
  realizado: number; // already excludes detached subs
  ceiling: number;
  saldo: number;
  pct: number;
  ceilingId: string | null;
  subs: SubRow[];
  isStandalone?: boolean; // true when this card represents a detached subcategory
  parentGroup?: string | null;
}

export function TetoGastos({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const semester = useMemo(() => getCurrentSemester(), []);
  const { isAdmin } = useAuth();
  const { isPresentationMode } = usePresentation();
  const canEdit = isAdmin && !isPresentationMode;

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['realized_entries', schoolId],
    queryFn: async () => {
      const { fetchAllRows } = await import('@/lib/fetchAll');
      return fetchAllRows<any>('realized_entries', q => q.eq('school_id', schoolId));
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
      return (data || []).map((c: any) => ({
        ...c,
        scope: c.scope || 'group',
        parent_group: c.parent_group || null,
      })) as Ceiling[];
    },
  });

  const saveCeiling = useMutation({
    mutationFn: async ({ category, value, existingId, scope, parentGroup }: { category: string; value: number; existingId: string | null; scope: 'group' | 'subcategory'; parentGroup: string | null }) => {
      if (existingId) {
        const { error } = await supabase.from('expense_ceilings').update({ ceiling: value, scope, parent_group: parentGroup }).eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expense_ceilings').insert({
          school_id: schoolId,
          category_name: category,
          semester: semester.id,
          ceiling: value,
          scope,
          parent_group: parentGroup,
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

  const removeCeiling = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_ceilings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_ceilings', schoolId, semester.id] });
      toast.success('Subcategoria revinculada à mãe');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
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

  // Aggregate realized expenses
  const rows = useMemo<CategoryRow[]>(() => {
    // Sub totals: parentGroup -> { subName -> total }
    const subTotals: Record<string, Record<string, number>> = {};
    entries.forEach(e => {
      if (!isInSemester(e.data || '', semester.year, semester.half)) return;
      const subName = e.conta_nome || 'Sem categoria';
      const grupo = contaGrupoMap[normalizeStr(subName)] || 'Outros';
      if (!subTotals[grupo]) subTotals[grupo] = {};
      subTotals[grupo][subName] = (subTotals[grupo][subName] || 0) + Number(e.valor || 0);
    });

    const groupCeilings = ceilings.filter(c => (c.scope || 'group') === 'group');
    const subCeilings = ceilings.filter(c => c.scope === 'subcategory');
    const subCeilingMap = new Map<string, Ceiling>();
    subCeilings.forEach(c => subCeilingMap.set(`${c.parent_group || ''}|${normalizeStr(c.category_name)}`, c));

    // Ensure groups with ceilings appear even without expenses
    groupCeilings.forEach(c => { if (!subTotals[c.category_name]) subTotals[c.category_name] = {}; });

    const groupCeilingMap = new Map(groupCeilings.map(c => [c.category_name, c]));

    const groupRows: CategoryRow[] = Object.entries(subTotals)
      .map(([groupName, subs]) => {
        const subRows: SubRow[] = Object.entries(subs)
          .map(([subName, total]) => {
            const sc = subCeilingMap.get(`${groupName}|${normalizeStr(subName)}`);
            return {
              name: subName,
              realizado: total,
              ceiling: Number(sc?.ceiling || 0),
              ceilingId: sc?.id || null,
              detached: !!sc,
            };
          })
          .sort((a, b) => b.realizado - a.realizado);

        // Parent group realizado excludes detached subs
        const realizado = subRows.filter(s => !s.detached).reduce((s, r) => s + r.realizado, 0);
        const gc = groupCeilingMap.get(groupName);
        const ceiling = Number(gc?.ceiling || 0);
        const saldo = ceiling - realizado;
        const pct = ceiling > 0 ? (realizado / ceiling) * 100 : 0;
        return { name: groupName, realizado, ceiling, saldo, pct, ceilingId: gc?.id || null, subs: subRows, isStandalone: false, parentGroup: null };
      });

    // Standalone cards for detached subcategories
    const standaloneRows: CategoryRow[] = [];
    groupRows.forEach(g => {
      g.subs.filter(s => s.detached).forEach(s => {
        const saldo = s.ceiling - s.realizado;
        const pct = s.ceiling > 0 ? (s.realizado / s.ceiling) * 100 : 0;
        standaloneRows.push({
          name: s.name,
          realizado: s.realizado,
          ceiling: s.ceiling,
          saldo,
          pct,
          ceilingId: s.ceilingId,
          subs: [],
          isStandalone: true,
          parentGroup: g.name,
        });
      });
    });

    return [...groupRows, ...standaloneRows].sort((a, b) => b.realizado - a.realizado);
  }, [entries, contaGrupoMap, ceilings, semester]);

  const totals = useMemo(() => {
    const tetoTotal = rows.reduce((s, r) => s + r.ceiling, 0);
    const gastoTotal = rows.reduce((s, r) => s + r.realizado, 0);
    const pct = tetoTotal > 0 ? (gastoTotal / tetoTotal) * 100 : 0;
    return { tetoTotal, gastoTotal, pct };
  }, [rows]);

  const [hideUnset, setHideUnset] = useState(false);
  const visibleRows = useMemo(() => hideUnset ? rows.filter(r => r.ceiling > 0) : rows, [rows, hideUnset]);
  const hiddenCount = rows.length - visibleRows.length;

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

      {rows.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-16 text-center">
            <Target className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma despesa registrada neste semestre.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              {hideUnset ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
              <Label htmlFor="hide-unset" className="text-xs text-muted-foreground cursor-pointer">
                Ocultar cards sem teto definido{hideUnset && hiddenCount > 0 ? ` (${hiddenCount} oculto${hiddenCount > 1 ? 's' : ''})` : ''}
              </Label>
            </div>
            <Switch id="hide-unset" checked={hideUnset} onCheckedChange={setHideUnset} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleRows.map((row, idx) => (
              <CategoryCard
                key={`${row.isStandalone ? 'sub' : 'grp'}:${row.parentGroup || ''}:${row.name}`}
                row={row}
                index={idx}
                onSaveGroup={(value) => saveCeiling.mutate({
                  category: row.name,
                  value,
                  existingId: row.ceilingId,
                  scope: row.isStandalone ? 'subcategory' : 'group',
                  parentGroup: row.isStandalone ? (row.parentGroup || null) : null,
                })}
                onSaveSub={(subName, value, existingId) => saveCeiling.mutate({ category: subName, value, existingId, scope: 'subcategory', parentGroup: row.name })}
                onRelinkSub={(id) => removeCeiling.mutate(id)}
                saving={saveCeiling.isPending || removeCeiling.isPending}
                canEdit={canEdit}
              />
            ))}
          </div>
        </>
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
  onSaveGroup,
  onSaveSub,
  onRelinkSub,
  saving,
  canEdit,
}: {
  row: CategoryRow;
  index: number;
  onSaveGroup: (value: number) => void;
  onSaveSub: (subName: string, value: number, existingId: string | null) => void;
  onRelinkSub: (id: string) => void;
  saving: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [showSubs, setShowSubs] = useState(false);

  useEffect(() => {
    if (!editing) setInput(row.ceiling > 0 ? row.ceiling.toString().replace('.', ',') : '');
  }, [row.ceiling, editing]);

  const handleSave = useCallback(() => {
    const v = parseCurrencyInput(input);
    if (v < 0) { toast.error('Valor inválido'); return; }
    onSaveGroup(v);
    setEditing(false);
  }, [input, onSaveGroup]);

  const hasCeiling = row.ceiling > 0;
  const overLimit = hasCeiling && row.realizado > row.ceiling;
  const fillPct = hasCeiling ? Math.min((row.realizado / row.ceiling) * 100, 100) : 0;

  const status: 'safe' | 'warn' | 'danger' = !hasCeiling
    ? 'safe'
    : row.pct > 90 ? 'danger' : row.pct > 70 ? 'warn' : 'safe';

  const colorMap = {
    safe: { fill: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-500', ring: 'ring-emerald-500/20', soft: 'bg-emerald-500/10' },
    warn: { fill: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-500', ring: 'ring-amber-500/20', soft: 'bg-amber-500/10' },
    danger: { fill: 'bg-destructive', text: 'text-destructive', ring: 'ring-destructive/20', soft: 'bg-destructive/10' },
  };
  const c = colorMap[status];

  const detachedSubs = row.subs.filter(s => s.detached);
  const linkedSubs = row.subs.filter(s => !s.detached);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Card className={`rounded-2xl hover:shadow-md transition-all ring-1 ${c.ring}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-foreground leading-tight">{row.name}</h4>
                {row.isStandalone && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <Unlink className="w-2.5 h-2.5" />
                    Subcategoria
                  </span>
                )}
              </div>
              {row.isStandalone && row.parentGroup && (
                <p className="text-[11px] text-muted-foreground mt-0.5">de {row.parentGroup}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && row.isStandalone && row.ceilingId && (
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive -mt-1" onClick={() => onRelinkSub(row.ceilingId!)} title="Revincular ao teto da mãe" disabled={saving}>
                  <Link2 className="w-3.5 h-3.5" />
                </Button>
              )}
              {canEdit && !editing && (
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground -mt-1 -mr-1" onClick={() => setEditing(true)} title={hasCeiling ? 'Editar teto' : 'Definir teto'}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            {hasCeiling ? (
              <>
                <span className={`text-4xl font-bold tracking-tight ${c.text}`}>{row.pct.toFixed(0)}%</span>
                <span className="text-xs text-muted-foreground font-medium">utilizado</span>
                {overLimit && (
                  <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${c.text} ${c.soft} px-2 py-0.5 rounded-full`}>
                    <AlertTriangle className="w-3 h-3" />
                    Acima do teto
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground italic">Sem teto definido</span>
            )}
          </div>

          <div className="mb-4">
            <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${fillPct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${c.fill}`} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Gasto" value={formatCurrency(row.realizado)} strong />
            <Stat label="Teto" value={hasCeiling ? formatCurrency(row.ceiling) : '—'} />
            <Stat label="Saldo" value={hasCeiling ? formatCurrency(row.saldo) : '—'} tone={row.saldo < 0 ? 'danger' : 'default'} />
          </div>

          {canEdit && editing && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/60">
              <span className="text-xs font-medium text-muted-foreground">R$</span>
              <Input autoFocus className="rounded-xl h-9" placeholder="0,00" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }} />
              <Button size="icon" className="rounded-xl h-9 w-9" onClick={handleSave} disabled={saving}><Check className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="rounded-xl h-9 w-9" onClick={() => setEditing(false)}><X className="w-4 h-4" /></Button>
            </div>
          )}

          {row.subs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <button onClick={() => setShowSubs(!showSubs)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                {showSubs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Subcategorias ({row.subs.length}){detachedSubs.length > 0 && ` · ${detachedSubs.length} com teto próprio`}
              </button>
              <AnimatePresence>
                {showSubs && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 space-y-2">
                      {linkedSubs.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mt-1">Vinculadas à mãe</p>
                      )}
                      {linkedSubs.map(s => (
                        <SubRowItem key={s.name} sub={s} canEdit={canEdit} onSaveSub={onSaveSub} onRelinkSub={onRelinkSub} saving={saving} />
                      ))}
                      {detachedSubs.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mt-3">Com teto individual</p>
                      )}
                      {detachedSubs.map(s => (
                        <SubRowItem key={s.name} sub={s} canEdit={canEdit} onSaveSub={onSaveSub} onRelinkSub={onRelinkSub} saving={saving} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SubRowItem({ sub, canEdit, onSaveSub, onRelinkSub, saving }: { sub: SubRow; canEdit: boolean; onSaveSub: (subName: string, value: number, existingId: string | null) => void; onRelinkSub: (id: string) => void; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!editing) setInput(sub.ceiling > 0 ? sub.ceiling.toString().replace('.', ',') : '');
  }, [sub.ceiling, editing]);

  const handleSave = () => {
    const v = parseCurrencyInput(input);
    if (v <= 0) { toast.error('Defina um valor maior que zero'); return; }
    onSaveSub(sub.name, v, sub.ceilingId);
    setEditing(false);
  };

  const pct = sub.ceiling > 0 ? (sub.realizado / sub.ceiling) * 100 : 0;
  const overLimit = sub.detached && sub.ceiling > 0 && sub.realizado > sub.ceiling;

  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{sub.name}</p>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            Gasto: <span className="font-medium text-foreground">{formatCurrency(sub.realizado)}</span>
            {sub.detached && sub.ceiling > 0 && (
              <> · Teto: <span className="font-medium text-foreground">{formatCurrency(sub.ceiling)}</span> · <span className={overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}>{pct.toFixed(0)}%</span></>
            )}
          </p>
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            {sub.detached ? (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setEditing(true)} title="Editar teto da subcategoria"><Pencil className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => sub.ceilingId && onRelinkSub(sub.ceilingId)} title="Revincular ao teto da mãe" disabled={saving}><Link2 className="w-3 h-3" /></Button>
              </>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setEditing(true)} title="Definir teto individual (desvincula da mãe)"><Unlink className="w-3 h-3" /></Button>
            )}
          </div>
        )}
      </div>
      {canEdit && editing && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[11px] text-muted-foreground">R$</span>
          <Input autoFocus className="rounded-lg h-8 text-xs" placeholder="0,00" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }} />
          <Button size="icon" className="rounded-lg h-8 w-8" onClick={handleSave} disabled={saving}><Check className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="rounded-lg h-8 w-8" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, strong, tone = 'default' }: { label: string; value: string; strong?: boolean; tone?: 'default' | 'danger' }) {
  const color = tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <div>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide font-medium">{label}</p>
      <p className={`${strong ? 'font-bold' : 'font-semibold'} ${color}`}>{value}</p>
    </div>
  );
}
