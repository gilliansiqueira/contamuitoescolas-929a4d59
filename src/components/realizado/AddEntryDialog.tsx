import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ContaRow {
  id: string;
  nome: string;
  grupo: string;
  nivel: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contas: ContaRow[];
  onSave: (entry: {
    data: string;
    valor: number;
    descricao: string;
    conta_nome: string;
    conta_codigo?: string;
  }) => Promise<void>;
}

function formatBRL(num: number) {
  if (!isFinite(num)) num = 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(s: string) {
  const digits = (s || '').replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function AddEntryDialog({ open, onOpenChange, contas, onSave }: Props) {
  const [data, setData] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contaNome, setContaNome] = useState('');
  const [grupo, setGrupo] = useState('');
  const [saving, setSaving] = useState(false);

  // Derive groups and children
  const groups = [...new Set(contas.filter(c => c.nivel === 1).map(c => c.grupo || c.nome))].sort();
  const children = contas.filter(c => c.nivel > 1 && (c.grupo === grupo)).map(c => c.nome).sort();

  // Reset fields when opening
  useEffect(() => {
    if (open) {
      // Set to today's date in local time YYYY-MM-DD
      const today = new Date();
      const offset = today.getTimezoneOffset();
      const localToday = new Date(today.getTime() - (offset*60*1000));
      setData(localToday.toISOString().slice(0, 10));
      
      setValor('');
      setDescricao('');
      setContaNome('');
      setGrupo('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!data) { toast.error('Data é obrigatória'); return; }
    if (!descricao.trim()) { toast.error('Descrição é obrigatória'); return; }
    const numVal = parseBRL(valor);
    if (!isFinite(numVal) || numVal <= 0) { toast.error('Valor inválido. Deve ser maior que zero.'); return; }
    if (!grupo) { toast.error('Categoria Mãe é obrigatória'); return; }
    if (!contaNome) { toast.error('Categoria é obrigatória'); return; }

    setSaving(true);
    try {
      const selectedConta = contas.find(c => c.nome === contaNome && c.nivel > 1);
      await onSave({
        data,
        valor: numVal,
        descricao,
        conta_nome: contaNome,
        conta_codigo: selectedConta?.id || '',
      });
      toast.success('Lançamento manual criado');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar lançamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data *</label>
            <Input type="date" className="rounded-xl" value={data} onChange={e => setData(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição *</label>
            <Input className="rounded-xl" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do lançamento" required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor *</label>
            <Input
              className="rounded-xl"
              inputMode="decimal"
              value={valor}
              onChange={e => setValor(formatBRL(parseBRL(e.target.value)))}
              onBlur={() => setValor(formatBRL(parseBRL(valor)))}
              placeholder="0,00"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria Mãe *</label>
            <Select value={grupo} onValueChange={g => { setGrupo(g); setContaNome(''); }} required>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria Filha *</label>
            <Select value={contaNome} onValueChange={setContaNome} disabled={!grupo} required>
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
