import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ImageIcon, X } from 'lucide-react';
import { useSAIcons } from './useSAIcons';

interface Props {
  schoolId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  size?: 'sm' | 'md';
}

export function IconPicker({ schoolId, value, onChange, size = 'sm' }: Props) {
  const { data: icons = [] } = useSAIcons(schoolId);
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

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
      <PopoverContent className="w-72 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Galeria de ícones</p>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="h-7 text-xs">
              <X className="w-3 h-3 mr-1" /> Remover
            </Button>
          )}
        </div>
        {icons.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nenhum ícone na galeria. Faça upload em <strong>Cadastros → Ícones</strong>.
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto">
            {icons.map(ic => (
              <button
                key={ic.id}
                type="button"
                onClick={() => onChange(ic.file_url)}
                className={`aspect-square rounded-md border p-1 hover:bg-muted transition-colors ${
                  value === ic.file_url ? 'border-primary ring-2 ring-primary/30' : ''
                }`}
                title={ic.name + (ic.is_global ? ' (global)' : '')}
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
