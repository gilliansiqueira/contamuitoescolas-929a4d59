import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface RealizedEntry {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  conta_nome: string;
  conta_codigo: string;
  complemento: string;
  tipo: string;
}

interface ContaRow {
  id: string;
  nome: string;
  grupo: string;
  nivel: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: RealizedEntry | null;
  contas: ContaRow[];
  onSave: (id: string, updates: Partial<RealizedEntry>) => Promise<void>;
}

export function EditEntryDialog({ open, onOpenChange, entry, contas, onSave }: Props) {
  const [data, setData] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contaNome, setContaNome] = useState('');
  const [grupo, setGrupo] = useState('');
  const [saving, setSaving] = useState(false);

  // Derive groups and children
  const groups = [...new Set(contas.filter(c => c.nivel === 1).map(c => c.grupo || c.nome))].sort();
  const children = contas.filter(c => c.nivel > 1 && (c.grupo === grupo)).map(c => c.nome).sort();

  useEffect(() => {
    if (entry && open) {
      setData(entry.data || '');
      setValor(String(entry.valor || 0));
      setDescricao(entry.descricao || '');
      setContaNome(entry.conta_nome || '');
      // Find group for this conta_nome
      const found = contas.find(c => c.nome === entry.conta_nome && c.nivel > 1);
      setGrupo(found?.grupo || '');
    }
  }, [entry, open, contas]);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const cleanVal = valor.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      const numVal = parseFloat(cleanVal);
      if (isNaN(numVal)) { toast.error('Valor inválido'); setSaving(false); return; }

      await onSave(entry.id, {
        data,
        valor: numVal,
        descricao,
        conta_nome: contaNome,
      });
      toast.success('Lançamento atualizado');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
            <Input type="date" className="rounded-xl" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor</label>
            <Input className="rounded-xl" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Input className="rounded-xl" value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria Mãe</label>
            <Select value={grupo} onValueChange={g => { setGrupo(g); setContaNome(''); }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria Filha</label>
            <Select value={contaNome} onValueChange={setContaNome}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {children.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl" onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
