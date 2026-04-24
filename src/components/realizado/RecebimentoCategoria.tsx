import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Pencil, ImageIcon, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { IconLibraryPicker } from '@/components/icons/IconLibraryPicker';
import { useAuth } from '@/hooks/useAuth';

interface Props { schoolId: string; }

interface Category { id: string; name: string; icon_url: string | null; sort_order: number; }
interface CategoryValue { id: string; category_id: string; month: string; value: number; }

function parseBR(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/\s|R\$/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}
function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function prevMonth(m: string): string {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function RecebimentoCategoria({ schoolId }: Props) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['receivable_categories', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivable_categories')
        .select('*').eq('school_id', schoolId).eq('active', true)
        .order('sort_order').order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });

  const prevM = prevMonth(month);

  const { data: values = [] } = useQuery({
    queryKey: ['receivable_category_values', schoolId, month, prevM],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivable_category_values')
        .select('*').eq('school_id', schoolId).in('month', [month, prevM]);
      if (error) throw error;
      return data as CategoryValue[];
    },
  });

  const currentMap = useMemo(() => {
    const m = new Map<string, number>();
    values.filter(v => v.month === month).forEach(v => m.set(v.category_id, Number(v.value)));
    return m;
  }, [values, month]);

  const prevMap = useMemo(() => {
    const m = new Map<string, number>();
    values.filter(v => v.month === prevM).forEach(v => m.set(v.category_id, Number(v.value)));
    return m;
  }, [values, prevM]);

  const totalCurrent = useMemo(() => Array.from(currentMap.values()).reduce((s, v) => s + v, 0), [currentMap]);
  const totalPrev = useMemo(() => Array.from(prevMap.values()).reduce((s, v) => s + v, 0), [prevMap]);
  const totalVar = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-display font-semibold tracking-tight">Recebimento por Categoria</h2>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'Acompanhe o recebimento mensal por categoria.' : 'Visualização dos recebimentos do mês.'}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Mês de referência</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-44" />
          </div>
          {isAdmin && (
            <Button onClick={() => setCreating(true)} className="h-9">
              <Plus className="w-4 h-4 mr-1" /> Nova categoria
            </Button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total recebido no mês</p>
            <p className="text-3xl font-bold tabular-nums">{formatBRL(totalCurrent)}</p>
            {totalVar !== null && <VariationPill variation={totalVar} />}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Categorias ativas</p>
            <p className="text-3xl font-bold tabular-nums">{categories.length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma categoria ainda.{isAdmin ? ' Clique em "Nova categoria" para começar.' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => {
            const cur = currentMap.get(cat.id) || 0;
            const prev = prevMap.get(cat.id) || 0;
            const variation = prev > 0 ? ((cur - prev) / prev) * 100 : null;
            return (
              <CategoryCard
                key={cat.id}
                category={cat}
                value={cur}
                variation={variation}
                canEdit={isAdmin}
                onEdit={() => setEditingCategory(cat)}
              />
            );
          })}
        </div>
      )}

      {/* Modal edição */}
      {editingCategory && isAdmin && (
        <CategoryEditDialog
          schoolId={schoolId}
          category={editingCategory}
          month={month}
          currentValue={currentMap.get(editingCategory.id) || 0}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['receivable_categories', schoolId] });
            qc.invalidateQueries({ queryKey: ['receivable_category_values', schoolId] });
          }}
        />
      )}

      {creating && isAdmin && (
        <CategoryCreateDialog
          schoolId={schoolId}
          nextOrder={categories.length}
          onClose={() => setCreating(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['receivable_categories', schoolId] })}
        />
      )}
    </motion.div>
  );
}

function VariationPill({ variation }: { variation: number }) {
  const Icon = variation > 0.5 ? ArrowUp : variation < -0.5 ? ArrowDown : Minus;
  const tone = variation > 0.5 ? 'text-emerald-600 bg-emerald-500/10' :
              variation < -0.5 ? 'text-rose-600 bg-rose-500/10' :
              'text-muted-foreground bg-muted';
  return (
    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(variation).toFixed(1)}% vs mês anterior
    </span>
  );
}

function CategoryCard({ category, value, variation, canEdit, onEdit }: {
  category: Category; value: number; variation: number | null; canEdit: boolean; onEdit: () => void;
}) {
  return (
    <Card className="group relative overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {category.icon_url ? (
              <img src={category.icon_url} alt={category.name} className="w-9 h-9 object-contain" />
            ) : (
              <ImageIcon className="w-5 h-5 text-primary/60" />
            )}
          </div>
          {canEdit && (
            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1 truncate">{category.name}</p>
        <p className="text-2xl font-bold tabular-nums">{formatBRL(value)}</p>
        {variation !== null ? (
          <VariationPill variation={variation} />
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Sem dados do mês anterior</p>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryEditDialog({
  schoolId, category, month, currentValue, onClose, onSaved,
}: {
  schoolId: string; category: Category; month: string; currentValue: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [iconUrl, setIconUrl] = useState<string | null>(category.icon_url);
  const [valueText, setValueText] = useState(currentValue > 0 ? currentValue.toString().replace('.', ',') : '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Update category meta
      const { error: e1 } = await supabase.from('receivable_categories')
        .update({ name: name.trim(), icon_url: iconUrl }).eq('id', category.id);
      if (e1) throw e1;

      // Upsert value for the month
      const value = parseBR(valueText);
      const { data: existing } = await supabase.from('receivable_category_values')
        .select('id').eq('school_id', schoolId).eq('category_id', category.id).eq('month', month).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('receivable_category_values').update({ value }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('receivable_category_values').insert({
          school_id: schoolId, category_id: category.id, month, value,
        });
        if (error) throw error;
      }
      toast.success('Salvo!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Excluir categoria "${category.name}" e todos os seus valores?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('receivable_categories').delete().eq('id', category.id);
      if (error) throw error;
      toast.success('Categoria excluída');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar categoria</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Ícone</Label>
            <div className="flex items-center gap-2 mt-1">
              <IconLibraryPicker value={iconUrl} onChange={setIconUrl} size="md" />
              <span className="text-xs text-muted-foreground">Da biblioteca global</span>
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Valor recebido em {month}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={valueText}
              onChange={e => setValueText(e.target.value)}
              placeholder="0,00"
              className="text-right tabular-nums"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" className="text-destructive mr-auto" onClick={remove} disabled={saving}>
            <Trash2 className="w-4 h-4 mr-1" /> Excluir
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryCreateDialog({
  schoolId, nextOrder, onClose, onSaved,
}: { schoolId: string; nextOrder: number; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('receivable_categories').insert({
        school_id: schoolId, name: name.trim(), icon_url: iconUrl, sort_order: nextOrder,
      });
      if (error) throw error;
      toast.success('Categoria criada');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Ícone</Label>
            <div className="flex items-center gap-2 mt-1">
              <IconLibraryPicker value={iconUrl} onChange={setIconUrl} size="md" />
              <span className="text-xs text-muted-foreground">Da biblioteca global</span>
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Mensalidades, Cursos extras..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
