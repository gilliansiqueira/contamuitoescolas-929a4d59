import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SAIcon } from './types';

export function useSAIcons(schoolId: string) {
  return useQuery({
    queryKey: ['sa_icons', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sa_icons')
        .select('*')
        .or(`school_id.eq.${schoolId},is_global.eq.true`)
        .order('is_global', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data || []) as SAIcon[];
    },
  });
}

export function useUploadSAIcon(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, name, isGlobal }: { file: File; name: string; isGlobal: boolean }) => {
      const ext = file.name.split('.').pop() || 'png';
      const path = `sa-icons/${isGlobal ? 'global' : schoolId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('kpi-icons').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('kpi-icons').getPublicUrl(path);
      const { error: insErr } = await supabase.from('sa_icons').insert({
        school_id: isGlobal ? null : schoolId,
        name: name.trim() || file.name,
        file_url: pub.publicUrl,
        is_global: isGlobal,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_icons', schoolId] }),
  });
}

export function useDeleteSAIcon(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sa_icons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_icons', schoolId] }),
  });
}
