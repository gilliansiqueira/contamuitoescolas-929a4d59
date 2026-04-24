import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LibraryIcon {
  id: string;
  name: string;
  file_url: string;
  folder_id: string | null;
  created_at: string;
}

export interface IconFolder {
  id: string;
  name: string;
  sort_order: number;
}

export function useIconLibrary() {
  return useQuery({
    queryKey: ['icons_library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icons_library')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as LibraryIcon[];
    },
  });
}

export function useIconFolders() {
  return useQuery({
    queryKey: ['icon_folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icon_folders')
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as IconFolder[];
    },
  });
}

export function useUploadLibraryIcon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, name, folder_id }: { file: File; name: string; folder_id: string | null }) => {
      const ext = file.name.split('.').pop() || 'png';
      const path = `library/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('kpi-icons').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('kpi-icons').getPublicUrl(path);
      const { error: insErr } = await supabase.from('icons_library').insert({
        name: name.trim() || file.name,
        file_url: pub.publicUrl,
        folder_id,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icons_library'] }),
  });
}

export function useUpdateLibraryIcon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, folder_id }: { id: string; name?: string; folder_id?: string | null }) => {
      const patch: { name?: string; folder_id?: string | null } = {};
      if (name !== undefined) patch.name = name;
      if (folder_id !== undefined) patch.folder_id = folder_id;
      const { error } = await supabase.from('icons_library').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icons_library'] }),
  });
}

export function useDeleteLibraryIcon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('icons_library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icons_library'] }),
  });
}

export function useCreateIconFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('icon_folders').insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icon_folders'] }),
  });
}

export function useRenameIconFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('icon_folders').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icon_folders'] }),
  });
}

export function useDeleteIconFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('icon_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['icon_folders'] });
      qc.invalidateQueries({ queryKey: ['icons_library'] });
    },
  });
}
