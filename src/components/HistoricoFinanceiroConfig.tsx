import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTypeClassifications, useFluxoTipos } from '@/hooks/useFinancialData';
import { motion } from 'framer-motion';
import { History, Upload, Plus, Trash2, Download, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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
  const [extraTipos, setExtraTipos] = useState<string[]>([]);
  const [newTipoInput, setNewTipoInput] = useState('');

  const { data: classifications = [] } = useTypeClassifications(schoolId);
  const { data: fluxoTipos = [] } = useFluxoTipos(schoolId);

  // Tipos disponíveis = base + classificações + tipos de fluxo (sem 'ignorar')
  const tipos = useMemo(() => {
    const base = ['receita', 'despesa', 'investimento'];
    const fromCls = classifications
      .filter(c => c.classificacao !== 'ignorar')
      .map(c => normalize(c.tipoValor));
    const fromFluxo = fluxoTipos.map(normalize);
    const all = Array.from(new Set([...base, ...fromCls, ...fromFluxo, ...extraTipos]));
    return all;
  }, [classifications, fluxoTipos, extraTipos]);

  const labelFor = (tipoKey: string) => {
    const cls = classifications.find(c => normalize(c.tipoValor) === tipoKey);
    if (cls?.label) return cls.label;
    return tipoKey
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

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

  // Adiciona tipos extras automaticamente se vierem do banco
  useEffect(() => {
    const seen = new Set(tipos);
    const novos = rows
      .map(r => normalize(r.tipo_valor))
      .filter(t => !seen.has(t));
    if (novos.length) setExtraTipos(prev => Array.from(new Set([...prev, ...novos])));
  }, [rows]); // eslint-disable-line

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
      onChanged?.();
    },
  });

  const handleCellBlur = async (year: number, monthIdx: number, tipoKey: string, raw: string) => {
    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
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

  const handleAddTipo = () => {
    const k = normalize(newTipoInput);
    if (!k) return;
    if (tipos.includes(k)) {
      toast.error('Esse tipo já existe na tabela');
      return;
    }
    setExtraTipos(prev => [...prev, k]);
    setNewTipoInput('');
    toast.success(`Tipo "${labelFor(k)}" adicionado`);
  };

  const handleRemoveTipo = async (tipoKey: string) => {
    const base = ['receita', 'despesa', 'investimento'];
    if (base.includes(tipoKey)) {
      toast.error('Tipos básicos não podem ser removidos');
      return;
    }
    if (!confirm(`Remover tipo "${labelFor(tipoKey)}"? Todos os valores históricos desse tipo serão apagados.`)) return;
    try {
      const { error } = await supabase
        .from('historical_monthly' as any)
        .delete()
        .eq('school_id', schoolId)
        .eq('tipo_valor', tipoKey);
      if (error) throw error;
      setExtraTipos(prev => prev.filter(t => t !== tipoKey));
      qc.invalidateQueries({ queryKey: ['historicalMonthly', schoolId] });
      toast.success('Tipo removido');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (!json.length) {
        toast.error('Arquivo vazio');
        return;
      }
      // Identifica coluna de mês
      const cols = Object.keys(json[0]);
      const monthCol = cols.find(c => normalize(c).match(/^(mes|m[eê]s|month|periodo|per[ií]odo)$/));
      if (!monthCol) {
        toast.error('Coluna "mês" (YYYY-MM) não encontrada');
        return;
      }
      const items: { month: string; tipo_valor: string; valor: number }[] = [];
      const novosTipos = new Set<string>();
      for (const row of json) {
        const monthRaw = String(row[monthCol] ?? '').trim();
        // Aceita YYYY-MM, MM/YYYY, ou data completa
        let month = '';
        if (/^\d{4}-\d{2}$/.test(monthRaw)) month = monthRaw;
        else if (/^\d{1,2}\/\d{4}$/.test(monthRaw)) {
          const [m, y] = monthRaw.split('/');
          month = `${y}-${m.padStart(2, '0')}`;
        } else {
          const d = new Date(monthRaw);
          if (!isNaN(d.getTime())) month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!month) continue;
        for (const c of cols) {
          if (c === monthCol) continue;
          const tipoKey = normalize(c);
          if (!tipoKey) continue;
          const valor = parseBRNumber(row[c]);
          if (valor === 0) continue;
          items.push({ month, tipo_valor: tipoKey, valor });
          if (!tipos.includes(tipoKey)) novosTipos.add(tipoKey);
        }
      }
      if (!items.length) {
        toast.error('Nenhum valor válido encontrado');
        return;
      }
      await bulkUpsertMut.mutateAsync(items);
      if (novosTipos.size) setExtraTipos(prev => Array.from(new Set([...prev, ...novosTipos])));
      toast.success(`${items.length} valores importados`);
      if (fileRef.current) fileRef.current.value = '';
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
    for (let y = yearsRange.start; y <= yearsRange.end; y++) arr.push(y);
    return arr;
  }, [yearsRange]);

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

        {/* Add tipo */}
        <div className="flex items-center gap-2 pt-3">
          <input
            value={newTipoInput}
            onChange={e => setNewTipoInput(e.target.value)}
            placeholder='Adicionar tipo (ex: "Pró-labore")'
            className="flex-1 h-8 text-sm border rounded px-2 bg-background"
            onKeyDown={e => e.key === 'Enter' && handleAddTipo()}
          />
          <Button size="sm" onClick={handleAddTipo}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>
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
                    <td colSpan={14} className="px-2 py-1.5 font-bold text-primary text-sm sticky left-0 bg-muted/40">
                      {year}
                    </td>
                  </tr>
                  {tipos.map(tipoKey => {
                    let totalRow = 0;
                    return (
                      <tr key={`${year}-${tipoKey}`} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="px-2 py-1 sticky left-0 bg-card hover:bg-muted/20 font-medium text-foreground flex items-center justify-between gap-1 z-10">
                          <span className="truncate" title={labelFor(tipoKey)}>{labelFor(tipoKey)}</span>
                          {!['receita', 'despesa', 'investimento'].includes(tipoKey) && (
                            <button
                              onClick={() => handleRemoveTipo(tipoKey)}
                              className="text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100 group-hover:opacity-100"
                              title="Remover tipo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                        {MONTH_LABELS.map((_, idx) => {
                          const month = `${year}-${String(idx + 1).padStart(2, '0')}`;
                          const v = valueMap.get(`${month}|${tipoKey}`) ?? 0;
                          totalRow += v;
                          return (
                            <td key={idx} className="px-0.5 py-0.5">
                              <CellInput
                                initial={v}
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
    </motion.div>
  );
}

function CellInput({ initial, onCommit }: { initial: number; onCommit: (raw: string) => void }) {
  const [val, setVal] = useState(initial ? formatBR(initial) : '');
  useEffect(() => {
    setVal(initial ? formatBR(initial) : '');
  }, [initial]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="w-full h-7 text-xs text-right tabular-nums border border-transparent hover:border-border focus:border-primary rounded px-1 bg-transparent focus:bg-background outline-none"
      placeholder="—"
    />
  );
}
