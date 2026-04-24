import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Upload, Save, Image, Copy, FileDown, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { KpiDefinitionWithThresholds, KpiIcon } from './types';
import { useKpiMutations } from './useKpiData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  definitions: KpiDefinitionWithThresholds[];
  icons: KpiIcon[];
}

export function KpiConfigDrawer({ open, onOpenChange, schoolId, definitions, icons }: Props) {
  const mutations = useKpiMutations(schoolId);
  const [activeTab, setActiveTab] = useState('indicadores');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Configuração de Indicadores</SheetTitle>
        </SheetHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 mb-3">
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="valores">Valores</TabsTrigger>
            <TabsTrigger value="icones">Ícones</TabsTrigger>
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="indicadores" className="mt-0">
              <IndicadoresTab definitions={definitions} icons={icons} schoolId={schoolId} mutations={mutations} />
            </TabsContent>
            <TabsContent value="valores" className="mt-0">
              <ValoresTab definitions={definitions} schoolId={schoolId} mutations={mutations} />
            </TabsContent>
            <TabsContent value="icones" className="mt-0">
              <IconesTab icons={icons} schoolId={schoolId} mutations={mutations} />
            </TabsContent>
            <TabsContent value="modelos" className="mt-0">
              <ModelosTab schoolId={schoolId} mutations={mutations} definitions={definitions} icons={icons} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Indicadores Tab ─── */
function IndicadoresTab({ definitions, icons, schoolId, mutations }: {
  definitions: KpiDefinitionWithThresholds[];
  icons: KpiIcon[];
  schoolId: string;
  mutations: ReturnType<typeof useKpiMutations>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [thresholds, setThresholds] = useState<any[]>([]);

  const startEdit = (def: KpiDefinitionWithThresholds) => {
    setEditing(def.id);
    setForm({ name: def.name, icon_id: def.icon_id || '', value_type: def.value_type, direction: def.direction });
    setThresholds(def.thresholds.map(t => ({ min_value: t.min_value ?? '', max_value: t.max_value ?? '', color: t.color, label: t.label })));
  };

  const startNew = () => {
    setEditing('new');
    setForm({ name: '', icon_id: '', value_type: 'percent', direction: 'higher_is_better' });
    setThresholds([]);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    try {
      const defPayload: any = {
        name: form.name,
        icon_id: form.icon_id || null,
        value_type: form.value_type,
        direction: form.direction,
        sort_order: definitions.length,
      };
      if (editing !== 'new') defPayload.id = editing;
      else defPayload.school_id = schoolId;

      await mutations.saveDefinition.mutateAsync(defPayload);

      if (editing !== 'new' && thresholds.length >= 0) {
        await mutations.saveThresholds.mutateAsync({
          kpiId: editing!,
          thresholds: thresholds.map((t, i) => ({
            min_value: t.min_value === '' ? null : Number(t.min_value),
            max_value: t.max_value === '' ? null : Number(t.max_value),
            color: t.color,
            label: t.label,
            sort_order: i,
          })),
        });
      }
      toast.success('Indicador salvo!');
      setEditing(null);
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const handleToggle = async (def: KpiDefinitionWithThresholds) => {
    await mutations.saveDefinition.mutateAsync({ id: def.id, enabled: !def.enabled });
  };

  if (editing) {
    return (
      <div className="space-y-4 p-1">
        <div>
          <Label>Nome do Indicador</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Ícone</Label>
          <Select value={form.icon_id} onValueChange={v => setForm({ ...form, icon_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar ícone" /></SelectTrigger>
            <SelectContent>
              {icons.map(ic => (
                <SelectItem key={ic.id} value={ic.id}>
                  <div className="flex items-center gap-2">
                    <img src={ic.file_url} alt={ic.name} className="w-5 h-5 object-contain" />
                    {ic.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo de valor</Label>
            <Select value={form.value_type} onValueChange={v => setForm({ ...form, value_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentual (%)</SelectItem>
                <SelectItem value="currency">Moeda (R$)</SelectItem>
                <SelectItem value="number">Número</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direção</Label>
            <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">Maior = melhor</SelectItem>
                <SelectItem value="lower_is_better">Menor = melhor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Thresholds */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Faixas de desempenho</Label>
            <Button size="sm" variant="ghost" onClick={() => setThresholds([...thresholds, { min_value: '', max_value: '', color: '#22c55e', label: '' }])}>
              <Plus className="w-3 h-3 mr-1" /> Faixa
            </Button>
          </div>
          <div className="space-y-2">
            {thresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Input placeholder="Mín" type="number" value={t.min_value}
                  onChange={e => { const n = [...thresholds]; n[i] = { ...t, min_value: e.target.value }; setThresholds(n); }}
                  className="w-16 h-7 text-xs" />
                <span className="text-xs text-muted-foreground">a</span>
                <Input placeholder="Máx" type="number" value={t.max_value}
                  onChange={e => { const n = [...thresholds]; n[i] = { ...t, max_value: e.target.value }; setThresholds(n); }}
                  className="w-16 h-7 text-xs" />
                <input type="color" value={t.color.startsWith('hsl') ? '#22c55e' : t.color}
                  onChange={e => { const n = [...thresholds]; n[i] = { ...t, color: e.target.value }; setThresholds(n); }}
                  className="w-7 h-7 rounded border-0 cursor-pointer" />
                <Input placeholder="Rótulo" value={t.label}
                  onChange={e => { const n = [...thresholds]; n[i] = { ...t, label: e.target.value }; setThresholds(n); }}
                  className="flex-1 h-7 text-xs" />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setThresholds(thresholds.filter((_, j) => j !== i))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={mutations.saveDefinition.isPending}>
            <Save className="w-3.5 h-3.5 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-1">
      <Button size="sm" onClick={startNew}><Plus className="w-3.5 h-3.5 mr-1" /> Novo indicador</Button>
      {definitions.map(def => (
        <div key={def.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
          <Checkbox checked={def.enabled} onCheckedChange={() => handleToggle(def)} />
          {def.icon?.file_url && <img src={def.icon.file_url} alt={def.name} className="w-8 h-8 object-contain" />}
          <div className="flex-1">
            <p className="text-sm font-medium">{def.name}</p>
            <p className="text-xs text-muted-foreground">
              {def.value_type === 'percent' ? '%' : def.value_type === 'currency' ? 'R$' : '#'} · {def.direction === 'higher_is_better' ? '↑ melhor' : '↓ melhor'} · {def.thresholds.length} faixas
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => startEdit(def)}>Editar</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Excluir este indicador?')) mutations.deleteDefinition.mutate(def.id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      {!definitions.length && <p className="text-sm text-muted-foreground text-center py-8">Nenhum indicador configurado. Clique em "Novo indicador" para começar.</p>}
    </div>
  );
}

/* ─── Valores Tab (tabela editável por ano/mês) ─── */
const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function ValoresTab({ definitions, schoolId, mutations }: {
  definitions: KpiDefinitionWithThresholds[];
  schoolId: string;
  mutations: ReturnType<typeof useKpiMutations>;
}) {
  const enabledDefs = definitions.filter(d => d.enabled);
  const [selectedKpi, setSelectedKpi] = useState(enabledDefs[0]?.id || '');

  // Fetch all values for this school
  const { data: allValues = [] } = useQuery({
    queryKey: ['kpi_values', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_values').select('*').eq('school_id', schoolId);
      return (data || []) as { id: string; kpi_definition_id: string; month: string; value: number }[];
    },
  });

  const kpiValues = useMemo(() => allValues.filter(v => v.kpi_definition_id === selectedKpi), [allValues, selectedKpi]);

  // Compute years: current year + any historical years from data
  const years = useMemo(() => {
    const yrs = new Set<number>();
    yrs.add(new Date().getFullYear());
    kpiValues.forEach(v => yrs.add(parseInt(v.month.split('-')[0])));
    return Array.from(yrs).sort();
  }, [kpiValues]);

  const [addYear, setAddYear] = useState('');

  const allYears = useMemo(() => {
    const yrs = new Set(years);
    if (addYear && !isNaN(parseInt(addYear))) yrs.add(parseInt(addYear));
    return Array.from(yrs).sort();
  }, [years, addYear]);

  // Get value for a specific year-month
  const getValue = useCallback((year: number, monthIdx: number) => {
    const m = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const v = kpiValues.find(v => v.month === m);
    return v?.value ?? '';
  }, [kpiValues]);

  // Save a single cell
  const handleCellSave = useCallback(async (year: number, monthIdx: number, raw: string) => {
    if (!selectedKpi) return;
    const m = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    if (raw === '' || isNaN(Number(raw))) return;
    try {
      await mutations.saveValue.mutateAsync({ kpi_definition_id: selectedKpi, month: m, value: Number(raw) });
    } catch {
      toast.error('Erro ao salvar valor');
    }
  }, [selectedKpi, mutations]);

  return (
    <div className="space-y-4 p-1">
      <div>
        <Label>Indicador</Label>
        <Select value={selectedKpi} onValueChange={setSelectedKpi}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {enabledDefs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedKpi && (
        <>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Adicionar ano (ex: 2024)"
              className="w-40 h-8 text-xs"
              value={addYear}
              onChange={e => setAddYear(e.target.value)}
            />
            {addYear && !years.includes(parseInt(addYear)) && (
              <span className="text-[10px] text-muted-foreground">Novo ano será adicionado à tabela</span>
            )}
          </div>

          <ScrollArea className="max-h-[400px]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-medium text-muted-foreground border-b border-border/50 sticky left-0 bg-background">Mês</th>
                  {allYears.map(y => (
                    <th key={y} className="text-center p-1.5 font-medium text-muted-foreground border-b border-border/50 min-w-[70px]">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MONTH_LABELS.map((label, mi) => (
                  <tr key={mi} className="border-b border-border/20 hover:bg-muted/30">
                    <td className="p-1.5 font-medium text-muted-foreground sticky left-0 bg-background">{label}</td>
                    {allYears.map(y => (
                      <td key={y} className="p-0.5">
                        <EditableCell
                          value={getValue(y, mi)}
                          onSave={(v) => handleCellSave(y, mi, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

/* ─── Editable Cell ─── */
function EditableCell({ value, onSave }: { value: number | string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== String(value) && draft !== '') {
      onSave(draft);
    }
  };

  if (!editing) {
    return (
      <div
        className="text-center cursor-pointer rounded px-1 py-1 hover:bg-muted/50 min-h-[28px] flex items-center justify-center text-xs"
        onClick={() => setEditing(true)}
      >
        {value !== '' ? value : <span className="text-muted-foreground/40">—</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      step="0.01"
      className="w-full text-center text-xs border border-primary/40 rounded px-1 py-1 bg-background outline-none focus:ring-1 focus:ring-primary/30"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
    />
  );
}

/* ─── Ícones Tab ─── */
function IconesTab({ icons, schoolId, mutations }: {
  icons: KpiIcon[];
  schoolId: string;
  mutations: ReturnType<typeof useKpiMutations>;
}) {
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAsGlobal, setUploadAsGlobal] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const isGlobal = isAdmin && uploadAsGlobal;
      const ext = file.name.split('.').pop();
      const path = `${isGlobal ? 'global' : schoolId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('kpi-icons').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('kpi-icons').getPublicUrl(path);
      const name = file.name.replace(/\.[^.]+$/, '');
      await mutations.saveIcon.mutateAsync({ name, file_url: urlData.publicUrl, is_global: isGlobal });
      toast.success(isGlobal ? 'Ícone global adicionado!' : 'Ícone adicionado!');
    } catch {
      toast.error('Erro no upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const globals = icons.filter(i => i.is_global);
  const locals = icons.filter(i => !i.is_global);

  return (
    <div className="space-y-4 p-1">
      <input ref={fileRef} type="file" accept=".png,.svg" onChange={handleUpload} className="hidden" />
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="w-3.5 h-3.5 mr-1" /> {uploading ? 'Enviando...' : 'Upload de ícone'}
        </Button>
        {isAdmin && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={uploadAsGlobal} onCheckedChange={(v) => setUploadAsGlobal(!!v)} />
            <Globe className="w-3.5 h-3.5" />
            Adicionar à biblioteca global (todas as empresas)
          </label>
        )}
      </div>

      {globals.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Globe className="w-3 h-3" /> Biblioteca global ({globals.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {globals.map(ic => (
              <div key={ic.id} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-primary/5 border border-primary/20 relative group">
                <img src={ic.file_url} alt={ic.name} className="w-12 h-12 object-contain" />
                <span className="text-[10px] text-muted-foreground truncate max-w-full">{ic.name}</span>
                <span className="text-[9px] px-1.5 py-0 rounded bg-primary/10 text-primary font-semibold">GLOBAL</span>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => { if (confirm('Excluir este ícone global? Todas as empresas que o usam perderão a referência.')) mutations.deleteIcon.mutate(ic.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {locals.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Ícones desta empresa ({locals.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {locals.map(ic => (
              <div key={ic.id} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30 border border-border/30 relative group">
                <img src={ic.file_url} alt={ic.name} className="w-12 h-12 object-contain" />
                <span className="text-[10px] text-muted-foreground truncate max-w-full">{ic.name}</span>
                <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => mutations.deleteIcon.mutate(ic.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!icons.length && (
        <div className="text-center py-8">
          <Image className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum ícone na biblioteca.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Modelos Tab ─── */
interface Template {
  id: string;
  name: string;
  items: TemplateItem[];
}
interface TemplateItem {
  id: string;
  template_id: string;
  name: string;
  value_type: string;
  direction: string;
  sort_order: number;
  thresholds: any[];
  icon_url?: string | null;
}

function ModelosTab({ schoolId, mutations, definitions, icons }: {
  schoolId: string;
  mutations: ReturnType<typeof useKpiMutations>;
  definitions?: KpiDefinitionWithThresholds[];
  icons?: KpiIcon[];
}) {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['kpi_templates'],
    queryFn: async () => {
      const { data: tpls, error } = await supabase.from('kpi_templates').select('*').order('name');
      if (error) throw error;
      const { data: items, error: e2 } = await supabase.from('kpi_template_items').select('*').order('sort_order');
      if (e2) throw e2;
      return (tpls as any[]).map(t => ({
        ...t,
        items: (items as any[]).filter(i => i.template_id === t.id),
      })) as Template[];
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [formName, setFormName] = useState('');

  const applyTemplate = async (tpl: Template) => {
    try {
      for (let i = 0; i < tpl.items.length; i++) {
        const item = tpl.items[i];

        // Resolve icon: prefer existing entry in the global library; otherwise insert it once
        // and mirror in kpi_icons (same id) so the FK kpi_definitions.icon_id -> kpi_icons stays valid.
        let iconId: string | null = null;
        if (item.icon_url) {
          const { data: lib } = await supabase
            .from('icons_library')
            .select('id, name')
            .eq('file_url', item.icon_url)
            .maybeSingle();
          if (lib) {
            iconId = lib.id;
          } else {
            const newId = crypto.randomUUID();
            await supabase.from('icons_library').insert({
              id: newId,
              name: item.name,
              file_url: item.icon_url,
            } as any);
            iconId = newId;
          }
          // Mirror into kpi_icons (legacy FK target) if missing
          const { data: legacy } = await supabase.from('kpi_icons').select('id').eq('id', iconId).maybeSingle();
          if (!legacy) {
            await supabase.from('kpi_icons').insert({
              id: iconId,
              name: item.name,
              file_url: item.icon_url,
              is_global: true,
              school_id: null,
            } as any);
          }
        }

        const { data: inserted, error } = await supabase.from('kpi_definitions').insert({
          school_id: schoolId,
          name: item.name,
          value_type: item.value_type,
          direction: item.direction,
          sort_order: item.sort_order,
          enabled: true,
          icon_id: iconId,
        } as any).select('id').single();
        if (error) throw error;

        if (item.thresholds?.length && inserted) {
          const rows = item.thresholds.map((t: any, j: number) => ({
            kpi_definition_id: inserted.id,
            min_value: t.min_value,
            max_value: t.max_value,
            color: t.color,
            label: t.label,
            sort_order: j,
          }));
          const { error: e2 } = await supabase.from('kpi_thresholds').insert(rows as any);
          if (e2) throw e2;
        }
      }
      qc.invalidateQueries({ queryKey: ['kpi_definitions', schoolId] });
      qc.invalidateQueries({ queryKey: ['kpi_thresholds', schoolId] });
      qc.invalidateQueries({ queryKey: ['kpiIcons', schoolId] });
      qc.invalidateQueries({ queryKey: ['icons_library'] });
      toast.success(`Modelo "${tpl.name}" aplicado com ${tpl.items.length} indicadores!`);
    } catch {
      toast.error('Erro ao aplicar modelo');
    }
  };

  const duplicateTemplate = async (tpl: Template) => {
    try {
      const { data: newTpl, error } = await supabase.from('kpi_templates').insert({ name: `${tpl.name} (cópia)` } as any).select('id').single();
      if (error) throw error;
      if (tpl.items.length) {
        const rows = tpl.items.map(i => ({
          template_id: newTpl.id,
          name: i.name,
          value_type: i.value_type,
          direction: i.direction,
          sort_order: i.sort_order,
          thresholds: i.thresholds,
          icon_url: i.icon_url || null,
        }));
        await supabase.from('kpi_template_items').insert(rows as any);
      }
      qc.invalidateQueries({ queryKey: ['kpi_templates'] });
      toast.success('Modelo duplicado!');
    } catch {
      toast.error('Erro ao duplicar');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Excluir este modelo?')) return;
    await supabase.from('kpi_templates').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['kpi_templates'] });
    toast.success('Modelo excluído');
  };

  const renameTemplate = async (id: string) => {
    if (!formName.trim()) return;
    await supabase.from('kpi_templates').update({ name: formName } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['kpi_templates'] });
    setEditing(null);
    toast.success('Nome atualizado');
  };

  const createTemplate = async () => {
    const { error } = await supabase.from('kpi_templates').insert({ name: 'Novo Modelo' } as any);
    if (error) { toast.error('Erro'); return; }
    qc.invalidateQueries({ queryKey: ['kpi_templates'] });
    toast.success('Modelo criado!');
  };

  const saveCurrentAsTemplate = async () => {
    if (!definitions?.length) { toast.error('Nenhum indicador configurado'); return; }
    try {
      const { data: newTpl, error } = await supabase.from('kpi_templates').insert({ name: 'Modelo da Escola' } as any).select('id').single();
      if (error) throw error;
      const rows = definitions.map(d => ({
        template_id: newTpl.id,
        name: d.name,
        value_type: d.value_type,
        direction: d.direction,
        sort_order: d.sort_order,
        thresholds: d.thresholds.map(t => ({
          min_value: t.min_value,
          max_value: t.max_value,
          color: t.color,
          label: t.label,
          sort_order: t.sort_order,
        })),
        icon_url: d.icon?.file_url || null,
      }));
      await supabase.from('kpi_template_items').insert(rows as any);
      qc.invalidateQueries({ queryKey: ['kpi_templates'] });
      toast.success('Configuração atual salva como modelo!');
    } catch {
      toast.error('Erro ao salvar modelo');
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex gap-2">
        <Button size="sm" onClick={createTemplate}><Plus className="w-3.5 h-3.5 mr-1" /> Novo modelo</Button>
        {definitions && definitions.length > 0 && (
          <Button size="sm" variant="outline" onClick={saveCurrentAsTemplate}><Save className="w-3.5 h-3.5 mr-1" /> Salvar atual</Button>
        )}
      </div>

      {templates.map(tpl => (
        <div key={tpl.id} className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-2">
          {editing === tpl.id ? (
            <div className="flex gap-2">
              <Input value={formName} onChange={e => setFormName(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" onClick={() => renameTemplate(tpl.id)}><Save className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>✕</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium cursor-pointer" onClick={() => { setEditing(tpl.id); setFormName(tpl.name); }}>{tpl.name}</p>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Aplicar à empresa" onClick={() => applyTemplate(tpl)}>
                  <FileDown className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar" onClick={() => duplicateTemplate(tpl)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => deleteTemplate(tpl.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {tpl.items.length} indicadores: {tpl.items.map(i => i.name).join(', ') || '(vazio)'}
          </div>
        </div>
      ))}

      {!templates.length && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum modelo. Crie um para reutilizar indicadores em várias empresas.</p>
      )}
    </div>
  );
}
