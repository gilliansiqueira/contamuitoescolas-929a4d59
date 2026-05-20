import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { History, Upload, Trash2, Download, Info, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { usePeriodClosures, useClosedMonths, useCloseMonths, useReopenMonth, type PeriodClosure } from '@/hooks/usePeriodClosures';
import { useAuth } from '@/hooks/useAuth';
import { fetchSchoolTemplateId, fetchTemplateItems, type FinancialModelTemplateItem } from '@/lib/financialModels';
import { normalizeTipo } from '@/lib/classificationUtils';

interface Props {
  schoolId: string;
  onChanged?: () => void;
}

interface HistoricalRow {
  id: string;
  school_id: string;
  month: string; // YYYY-MM
  tipo_valor: string;
  valor: number;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function parseBRNumber(raw: any): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/[R$\s]/g, '');
  // 1.500,50 → 1500.50
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

function formatBR(v: number): string {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, '_');
}

export function HistoricoFinanceiroConfig({ schoolId, onChanged }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [yearsRange, setYearsRange] = useState<{ start: number; end: number }>(() => {
    const y = new Date().getFullYear();
    return { start: y - 2, end: y };
  });
  // (Tipos vêm exclusivamente do modelo financeiro — sem estado local de tipos extras)
  const hiddenYearsStorageKey = `historicoFinanceiro:hiddenYears:${schoolId || 'none'}`;
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`historicoFinanceiro:hiddenYears:${schoolId || 'none'}`);
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch {}
    return new Set();
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(hiddenYearsStorageKey);
      setHiddenYears(raw ? new Set(JSON.parse(raw) as number[]) : new Set());
    } catch {
      setHiddenYears(new Set());
    }
  }, [hiddenYearsStorageKey]);

  // Fechamento de períodos (módulo projeção)
  const { isAdmin } = useAuth();
  const closedMonths = useClosedMonths(schoolId, 'projecao');
  const { data: closuresProj = [] } = usePeriodClosures(schoolId, 'projecao');
  const closeMut = useCloseMonths(schoolId, 'projecao');
  const reopenMut = useReopenMonth(schoolId, 'projecao');
  const closureMap = useMemo(() => {
    const m = new Map<string, PeriodClosure>();
    closuresProj.filter(c => c.status === 'closed').forEach(c => m.set(c.month, c));
    return m;
  }, [closuresProj]);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<PeriodClosure | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const handleCloseMonth = async (month: string) => {
    try {
      await closeMut.mutateAsync([month]);
      toast.success(`Mês ${month} fechado.`);
      setConfirmClose(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao fechar mês');
    }
  };

  const handleReopenMonth = async () => {
    if (!reopenTarget) return;
    try {
      await reopenMut.mutateAsync({
        closureId: reopenTarget.id,
        month: reopenTarget.month,
        reason: reopenReason.trim(),
      });
      toast.success(`Mês ${reopenTarget.month} reaberto.`);
      setReopenTarget(null);
      setReopenReason('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reabrir mês');
    }
  };


  // ===== Tipos vêm EXCLUSIVAMENTE do Modelo Financeiro aplicado à escola =====
  const { data: templateId } = useQuery({
    queryKey: ['schoolTemplateId', schoolId],
    queryFn: () => fetchSchoolTemplateId(schoolId),
    enabled: !!schoolId,
  });
  const { data: templateItems = [] } = useQuery({
    queryKey: ['templateItems', templateId],
    queryFn: () => fetchTemplateItems(templateId!),
    enabled: !!templateId,
  });

  // Itens do modelo, sem 'ignorar', deduplicados por tipo_valor normalizado, ordenados.
  const modelItems = useMemo<FinancialModelTemplateItem[]>(() => {
    const seen = new Set<string>();
    const out: FinancialModelTemplateItem[] = [];
    [...templateItems]
      .filter(it => it.tipo !== 'ignorar')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .forEach(it => {
        const key = normalizeTipo(it.name);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(it);
      });
    return out;
  }, [templateItems]);

  const tipos = useMemo(() => modelItems.map(it => normalizeTipo(it.name)), [modelItems]);
  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    modelItems.forEach(it => m.set(normalizeTipo(it.name), it.name));
    return m;
  }, [modelItems]);
  const labelFor = (tipoKey: string) =>
    labelByKey.get(tipoKey) ??
    tipoKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['historicalMonthly', schoolId],
    queryFn: async (): Promise<HistoricalRow[]> => {
      const { data, error } = await supabase
        .from('historical_monthly' as any)
        .select('*')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!schoolId,
  });

  // Detecta meses que possuem upload de fluxo — nesses meses o histórico
  // é IGNORADO no Dashboard (upload tem prioridade). Apenas avisa o usuário.
  const { data: uploadMonths = new Set<string>() } = useQuery({
    queryKey: ['fluxoUploadMonths', schoolId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('financial_entries')
        .select('data')
        .eq('school_id', schoolId)
        .eq('origem', 'fluxo');
      if (error) throw error;
      const s = new Set<string>();
      (data ?? []).forEach((e: any) => { if (e.data) s.add(e.data.slice(0, 7)); });
      return s;
    },
    enabled: !!schoolId,
  });

  // Mapa: month|tipo → valor
  const valueMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(`${r.month}|${normalize(r.tipo_valor)}`, Number(r.valor));
    return m;
  }, [rows]);

  // (removido auto-add de tipos extras — agora o modelo é a única fonte)

  const upsertMut = useMutation({
    mutationFn: async (payload: { month: string; tipo_valor: string; valor: number }) => {
      const { error } = await supabase
        .from('historical_monthly' as any)
        .upsert(
          {
            school_id: schoolId,
            month: payload.month,
            tipo_valor: payload.tipo_valor,
            valor: payload.valor,
          },
          { onConflict: 'school_id,month,tipo_valor' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['historicalMonthly', schoolId] });
      qc.invalidateQueries({ queryKey: ['availableMonths', schoolId] });
      qc.invalidateQueries({ queryKey: ['fluxoTipos', schoolId] });
      onChanged?.();
    },
  });

  const bulkUpsertMut = useMutation({
    mutationFn: async (items: { month: string; tipo_valor: string; valor: number }[]) => {
      // Faz em lotes de 200
      const payload = items.map(i => ({
        school_id: schoolId,
        month: i.month,
        tipo_valor: i.tipo_valor,
        valor: i.valor,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const slice = payload.slice(i, i + 200);
        const { error } = await supabase
          .from('historical_monthly' as any)
          .upsert(slice, { onConflict: 'school_id,month,tipo_valor' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['historicalMonthly', schoolId] });
      qc.invalidateQueries({ queryKey: ['availableMonths', schoolId] });
      qc.invalidateQueries({ queryKey: ['fluxoTipos', schoolId] });
      onChanged?.();
    },
  });

  const deleteMonthTypeMut = useMutation({
    mutationFn: async ({ month, tipo_valor }: { month: string; tipo_valor: string }) => {
      const { error } = await supabase
        .from('historical_monthly' as any)
        .delete()
        .eq('school_id', schoolId)
        .eq('month', month)
        .eq('tipo_valor', tipo_valor);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['historicalMonthly', schoolId] });
      qc.invalidateQueries({ queryKey: ['availableMonths', schoolId] });
      qc.invalidateQueries({ queryKey: ['fluxoTipos', schoolId] });
      onChanged?.();
    },
  });

  const handleCellBlur = async (year: number, monthIdx: number, tipoKey: string, raw: string) => {
    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    if (closedMonths.has(month) && !isAdmin) {
      toast.error(`Mês ${month} está fechado. Reabra antes de editar.`);
      return;
    }
    const valor = parseBRNumber(raw);
    const key = `${month}|${tipoKey}`;
    const prev = valueMap.get(key) ?? 0;
    if (valor === prev) return;
    try {
      if (valor === 0) {
        await deleteMonthTypeMut.mutateAsync({ month, tipo_valor: tipoKey });
      } else {
        await upsertMut.mutateAsync({ month, tipo_valor: tipoKey, valor });
      }
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
  };

  // (handleAddTipo / handleRemoveTipo removidos — modelo financeiro é a base)


  const handleRemoveYear = async (year: number) => {
    if (!confirm(`Remover TODOS os valores do ano ${year}? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase
        .from('historical_monthly' as any)
        .delete()
        .eq('school_id', schoolId)
        .gte('month', `${year}-01`)
        .lte('month', `${year}-12`);
      if (error) throw error;
      setHiddenYears(prev => {
        const next = new Set(prev);
        next.add(year);
        try { localStorage.setItem(hiddenYearsStorageKey, JSON.stringify([...next])); } catch {}
        return next;
      });
      qc.invalidateQueries({ queryKey: ['historicalMonthly', schoolId] });
      qc.invalidateQueries({ queryKey: ['availableMonths', schoolId] });
      qc.invalidateQueries({ queryKey: ['fluxoTipos', schoolId] });
      onChanged?.();
      toast.success(`Ano ${year} removido`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [importPreview, setImportPreview] = useState<null | {
    items: { month: string; tipo_valor: string; valor: number }[];
    novosTipos: string[];
    errors: string[];
    warnings: string[];
    skippedRows: number;
    totalRows: number;
    months: string[];
    years: number[];
    byTipo: Record<string, { count: number; total: number }>;
    conflicts: string[]; // meses já com upload de fluxo
    closedHit: string[]; // meses fechados
  }>(null);

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (fileRef.current) fileRef.current.value = '';
      if (!json.length) {
        toast.error('Arquivo vazio');
        return;
      }
      const cols = Object.keys(json[0]);
      const monthCol = cols.find(c => normalize(c).match(/^(mes|m[eê]s|month|periodo|per[ií]odo)$/));
      if (!monthCol) {
        toast.error('Coluna "mês" (YYYY-MM) não encontrada no arquivo');
        return;
      }
      const items: { month: string; tipo_valor: string; valor: number }[] = [];
      const novosTipos = new Set<string>();
      const errors: string[] = [];
      const warnings: string[] = [];
      const monthsSet = new Set<string>();
      const yearsSet = new Set<number>();
      const byTipo: Record<string, { count: number; total: number }> = {};
      let skipped = 0;
      json.forEach((row, idx) => {
        const monthRaw = String(row[monthCol] ?? '').trim();
        let month = '';
        if (/^\d{4}-\d{2}$/.test(monthRaw)) month = monthRaw;
        else if (/^\d{1,2}\/\d{4}$/.test(monthRaw)) {
          const [m, y] = monthRaw.split('/');
          month = `${y}-${m.padStart(2, '0')}`;
        } else if (monthRaw) {
          const d = new Date(monthRaw);
          if (!isNaN(d.getTime())) month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!month) {
          skipped++;
          if (errors.length < 5) errors.push(`Linha ${idx + 2}: mês inválido ("${monthRaw}")`);
          return;
        }
        monthsSet.add(month);
        yearsSet.add(Number(month.slice(0, 4)));
        let rowHasValue = false;
        for (const c of cols) {
          if (c === monthCol) continue;
          const tipoKey = normalize(c);
          if (!tipoKey) continue;
          const valor = parseBRNumber(row[c]);
          if (valor === 0) continue;
          // Tipo precisa existir no modelo financeiro da escola
          if (!tipos.includes(tipoKey)) {
            novosTipos.add(tipoKey); // reaproveitado: lista de rejeitados (fora do modelo)
            continue;
          }
          if (Math.abs(valor) > 100_000_000) {
            warnings.push(`Linha ${idx + 2} (${c}): valor muito alto (${formatBR(valor)})`);
          }
          items.push({ month, tipo_valor: tipoKey, valor });
          rowHasValue = true;
          const agg = byTipo[tipoKey] || { count: 0, total: 0 };
          agg.count++;
          agg.total += valor;
          byTipo[tipoKey] = agg;
        }
        if (!rowHasValue) skipped++;
      });


      const months = Array.from(monthsSet).sort();
      const conflicts = months.filter(m => uploadMonths.has(m));
      const closedHit = months.filter(m => closedMonths.has(m));

      if (!items.length) {
        toast.error('Nenhum valor válido encontrado no arquivo');
        return;
      }

      setImportPreview({
        items,
        novosTipos: Array.from(novosTipos),
        errors,
        warnings: warnings.slice(0, 10),
        skippedRows: skipped,
        totalRows: json.length,
        months,
        years: Array.from(yearsSet).sort(),
        byTipo,
        conflicts,
        closedHit,
      });
    } catch (e: any) {
      toast.error('Erro ao ler arquivo: ' + e.message);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    try {
      await bulkUpsertMut.mutateAsync(importPreview.items);
      if (importPreview.novosTipos.length) {
        toast.warning(
          `${importPreview.novosTipos.length} tipo(s) ignorado(s) por não estarem no modelo: ${importPreview.novosTipos.join(', ')}`
        );
      }
      // Expande intervalo de anos e desoculta anos importados
      if (importPreview.years.length) {
        const minY = Math.min(...importPreview.years);
        const maxY = Math.max(...importPreview.years);
        setYearsRange(r => ({ start: Math.min(r.start, minY), end: Math.max(r.end, maxY) }));
        setHiddenYears(prev => {
          const next = new Set(prev);
          importPreview.years.forEach(y => next.delete(y));
          try { localStorage.setItem(hiddenYearsStorageKey, JSON.stringify([...next])); } catch {}
          return next;
        });
      }
      toast.success(`${importPreview.items.length} valores importados`);
      setImportPreview(null);
    } catch (e: any) {
      toast.error('Erro ao importar: ' + e.message);
    }
  };

  const handleExportTemplate = () => {
    const header = ['mes', ...tipos.map(labelFor)];
    const sample = [`${yearsRange.end}-01`, ...tipos.map(() => 0)];
    const ws = XLSX.utils.aoa_to_sheet([header, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, 'modelo_historico_financeiro.xlsx');
  };

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = yearsRange.start; y <= yearsRange.end; y++) {
      if (!hiddenYears.has(y)) arr.push(y);
    }
    return arr;
  }, [yearsRange, hiddenYears]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Histórico Financeiro Mensal</h3>
        </div>
        <div className="flex items-start gap-2 mb-3 bg-muted/30 rounded-lg p-3">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Registre valores mensais consolidados (sem detalhe diário) por tipo. Útil para anos de histórico antigo,
            evitando importar lançamento a lançamento. <strong>Atenção:</strong> meses que possuem upload de Fluxo de
            Caixa ignoram o histórico — o upload sempre tem prioridade no Dashboard. Edite cada célula clicando nela;
            salva automaticamente ao sair do campo.
          </p>
        </div>

        {/* Aviso de conflito Histórico × Upload */}
        {(() => {
          const conflicts = Array.from(uploadMonths).filter(m =>
            rows.some(r => r.month === m)
          ).sort();
          if (conflicts.length === 0) return null;
          return (
            <div className="flex items-start gap-2 mb-4 rounded-lg p-3 border border-warning/40 bg-warning/10">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold text-foreground mb-0.5">
                  {conflicts.length} {conflicts.length === 1 ? 'mês com conflito' : 'meses com conflito'}: histórico será ignorado
                </p>
                <p className="text-muted-foreground">
                  Estes meses já possuem dados de upload e o histórico não será considerado no Dashboard:{' '}
                  <span className="font-medium text-foreground">
                    {conflicts.map(m => m.split('-').reverse().join('/')).join(', ')}
                  </span>
                </p>
              </div>
            </div>
          );
        })()}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">De</label>
            <input
              type="number"
              value={yearsRange.start}
              onChange={e => setYearsRange(r => ({ ...r, start: Number(e.target.value) }))}
              className="w-24 h-8 text-sm border rounded px-2 bg-background"
            />
            <label className="text-xs text-muted-foreground">até</label>
            <input
              type="number"
              value={yearsRange.end}
              onChange={e => setYearsRange(r => ({ ...r, end: Number(e.target.value) }))}
              className="w-24 h-8 text-sm border rounded px-2 bg-background"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Importar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleExportTemplate}>
              <Download className="w-3.5 h-3.5 mr-1" /> Modelo
            </Button>
          </div>
        </div>

        {/* Aviso: tipos vêm do modelo */}
        <div className="flex items-start gap-2 pt-3">
          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Os tipos exibidos são definidos pelo <strong>Modelo Financeiro</strong> aplicado à escola.
            Para adicionar ou remover tipos, edite o modelo em <em>Configurações → Modelos Financeiros</em>.
          </p>
        </div>

        {!templateId && (
          <div className="flex items-start gap-2 mt-2 rounded-lg p-3 border border-warning/40 bg-warning/10">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">
              Nenhum modelo financeiro foi aplicado a esta escola. Aplique um modelo em
              <em> Configurações → Modelo da Empresa</em> para liberar os tipos.
            </p>
          </div>
        )}
      </div>


      {/* Tabela ano × mês */}
      <div className="glass-card rounded-xl p-2 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground sticky left-0 bg-card z-10">
                  Tipo / Ano
                </th>
                {MONTH_LABELS.map(m => (
                  <th key={m} className="px-1 py-2 text-center font-semibold text-muted-foreground min-w-[80px]">
                    {m}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map(year => (
                <>
                  <tr key={`year-${year}`} className="bg-muted/40">
                    <td className="px-2 py-1.5 font-bold text-primary text-sm sticky left-0 bg-muted/40 z-10">
                      <div className="flex items-center justify-between gap-1">
                        <span>{year}</span>
                        <button
                          onClick={() => handleRemoveYear(year)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title={`Remover todos os valores de ${year}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    {MONTH_LABELS.map((_, idx) => {
                      const month = `${year}-${String(idx + 1).padStart(2, '0')}`;
                      const closure = closureMap.get(month);
                      const isClosed = !!closure;
                      return (
                        <td key={`act-${month}`} className="px-0.5 py-0.5 text-center">
                          {isClosed ? (
                            <button
                              type="button"
                              onClick={() => isAdmin && setReopenTarget(closure)}
                              disabled={!isAdmin}
                              title={isAdmin ? 'Mês fechado — clique para reabrir' : 'Mês fechado'}
                              className="inline-flex items-center justify-center gap-1 h-6 px-1.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border hover:bg-muted/70 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              <Lock className="w-3 h-3" /> Fechado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmClose(month)}
                              title={`Fechar ${month}`}
                              className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Lock className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 bg-muted/40" />
                  </tr>
                  {tipos.map(tipoKey => {
                    let totalRow = 0;
                    return (
                      <tr key={`${year}-${tipoKey}`} className="border-b border-border/30 hover:bg-muted/20 group">
                        <td className="px-2 py-1 sticky left-0 bg-card hover:bg-muted/20 font-medium text-foreground z-10">
                          <span className="truncate block" title={labelFor(tipoKey)}>{labelFor(tipoKey)}</span>
                        </td>
                        {MONTH_LABELS.map((_, idx) => {
                          const month = `${year}-${String(idx + 1).padStart(2, '0')}`;
                          const v = valueMap.get(`${month}|${tipoKey}`) ?? 0;
                          totalRow += v;
                          const isClosed = closedMonths.has(month) && !isAdmin;
                          return (
                            <td key={idx} className={`px-0.5 py-0.5 ${closedMonths.has(month) ? 'bg-muted/30' : ''}`}>
                              <CellInput
                                initial={v}
                                disabled={isClosed}
                                onCommit={raw => handleCellBlur(year, idx, tipoKey, raw)}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 text-right font-semibold text-foreground tabular-nums">
                          {totalRow ? formatBR(totalRow) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmar fechamento */}
      <AlertDialog open={!!confirmClose} onOpenChange={o => !o && setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Fechar mês {confirmClose}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Após o fechamento, todos os valores deste mês na Projeção (Histórico, lançamentos, vendas, conversão)
              ficarão bloqueados para edição. Apenas administradores poderão reabrir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => confirmClose && handleCloseMonth(confirmClose)}
              disabled={closeMut.isPending}
            >
              Fechar período
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reabrir */}
      <AlertDialog open={!!reopenTarget} onOpenChange={o => { if (!o) { setReopenTarget(null); setReopenReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-primary" />
              Reabrir {reopenTarget?.month}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da reabertura (será registrado em auditoria).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            placeholder="Ex.: Correção de lançamento errado"
            className="rounded-xl"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={handleReopenMonth} disabled={reopenMut.isPending}>
              Reabrir mês
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview de importação */}
      <AlertDialog open={!!importPreview} onOpenChange={o => !o && setImportPreview(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Revisar importação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {importPreview && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-muted/40 rounded p-2">
                        <div className="text-muted-foreground">Linhas no arquivo</div>
                        <div className="font-bold text-foreground text-base">{importPreview.totalRows}</div>
                      </div>
                      <div className="bg-muted/40 rounded p-2">
                        <div className="text-muted-foreground">Valores a salvar</div>
                        <div className="font-bold text-primary text-base">{importPreview.items.length}</div>
                      </div>
                      <div className="bg-muted/40 rounded p-2">
                        <div className="text-muted-foreground">Linhas ignoradas</div>
                        <div className="font-bold text-foreground text-base">{importPreview.skippedRows}</div>
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="text-muted-foreground">Período: </span>
                      <span className="font-medium text-foreground">
                        {importPreview.months[0]} → {importPreview.months[importPreview.months.length - 1]}
                      </span>
                      {' • '}
                      <span className="text-muted-foreground">Anos: </span>
                      <span className="font-medium text-foreground">{importPreview.years.join(', ')}</span>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1">Tipo</th>
                            <th className="text-right px-2 py-1">Qtd</th>
                            <th className="text-right px-2 py-1">Total</th>
                            <th className="text-center px-2 py-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(importPreview.byTipo).map(([k, v]) => (
                            <tr key={k} className="border-t border-border/40">
                              <td className="px-2 py-1 font-medium">{labelFor(k)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{v.count}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{formatBR(v.total)}</td>
                              <td className="px-2 py-1 text-center">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">no modelo</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {importPreview.novosTipos.length > 0 && (
                      <div className="rounded p-2 border border-warning/40 bg-warning/10 text-xs">
                        <div className="font-semibold text-foreground mb-1">
                          {importPreview.novosTipos.length} tipo(s) ignorado(s) (não estão no modelo financeiro):
                        </div>
                        <div className="text-muted-foreground">{importPreview.novosTipos.join(', ')}</div>
                      </div>
                    )}

                    {importPreview.errors.length > 0 && (
                      <div className="rounded p-2 border border-destructive/40 bg-destructive/10 text-xs">
                        <div className="font-semibold text-destructive mb-1">Erros ({importPreview.errors.length}):</div>
                        <ul className="list-disc list-inside text-foreground space-y-0.5">
                          {importPreview.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}

                    {importPreview.warnings.length > 0 && (
                      <div className="rounded p-2 border border-warning/40 bg-warning/10 text-xs">
                        <div className="font-semibold text-foreground mb-1">Avisos:</div>
                        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                          {importPreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}

                    {importPreview.conflicts.length > 0 && (
                      <div className="rounded p-2 border border-warning/40 bg-warning/10 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-warning" />
                        <span className="text-foreground">
                          {importPreview.conflicts.length} mês(es) já têm upload de Fluxo e serão <strong>ignorados</strong> no Dashboard: {importPreview.conflicts.join(', ')}
                        </span>
                      </div>
                    )}

                    {importPreview.closedHit.length > 0 && (
                      <div className="rounded p-2 border border-destructive/40 bg-destructive/10 text-xs">
                        <Lock className="w-3.5 h-3.5 inline mr-1 text-destructive" />
                        <span className="text-foreground">
                          {importPreview.closedHit.length} mês(es) estão <strong>fechados</strong>: {importPreview.closedHit.join(', ')}. A gravação será bloqueada {isAdmin ? '(você é admin, será permitido)' : '— reabra antes de importar'}.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={confirmImport}
              disabled={bulkUpsertMut.isPending || (importPreview?.closedHit.length ? !isAdmin : false)}
            >
              {bulkUpsertMut.isPending ? 'Salvando...' : `Confirmar e salvar (${importPreview?.items.length ?? 0})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function CellInput({ initial, onCommit, disabled = false }: { initial: number; onCommit: (raw: string) => void; disabled?: boolean }) {
  const [val, setVal] = useState(initial ? formatBR(initial) : '');
  useEffect(() => {
    setVal(initial ? formatBR(initial) : '');
  }, [initial]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      disabled={disabled}
      onChange={e => setVal(e.target.value)}
      onBlur={() => !disabled && onCommit(val)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`w-full h-7 text-xs text-right tabular-nums border border-transparent rounded px-1 bg-transparent outline-none ${
        disabled
          ? 'cursor-not-allowed text-muted-foreground'
          : 'hover:border-border focus:border-primary focus:bg-background'
      }`}
      placeholder={disabled ? '🔒' : '—'}
    />
  );
}
