import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, GripVertical, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from '@/hooks/use-toast';

interface Props {
  schoolId: string;
  /** Comma-separated selected months from the global period filter, or 'all'. */
  selectedMonth: string;
}

interface Card {
  id: string;
  school_id: string;
  month: string;
  label: string;
  value: number;
  section: 'operacoes' | 'resultado';
  sort_order: number;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function resolveActiveMonth(selectedMonth: string): string {
  if (!selectedMonth || selectedMonth === 'all') {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const list = selectedMonth.split(',').map(s => s.trim()).filter(Boolean).sort();
  return list[list.length - 1] || new Date().toISOString().slice(0, 7);
}

export function ManualCardsSection({ schoolId, selectedMonth }: Props) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const activeMonth = resolveActiveMonth(selectedMonth);

  const { data: cards = [] } = useQuery({
    queryKey: ['dashboard_manual_cards', schoolId, activeMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_manual_cards')
        .select('*')
        .eq('school_id', schoolId)
        .eq('month', activeMonth)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as Card[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (card: Partial<Card> & { id?: string }) => {
      if (card.id) {
        const { error } = await supabase
          .from('dashboard_manual_cards')
          .update({ label: card.label, value: card.value, section: card.section, sort_order: card.sort_order })
          .eq('id', card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dashboard_manual_cards').insert({
          school_id: schoolId,
          month: activeMonth,
          label: card.label ?? 'Novo card',
          value: card.value ?? 0,
          section: card.section ?? 'operacoes',
          sort_order: card.sort_order ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard_manual_cards', schoolId, activeMonth] }),
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dashboard_manual_cards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard_manual_cards', schoolId, activeMonth] }),
  });

  const reorderMany = useMutation({
    mutationFn: async (updates: { id: string; section: 'operacoes' | 'resultado'; sort_order: number }[]) => {
      // sequential to avoid RLS surprises
      for (const u of updates) {
        const { error } = await supabase
          .from('dashboard_manual_cards')
          .update({ section: u.section, sort_order: u.sort_order })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard_manual_cards', schoolId, activeMonth] }),
  });

  const grouped = useMemo(() => {
    const ops = cards.filter(c => c.section === 'operacoes').sort((a, b) => a.sort_order - b.sort_order);
    const res = cards.filter(c => c.section === 'resultado').sort((a, b) => a.sort_order - b.sort_order);
    return { operacoes: ops, resultado: res };
  }, [cards]);

  const [editing, setEditing] = useState<Partial<Card> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    // Determine destination section: over an item → its section; over the container id → that section
    const overId = String(over.id);
    let destSection: 'operacoes' | 'resultado' = activeCard.section;
    if (overId === 'section-operacoes') destSection = 'operacoes';
    else if (overId === 'section-resultado') destSection = 'resultado';
    else {
      const overCard = cards.find(c => c.id === overId);
      if (overCard) destSection = overCard.section;
    }

    // Build new ordering
    const sourceList = grouped[activeCard.section].map(c => c.id);
    const destList = grouped[destSection].map(c => c.id);

    const updates: { id: string; section: 'operacoes' | 'resultado'; sort_order: number }[] = [];

    if (activeCard.section === destSection) {
      const oldIndex = sourceList.indexOf(String(active.id));
      const newIndex = sourceList.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(sourceList, oldIndex, newIndex);
      reordered.forEach((id, i) => updates.push({ id, section: destSection, sort_order: i }));
    } else {
      const filteredSource = sourceList.filter(id => id !== String(active.id));
      const insertAt = destList.indexOf(overId);
      const nextDest = [...destList];
      if (insertAt < 0) nextDest.push(String(active.id));
      else nextDest.splice(insertAt, 0, String(active.id));
      filteredSource.forEach((id, i) => updates.push({ id, section: activeCard.section, sort_order: i }));
      nextDest.forEach((id, i) => updates.push({ id, section: destSection, sort_order: i }));
    }
    reorderMany.mutate(updates);
  };

  if (cards.length === 0 && !isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Cards manuais · {activeMonth}
          <span className="text-[10px] font-normal text-muted-foreground/70 normal-case tracking-normal">
            (informativos — não afetam saldo ou resultado)
          </span>
        </h3>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() =>
            setEditing({ label: '', value: 0, section: 'operacoes', sort_order: cards.length })
          }>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar card
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionColumn
            id="section-operacoes"
            title="Operações"
            cards={grouped.operacoes}
            isAdmin={isAdmin}
            onEdit={setEditing}
            onRemove={(id) => remove.mutate(id)}
          />
          <SectionColumn
            id="section-resultado"
            title="Resultado"
            cards={grouped.resultado}
            isAdmin={isAdmin}
            onEdit={setEditing}
            onRemove={(id) => remove.mutate(id)}
          />
        </div>
      </DndContext>

      <EditDialog
        card={editing}
        onClose={() => setEditing(null)}
        onSave={(c) => { upsert.mutate(c); setEditing(null); }}
      />
    </div>
  );
}

function SectionColumn({
  id, title, cards, isAdmin, onEdit, onRemove,
}: {
  id: string; title: string; cards: Card[]; isAdmin: boolean;
  onEdit: (c: Card) => void; onRemove: (id: string) => void;
}) {
  return (
    <div id={id} className="glass-card rounded-2xl p-4 border border-border/50 min-h-[120px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</h4>
        <span className="text-[10px] text-muted-foreground">{cards.length}</span>
      </div>
      <SortableContext items={cards.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} isAdmin={isAdmin} onEdit={onEdit} onRemove={onRemove} />
          ))}
          {cards.length === 0 && (
            <p className="text-xs text-muted-foreground italic col-span-full text-center py-4">
              Arraste um card para cá ou adicione um novo.
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({
  card, isAdmin, onEdit, onRemove,
}: { card: Card; isAdmin: boolean; onEdit: (c: Card) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !isAdmin,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const color = card.value >= 0 ? 'text-success' : 'text-destructive';
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      className="rounded-xl border border-border/60 bg-card p-3 flex flex-col gap-1.5 relative group"
    >
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            {...attributes} {...listeners}
            className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Arrastar"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate flex-1">
          {card.label}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-muted text-muted-foreground uppercase">
          Manual
        </span>
      </div>
      <p className={`text-xl font-display font-bold ${color}`}>{fmt(card.value)}</p>
      {isAdmin && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={() => onEdit(card)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title="Editar"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => { if (confirm('Excluir este card?')) onRemove(card.id); }}
            className="p-1 rounded hover:bg-destructive/10 text-destructive"
            title="Excluir"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function EditDialog({
  card, onClose, onSave,
}: { card: Partial<Card> | null; onClose: () => void; onSave: (c: Partial<Card>) => void }) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('0');
  const [section, setSection] = useState<'operacoes' | 'resultado'>('operacoes');

  useMemo(() => {
    if (card) {
      setLabel(card.label ?? '');
      setValue(String(card.value ?? 0).replace('.', ','));
      setSection((card.section as any) ?? 'operacoes');
    }
  }, [card]);

  if (!card) return null;

  const parsed = Number(String(value).replace(/\./g, '').replace(',', '.')) || 0;

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card.id ? 'Editar card' : 'Novo card manual'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Reserva estratégica" />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" inputMode="decimal" />
            <p className="text-[10px] text-muted-foreground mt-1">Use vírgula para decimais. Valores negativos aceitos.</p>
          </div>
          <div>
            <Label>Seção</Label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setSection('operacoes')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${section === 'operacoes' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >Operações</button>
              <button
                type="button"
                onClick={() => setSection('resultado')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${section === 'resultado' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >Resultado</button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ ...card, label: label || 'Sem título', value: parsed, section })}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
