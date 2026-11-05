import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown } from 'lucide-react';

interface Props {
  value: string; // nome, '__new__' ou ''
  modelItems: { id: string; name: string }[];
  categorias: { id: string; nome: string; grupo: string }[];
  onChange: (v: string) => void;
}

export function CategoryPicker({ value, modelItems, categorias, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const label = value === '__new__'
    ? '+ Criar nova categoria'
    : value
      ? (categorias.find(c => c.nome === value) ? `${categorias.find(c => c.nome === value)!.grupo} → ${value}` : value)
      : 'Escolher...';
  const pick = (v: string) => { onChange(v); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-8 text-xs flex-1 justify-between rounded-lg font-normal min-w-0">
          <span className={`truncate ${value ? '' : 'text-muted-foreground'}`}>{label}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Digite para buscar..." className="h-9 text-xs" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__new__ criar nova categoria" onSelect={() => pick('__new__')} className="text-xs">+ Criar nova categoria</CommandItem>
            </CommandGroup>
            {modelItems.length > 0 && (
              <CommandGroup heading="Modelo Financeiro">
                {modelItems.map(it => (
                  <CommandItem key={`m-${it.id}`} value={`m ${it.name}`} onSelect={() => pick(it.name)} className="text-xs">★ {it.name}</CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Plano de Contas">
              {categorias.map(c => (
                <CommandItem key={c.id} value={`${c.grupo} ${c.nome} ${c.id}`} onSelect={() => pick(c.nome)} className="text-xs">{c.grupo} → {c.nome}</CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
