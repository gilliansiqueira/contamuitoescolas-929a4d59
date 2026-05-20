import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemplates, fetchTemplateItems, type FinancialModelTemplate, type FinancialModelTemplateItem } from '@/lib/financialModels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { LayoutTemplate, Plus, Trash2, Copy, Save, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ItemRow extends Omit<FinancialModelTemplateItem, 'id' | 'template_id'> {
  id: string;
  isNew?: boolean;
  dirty?: boolean;
  toDelete?: boolean;
}

export function ModelosFinanceirosManager() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['financial_model_templates'],
    queryFn: fetchTemplates,
  });

  const createTemplate = async () => {
    const name = window.prompt('Nome do modelo:');
    if (!name?.trim()) return;
    const { data, error } = await supabase
      .from('financial_model_templates' as any)
      .insert({ name: name.trim(), is_system: false } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success('Modelo criado');
    qc.invalidateQueries({ queryKey: ['financial_model_templates'] });
    setSelectedId((data as any).id);
  };

  const duplicateTemplate = async (t: FinancialModelTemplate) => {
    const newName = window.prompt('Nome do novo modelo:', `${t.name} (cópia)`);
    if (!newName?.trim()) return;
    const { data: newT, error } = await supabase
      .from('financial_model_templates' as any)
      .insert({ name: newName.trim(), description: t.description, is_system: false } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    const items = await fetchTemplateItems(t.id);
    if (items.length > 0) {
      const payload = items.map(i => ({
        template_id: (newT as any).id,
        name: i.name,
        tipo: i.tipo,
        impacta_caixa: i.impacta_caixa,
        entra_no_resultado: i.entra_no_resultado,
        sort_order: i.sort_order,
      }));
      await supabase.from('financial_model_template_items' as any).insert(payload as any);
    }
    toast.success('Modelo duplicado');
    qc.invalidateQueries({ queryKey: ['financial_model_templates'] });
    setSelectedId((newT as any).id);
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('financial_model_templates' as any).delete().eq('id', deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success('Modelo excluído');
    qc.invalidateQueries({ queryKey: ['financial_model_templates'] });
    if (selectedId === deleteId) setSelectedId(null);
    setDeleteId(null);
  };

  const renameTemplate = async (t: FinancialModelTemplate) => {
    const newName = window.prompt('Renomear modelo:', t.name);
    if (!newName?.trim() || newName === t.name) return;
    const { error } = await supabase.from('financial_model_templates' as any).update({ name: newName.trim() } as any).eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Modelo renomeado');
    qc.invalidateQueries({ queryKey: ['financial_model_templates'] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">Modelos Financeiros</h3>
          </div>
          <Button size="sm" onClick={createTemplate}><Plus className="w-3 h-3 mr-1" /> Novo modelo</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lista de modelos */}
          <div className="space-y-1 md:col-span-1">
            {templates.map(t => (
              <div
                key={t.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedId === t.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedId(t.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${selectedId === t.id ? 'rotate-90' : ''}`} />
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  {t.is_system && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">sistema</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); renameTemplate(t); }} title="Renomear" className="p-1 hover:text-primary">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }} title="Duplicar" className="p-1 hover:text-primary">
                    <Copy className="w-3 h-3" />
                  </button>
                  {!t.is_system && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(t.id); }} title="Excluir" className="p-1 hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum modelo. Clique em "Novo modelo".</p>
            )}
          </div>

          {/* Editor de itens */}
          <div className="md:col-span-2">
            {selectedId ? (
              <TemplateItemsEditor templateId={selectedId} />
            ) : (
              <div className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-lg">
                Selecione um modelo à esquerda para editar seus tipos.
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo</AlertDialogTitle>
            <AlertDialogDescription>
              As empresas que já aplicaram este modelo continuam com suas cópias. Apenas o template original será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function TemplateItemsEditor({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const { data: items = [], isFetching } = useQuery({
    queryKey: ['financial_model_template_items', templateId],
    queryFn: () => fetchTemplateItems(templateId),
  });

  const [rows, setRows] = useState<ItemRow[]>([]);

  useEffect(() => {
    setRows(items.map(i => ({
      id: i.id, name: i.name, tipo: i.tipo,
      impacta_caixa: i.impacta_caixa, entra_no_resultado: i.entra_no_resultado, sort_order: i.sort_order,
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, items.length, isFetching]);

  const update = (id: string, field: keyof ItemRow, value: any) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value, dirty: true } : r));
  };

  const addRow = () => {
    setRows(rs => [...rs, {
      id: crypto.randomUUID(),
      name: '', tipo: 'entrada', impacta_caixa: true, entra_no_resultado: true,
      sort_order: rs.length, isNew: true, dirty: true,
    }]);
  };

  const removeRow = (id: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, toDelete: true, dirty: true } : r));
  };

  const saveAll = async () => {
    try {
      const toDelete = rows.filter(r => r.toDelete && !r.isNew).map(r => r.id);
      if (toDelete.length > 0) {
        await supabase.from('financial_model_template_items' as any).delete().in('id', toDelete);
      }
      const toUpsert = rows.filter(r => !r.toDelete && r.dirty);
      for (const r of toUpsert) {
        const payload = {
          template_id: templateId,
          name: r.name || 'Sem nome',
          tipo: r.tipo,
          impacta_caixa: r.impacta_caixa,
          entra_no_resultado: r.entra_no_resultado,
          sort_order: r.sort_order,
        };
        if (r.isNew) {
          await supabase.from('financial_model_template_items' as any).insert(payload as any);
        } else {
          await supabase.from('financial_model_template_items' as any).update(payload as any).eq('id', r.id);
        }
      }
      toast.success('Modelo salvo');
      setRows([]);
      qc.invalidateQueries({ queryKey: ['financial_model_template_items', templateId] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    }
  };

  const visible = rows.filter(r => !r.toDelete);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Cada item define um tipo financeiro. Empresas que aplicarem este modelo recebem uma cópia independente.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-3 h-3 mr-1" /> Item</Button>
          <Button size="sm" onClick={saveAll}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-28">Tipo</th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-32">Impacta saldo</th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-36">Entra no resultado</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id} className="border-t border-border/30">
                <td className="px-2 py-1.5">
                  <Input value={r.name} onChange={e => update(r.id, 'name', e.target.value)} className="h-8 text-xs" placeholder="Ex: Receita" />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <select value={r.tipo} onChange={e => update(r.id, 'tipo', e.target.value)} className="h-8 text-xs border rounded px-2 bg-background">
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <select value={String(r.impacta_caixa)} onChange={e => update(r.id, 'impacta_caixa', e.target.value === 'true')} className="h-8 text-xs border rounded px-2 bg-background">
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <select value={String(r.entra_no_resultado)} onChange={e => update(r.id, 'entra_no_resultado', e.target.value === 'true')} className="h-8 text-xs border rounded px-2 bg-background">
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => removeRow(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground text-xs">
                Nenhum item. Clique em "Item" para adicionar.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
