import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';

export type DetailTipo = 'receita' | 'despesa';

export interface DetailGroup {
  id: string;
  school_id: string;
  name: string;
  sort_order: number;
}

export interface DetailItem {
  id: string;
  school_id: string;
  group_id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: DetailTipo;
}

/** Configuração (liga/desliga + nome da aba) por empresa. */
export function useExpenseDetailConfig(schoolId: string) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['expense_detail_config', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('expense_detail_enabled, expense_detail_label')
        .eq('id', schoolId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (updates: { expense_detail_enabled?: boolean; expense_detail_label?: string }) => {
      const { error } = await supabase.from('schools').update(updates).eq('id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expense_detail_config', schoolId] }),
  });

  return {
    enabled: !!data?.expense_detail_enabled,
    label: data?.expense_detail_label || 'Detalhamento',
    save,
  };
}

/** Grupos (centros de custo) e itens livres do detalhamento. */
export function useExpenseDetail(schoolId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expense_detail_groups', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['expense_detail_items', schoolId] });
  };

  const groupsQuery = useQuery({
    queryKey: ['expense_detail_groups', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_detail_groups')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as DetailGroup[];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ['expense_detail_items', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        'expense_detail_items',
        q => q.eq('school_id', schoolId).order('data'),
      );
      return data.map(i => ({
        ...i,
        valor: Number(i.valor || 0),
        tipo: ((i as any).tipo === 'receita' ? 'receita' : 'despesa') as DetailTipo,
      })) as DetailItem[];
    },
  });

  const addGroup = useMutation({
    mutationFn: async (name: string) => {
      const sort = (groupsQuery.data?.length || 0);
      const { error } = await supabase
        .from('expense_detail_groups')
        .insert({ school_id: schoolId, name, sort_order: sort });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameGroup = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('expense_detail_groups').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const moveGroup = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const list = [...(groupsQuery.data || [])];
      const idx = list.findIndex(g => g.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= list.length) return;
      const a = list[idx];
      const b = list[target];
      await supabase.from('expense_detail_groups').update({ sort_order: target }).eq('id', a.id);
      await supabase.from('expense_detail_groups').update({ sort_order: idx }).eq('id', b.id);
    },
    onSuccess: invalidate,
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_detail_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const saveItem = useMutation({
    mutationFn: async (item: {
      id?: string;
      group_id: string;
      descricao: string;
      valor: number;
      data: string;
      tipo: DetailTipo;
    }) => {
      if (item.id) {
        const { error } = await supabase
          .from('expense_detail_items')
          .update({
            group_id: item.group_id,
            descricao: item.descricao,
            valor: item.valor,
            data: item.data,
            tipo: item.tipo,
          })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expense_detail_items').insert({
          school_id: schoolId,
          group_id: item.group_id,
          descricao: item.descricao,
          valor: item.valor,
          data: item.data,
          tipo: item.tipo,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  /** Garante que um centro de custo (grupo) exista, retornando o id. */
  const ensureGroup = async (name: string, cache: DetailGroup[], sortRef: { value: number }) => {
    const found = cache.find(g => g.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (found) return found.id;
    const { data: inserted, error } = await supabase
      .from('expense_detail_groups')
      .insert({ school_id: schoolId, name: name.trim(), sort_order: sortRef.value++ })
      .select()
      .single();
    if (error) throw error;
    cache.push(inserted as DetailGroup);
    return (inserted as DetailGroup).id;
  };

  /** Importa lista colada: grupos (MAIÚSCULAS) com itens abaixo. */
  const pasteImport = useMutation({
    mutationFn: async ({
      parsed,
      data,
    }: {
      parsed: { grupo: string; itens: { descricao: string; valor: number; tipo?: DetailTipo }[] }[];
      data: string;
    }) => {
      const cache = [...(groupsQuery.data || [])];
      const sortRef = { value: cache.length };

      for (const block of parsed) {
        const groupId = await ensureGroup(block.grupo, cache, sortRef);
        if (block.itens.length) {
          const { error } = await supabase.from('expense_detail_items').insert(
            block.itens.map(i => ({
              school_id: schoolId,
              group_id: groupId,
              descricao: i.descricao,
              valor: i.valor,
              data,
              tipo: i.tipo || 'despesa',
            }))
          );
          if (error) throw error;
        }
      }
    },
    onSuccess: invalidate,
  });

  /** Salva várias linhas de planilha de uma vez (cria centros que não existem). */
  const bulkSaveItems = useMutation({
    mutationFn: async (
      rows: { id?: string; grupo: string; data: string; descricao: string; valor: number; tipo: DetailTipo }[]
    ) => {
      const cache = [...(groupsQuery.data || [])];
      const sortRef = { value: cache.length };
      const inserts: any[] = [];

      for (const row of rows) {
        const groupId = await ensureGroup(row.grupo, cache, sortRef);
        if (row.id) {
          const { error } = await supabase
            .from('expense_detail_items')
            .update({
              group_id: groupId,
              descricao: row.descricao,
              valor: row.valor,
              data: row.data,
              tipo: row.tipo,
            })
            .eq('id', row.id);
          if (error) throw error;
        } else {
          inserts.push({
            school_id: schoolId,
            group_id: groupId,
            descricao: row.descricao,
            valor: row.valor,
            data: row.data,
            tipo: row.tipo,
          });
        }
      }

      if (inserts.length) {
        const { error } = await supabase.from('expense_detail_items').insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_detail_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    groups: groupsQuery.data || [],
    items: itemsQuery.data || [],
    isLoading: groupsQuery.isLoading || itemsQuery.isLoading,
    addGroup,
    renameGroup,
    moveGroup,
    deleteGroup,
    saveItem,
    deleteItem,
    pasteImport,
    bulkSaveItems,
  };
}
