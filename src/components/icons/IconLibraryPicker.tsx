import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon, X, Search } from 'lucide-react';
import { useIconLibrary, useIconFolders } from './useIconLibrary';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function IconLibraryPicker({ value, onChange, size = 'sm' }: Props) {
  const { data: icons = [] } = useIconLibrary();
  const { data: folders = [] } = useIconFolders();
  const [search, setSearch] = useState('');
  const [folderId, setFolderId] = useState<string | 'all' | 'none'>('all');

  const dim =
    size === 'sm' ? 'w-8 h-8' :
    size === 'md' ? 'w-10 h-10' :
    'w-14 h-14';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return icons.filter(ic => {
      if (folderId === 'none' && ic.folder_id) return false;
      if (folderId !== 'all' && folderId !== 'none' && ic.folder_id !== folderId) return false;
      if (!q) return true;
      return ic.name.toLowerCase().includes(q);
    });
  }, [icons, search, folderId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${dim} rounded-md border bg-background hover:bg-muted flex items-center justify-center overflow-hidden shrink-0`}
          title="Escolher ícone"
        >
          {value ? (
            <img src={value} alt="ícone" className="w-full h-full object-contain p-0.5" />
          ) : (
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Biblioteca de ícones</p>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="h-7 text-xs">
              <X className="w-3 h-3 mr-1" /> Remover
            </Button>
          )}
        </div>

        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ícone..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        {folders.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2 max-h-16 overflow-y-auto">
            <FolderChip active={folderId === 'all'} onClick={() => setFolderId('all')}>Todos</FolderChip>
            {folders.map(f => (
              <FolderChip key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)}>
                {f.name}
              </FolderChip>
            ))}
            <FolderChip active={folderId === 'none'} onClick={() => setFolderId('none')}>Sem pasta</FolderChip>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            {icons.length === 0
              ? 'Nenhum ícone na biblioteca. Admin: faça upload em Configurações → Ícones.'
              : 'Nenhum ícone encontrado.'}
          </p>
        ) : (
          <div className="grid grid-cols-6 gap-1.5 max-h-56 overflow-y-auto">
            {filtered.map(ic => (
              <button
                key={ic.id}
                type="button"
                onClick={() => onChange(ic.file_url)}
                className={`aspect-square rounded-md border p-1 hover:bg-muted transition-colors ${
                  value === ic.file_url ? 'border-primary ring-2 ring-primary/30' : ''
                }`}
                title={ic.name}
              >
                <img src={ic.file_url} alt={ic.name} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FolderChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}
