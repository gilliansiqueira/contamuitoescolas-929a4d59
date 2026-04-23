import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { IconPicker } from '@/components/analise-vendas/IconPicker';
import { motion } from 'framer-motion';

interface Props {
  schoolId: string;
}

interface Category {
  id: string;
  name: string;
  icon_url: string | null;
  sort_order: number;
}

interface CategoryValue {
  id: string;
  category_id: string;
  month: string;
  value: number;
}

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

export function RecebimentoCategoria({ schoolId }: Props) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['receivable_categories', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivable_categories')
        .select('*')
        .eq('school_id', schoolId)
        .eq('active', true)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: values = [] } = useQuery({
    queryKey: ['receivable_category_values', schoolId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivable_category_values')
        .select('*')
        .eq('school_id', schoolId)
        .eq('month', month);
      if (error) throw error;
      return data as CategoryValue[];
    },
  });

  const valueMap = useMemo(() => {
    const m = new Map<string, CategoryValue>();
    values.forEach(v => m.set(v.category_id, v));
    return m;
  }, [values]);

  const total = useMemo(() => values.reduce((s, v) => s + Number(v.value || 0), 0), [values]);

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error('Informe o nome da categoria');
      const { error } = await supabase.from('receivable_categories').insert({
        school_id: schoolId,
        name: newName.trim(),
        icon_url: newIcon,
        sort_order: categories.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName('');
      setNewIcon(null);
      qc.invalidateQueries({ queryKey: ['receivable_categories', schoolId] });
      toast.success('Categoria adicionada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('receivable_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivable_categories', schoolId] });
      qc.invalidateQueries({ queryKey: ['receivable_category_values', schoolId] });
      toast.success('Categoria excluída');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateIcon = useMutation({
    mutationFn: async ({ id, icon_url }: { id: string; icon_url: string | null }) => {
      const { error } = await supabase.from('receivable_categories').update({ icon_url }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receivable_categories', schoolId] }),
  });

  const saveValue = useMutation({
    mutationFn: async ({ category_id, value }: { category_id: string; value: number }) => {
      const existing = valueMap.get(category_id);
      if (existing) {
        const { error } = await supabase
          .from('receivable_category_values')
          .update({ value })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('receivable_category_values').insert({
          school_id: schoolId,
          category_id,
          month,
          value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receivable_category_values', schoolId, month] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-display font-semibold tracking-tight">Recebimento por Categoria</h2>
          <p className="text-muted-foreground text-sm">Registre os valores recebidos por categoria a cada mês.</p>
        </div>
        <div>
          <Label className="text-xs">Mês de referência</Label>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-44" />
        </div>
      </div>

      {/* Resumo */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total recebido no mês</p>
            <p className="text-3xl font-bold tabular-nums">{formatBRL(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Categorias ativas</p>
            <p className="text-3xl font-bold tabular-nums">{categories.length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de categorias com inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categorias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma categoria ainda. Adicione a primeira abaixo.
            </p>
          )}
          {categories.map(cat => {
            const cur = valueMap.get(cat.id);
            return (
              <CategoryRow
                key={cat.id}
                schoolId={schoolId}
                category={cat}
                value={cur?.value || 0}
                onSave={(v) => saveValue.mutate({ category_id: cat.id, value: v })}
                onDelete={() => deleteCategory.mutate(cat.id)}
                onIconChange={(url) => updateIcon.mutate({ id: cat.id, icon_url: url })}
              />
            );
          })}

          {/* Adicionar nova */}
          <div className="pt-4 border-t mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Adicionar categoria
            </p>
            <div className="flex items-center gap-2">
              <IconPicker schoolId={schoolId} value={newIcon} onChange={setNewIcon} />
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Mensalidades, Cursos extras..."
                className="h-10 flex-1"
                onKeyDown={e => { if (e.key === 'Enter') addCategory.mutate(); }}
              />
              <Button onClick={() => addCategory.mutate()} disabled={addCategory.isPending} className="h-10">
                {addCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ícones vêm da galeria global. Faça upload em <strong>Análise de Vendas → Cadastros → Ícones</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CategoryRow({
  schoolId, category, value, onSave, onDelete, onIconChange,
}: {
  schoolId: string;
  category: Category;
  value: number;
  onSave: (v: number) => void;
  onDelete: () => void;
  onIconChange: (url: string | null) => void;
}) {
  const [text, setText] = useState(value > 0 ? value.toString().replace('.', ',') : '');

  // Sync external value changes (e.g., month change)
  useMemo(() => {
    setText(value > 0 ? value.toString().replace('.', ',') : '');
  }, [value]);

  function commit() {
    const n = parseBR(text);
    if (n !== value) onSave(n);
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors">
      <IconPicker schoolId={schoolId} value={category.icon_url} onChange={onIconChange} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{category.name}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">R$</span>
        <Input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="0,00"
          className="h-9 w-36 text-right tabular-nums"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (confirm(`Excluir categoria "${category.name}" e todos os seus valores?`)) onDelete();
          }}
          className="h-9 w-9 text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
