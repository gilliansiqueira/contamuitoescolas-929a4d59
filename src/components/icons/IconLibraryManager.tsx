import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Trash2, Loader2, Search, FolderPlus, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  useIconLibrary, useIconFolders,
  useUploadLibraryIcon, useUpdateLibraryIcon, useDeleteLibraryIcon,
  useCreateIconFolder, useRenameIconFolder, useDeleteIconFolder,
} from './useIconLibrary';

export function IconLibraryManager() {
  const { isAdmin } = useAuth();
  const { data: icons = [] } = useIconLibrary();
  const { data: folders = [] } = useIconFolders();

  const upload = useUploadLibraryIcon();
  const updateIcon = useUpdateLibraryIcon();
  const deleteIcon = useDeleteLibraryIcon();
  const createFolder = useCreateIconFolder();
  const renameFolder = useRenameIconFolder();
  const deleteFolder = useDeleteIconFolder();

  const [name, setName] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState<string>('none');
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | 'all' | 'none'>('all');
  const [newFolder, setNewFolder] = useState('');
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return icons.filter(ic => {
      if (activeFolder === 'none' && ic.folder_id) return false;
      if (activeFolder !== 'all' && activeFolder !== 'none' && ic.folder_id !== activeFolder) return false;
      if (!q) return true;
      return ic.name.toLowerCase().includes(q);
    });
  }, [icons, search, activeFolder]);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Apenas administradores podem gerenciar a biblioteca de ícones.
        </CardContent>
      </Card>
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(png|jpe?g|svg|webp|gif)$/i.test(f.name)) {
      toast.error('Use PNG, JPG, SVG, WEBP ou GIF.');
      return;
    }
    if (f.size > 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 1MB).');
      return;
    }
    try {
      await upload.mutateAsync({
        file: f,
        name,
        folder_id: uploadFolderId === 'none' ? null : uploadFolderId,
      });
      toast.success('Ícone adicionado à biblioteca!');
      setName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar ícone');
    }
  }

  async function handleCreateFolder() {
    if (!newFolder.trim()) return;
    try {
      await createFolder.mutateAsync(newFolder);
      setNewFolder('');
      toast.success('Pasta criada');
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar ícone</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ícones ficam disponíveis para todas as empresas em todos os módulos.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Nome (opcional)</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: PIX, Camiseta..." className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Pasta</Label>
              <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="w-full">
                {upload.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Upload
              </Button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG, SVG, WEBP ou GIF — máx. 1MB.</p>
        </CardContent>
      </Card>

      {/* Pastas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderPlus className="w-4 h-4" /> Pastas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="Nome da pasta" className="h-9" />
            <Button onClick={handleCreateFolder} disabled={createFolder.isPending}>Criar pasta</Button>
          </div>
          {folders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pasta criada ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {folders.map(f => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                  {editingFolder === f.id ? (
                    <>
                      <Input
                        value={editingFolderName}
                        onChange={e => setEditingFolderName(e.target.value)}
                        className="h-8 flex-1"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => {
                        await renameFolder.mutateAsync({ id: f.id, name: editingFolderName });
                        setEditingFolder(null);
                      }}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingFolder(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {icons.filter(ic => ic.folder_id === f.id).length} ícones
                      </span>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                        setEditingFolder(f.id); setEditingFolderName(f.name);
                      }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm(`Excluir pasta "${f.name}"? Os ícones serão movidos para "Sem pasta".`)) {
                          deleteFolder.mutate(f.id);
                        }
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Galeria */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Galeria ({filtered.length})</CardTitle>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ícone por nome..."
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FolderChip active={activeFolder === 'all'} onClick={() => setActiveFolder('all')}>
              Todos ({icons.length})
            </FolderChip>
            {folders.map(f => {
              const c = icons.filter(ic => ic.folder_id === f.id).length;
              return (
                <FolderChip key={f.id} active={activeFolder === f.id} onClick={() => setActiveFolder(f.id)}>
                  {f.name} ({c})
                </FolderChip>
              );
            })}
            <FolderChip active={activeFolder === 'none'} onClick={() => setActiveFolder('none')}>
              Sem pasta ({icons.filter(ic => !ic.folder_id).length})
            </FolderChip>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum ícone para exibir.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
              {filtered.map(ic => (
                <IconTile
                  key={ic.id}
                  icon={ic}
                  folders={folders}
                  onUpdate={(patch) => updateIcon.mutate({ id: ic.id, ...patch })}
                  onDelete={() => {
                    if (confirm(`Excluir ícone "${ic.name}"?`)) deleteIcon.mutate(ic.id);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FolderChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function IconTile({
  icon, folders, onUpdate, onDelete,
}: {
  icon: { id: string; name: string; file_url: string; folder_id: string | null };
  folders: { id: string; name: string }[];
  onUpdate: (patch: { name?: string; folder_id?: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(icon.name);

  return (
    <div className="group relative aspect-square rounded-lg border bg-card p-2 flex flex-col">
      <img src={icon.file_url} alt={icon.name} className="flex-1 w-full object-contain min-h-0" />
      {editing ? (
        <Input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={() => { if (editName.trim() && editName !== icon.name) onUpdate({ name: editName.trim() }); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="h-6 text-[10px] mt-1 px-1"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-center truncate mt-0.5 hover:text-primary"
          title="Renomear"
        >
          {icon.name}
        </button>
      )}
      <select
        value={icon.folder_id || ''}
        onChange={e => onUpdate({ folder_id: e.target.value || null })}
        className="text-[9px] bg-transparent border rounded px-1 mt-0.5 truncate"
        title="Mover para pasta"
      >
        <option value="">Sem pasta</option>
        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      <button
        onClick={onDelete}
        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Excluir"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
