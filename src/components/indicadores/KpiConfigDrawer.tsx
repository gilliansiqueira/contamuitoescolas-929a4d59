import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Upload, Save, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { KpiDefinitionWithThresholds, KpiIcon } from './types';
import { useKpiMutations } from './useKpiData';

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
          <TabsList className="grid grid-cols-3 mb-3">
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="valores">Valores</TabsTrigger>
            <TabsTrigger value="icones">Ícones</TabsTrigger>
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

      // Need the ID for thresholds
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
            <Button size="sm" variant="ghost" onClick={() => setThresholds([...thresholds, { min_value: '', max_value: '', color: 'hsl(142 71% 45%)', label: '' }])}>
              <Plus className="w-3 h-3 mr-1" /> Faixa
            </Button>
          </div>
          <div className="space-y-2">
            {thresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Input
                  placeholder="Mín"
                  type="number"
                  value={t.min_value}
                  onChange={e => {
                    const n = [...thresholds]; n[i] = { ...t, min_value: e.target.value }; setThresholds(n);
                  }}
                  className="w-16 h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  placeholder="Máx"
                  type="number"
                  value={t.max_value}
                  onChange={e => {
                    const n = [...thresholds]; n[i] = { ...t, max_value: e.target.value }; setThresholds(n);
                  }}
                  className="w-16 h-7 text-xs"
                />
                <input
                  type="color"
                  value={t.color.startsWith('hsl') ? '#22c55e' : t.color}
                  onChange={e => {
                    const n = [...thresholds]; n[i] = { ...t, color: e.target.value }; setThresholds(n);
                  }}
                  className="w-7 h-7 rounded border-0 cursor-pointer"
                />
                <Input
                  placeholder="Rótulo"
                  value={t.label}
                  onChange={e => {
                    const n = [...thresholds]; n[i] = { ...t, label: e.target.value }; setThresholds(n);
                  }}
                  className="flex-1 h-7 text-xs"
                />
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
          <Checkbox
            checked={def.enabled}
            onCheckedChange={() => handleToggle(def)}
          />
          {def.icon?.file_url && (
            <img src={def.icon.file_url} alt={def.name} className="w-8 h-8 object-contain" />
          )}
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

/* ─── Valores Tab ─── */
function ValoresTab({ definitions, schoolId, mutations }: {
  definitions: KpiDefinitionWithThresholds[];
  schoolId: string;
  mutations: ReturnType<typeof useKpiMutations>;
}) {
  const enabledDefs = definitions.filter(d => d.enabled);
  const [selectedKpi, setSelectedKpi] = useState(enabledDefs[0]?.id || '');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [value, setValue] = useState('');

  const handleSave = async () => {
    if (!selectedKpi || !month || value === '') { toast.error('Preencha todos os campos'); return; }
    try {
      await mutations.saveValue.mutateAsync({ kpi_definition_id: selectedKpi, month, value: Number(value) });
      toast.success('Valor salvo!');
      setValue('');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

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
      <div>
        <Label>Mês</Label>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      <div>
        <Label>Valor</Label>
        <Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="Ex: 15.5" />
      </div>
      <Button size="sm" onClick={handleSave} disabled={mutations.saveValue.isPending}>
        <Save className="w-3.5 h-3.5 mr-1" /> Salvar valor
      </Button>
    </div>
  );
}

/* ─── Ícones Tab ─── */
function IconesTab({ icons, schoolId, mutations }: {
  icons: KpiIcon[];
  schoolId: string;
  mutations: ReturnType<typeof useKpiMutations>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${schoolId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('kpi-icons').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('kpi-icons').getPublicUrl(path);
      const name = file.name.replace(/\.[^.]+$/, '');
      await mutations.saveIcon.mutateAsync({ name, file_url: urlData.publicUrl });
      toast.success('Ícone adicionado!');
    } catch {
      toast.error('Erro no upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 p-1">
      <input ref={fileRef} type="file" accept=".png,.svg" onChange={handleUpload} className="hidden" />
      <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <Upload className="w-3.5 h-3.5 mr-1" /> {uploading ? 'Enviando...' : 'Upload de ícone'}
      </Button>
      <div className="grid grid-cols-3 gap-3">
        {icons.map(ic => (
          <div key={ic.id} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30 border border-border/30 relative group">
            <img src={ic.file_url} alt={ic.name} className="w-12 h-12 object-contain" />
            <span className="text-[10px] text-muted-foreground truncate max-w-full">{ic.name}</span>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
              onClick={() => mutations.deleteIcon.mutate(ic.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
      {!icons.length && (
        <div className="text-center py-8">
          <Image className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum ícone na biblioteca.</p>
        </div>
      )}
    </div>
  );
}
