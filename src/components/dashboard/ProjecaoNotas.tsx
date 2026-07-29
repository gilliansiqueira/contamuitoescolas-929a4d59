/**
 * Observações da projeção por mês/período.
 * Guarda um comentário livre por (escola, mês) em `projection_notes`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MessageSquare, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  /** Filtro global: 'all' ou lista "YYYY-MM,YYYY-MM" */
  selectedMonth: string;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(mo) - 1] ?? mo}/${y}`;
}

export function ProjecaoNotas({ schoolId, selectedMonth }: Props) {
  const queryClient = useQueryClient();

  // Uma observação por período: usamos o primeiro mês selecionado como chave.
  const month = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return null;
    const list = selectedMonth.split(',').map(s => s.trim()).filter(Boolean).sort();
    return list[0] ?? null;
  }, [selectedMonth]);

  const { data: saved = '', isLoading } = useQuery({
    queryKey: ['projectionNote', schoolId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projection_notes')
        .select('note')
        .eq('school_id', schoolId)
        .eq('month', month!)
        .maybeSingle();
      if (error) throw error;
      return data?.note ?? '';
    },
    enabled: !!schoolId && !!month,
  });

  const [value, setValue] = useState('');
  useEffect(() => { setValue(saved); }, [saved, month]);

  const save = useMutation({
    mutationFn: async (note: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('projection_notes')
        .upsert(
          { school_id: schoolId, month: month!, note, updated_by: userData.user?.id ?? null },
          { onConflict: 'school_id,month' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectionNote', schoolId, month] });
      toast.success('Observações salvas');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar'),
  });

  if (!month) return null;

  const dirty = value !== saved;

  return (
    <div className="glass-card rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Observações — {monthLabel(month)}
        </h3>
        <Button size="sm" variant={dirty ? 'default' : 'ghost'} disabled={!dirty || save.isPending} onClick={() => save.mutate(value)}>
          {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>
      <Textarea
        value={isLoading ? '' : value}
        onChange={e => setValue(e.target.value)}
        placeholder="Comentários do período: premissas da projeção, pendências, explicações de variação…"
        rows={4}
        className="resize-y text-sm"
      />
    </div>
  );
}
