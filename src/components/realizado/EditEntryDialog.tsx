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
  onSave: (id: string, updates: Partial<RealizedEntry>, scope: 'single' | 'all') => Promise<void>;
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

export function EditEntryDialog({ open, onOpenChange, entry, contas, onSave }: Props) {
  const [data, setData] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contaNome, setContaNome] = useState('');
  const [grupo, setGrupo] = useState('');
  const [scope, setScope] = useState<'single' | 'all'>('single');
  const [saving, setSaving] = useState(false);

  // Derive groups and children
  const groups = [...new Set(contas.filter(c => c.nivel === 1).map(c => c.grupo || c.nome))].sort();
  const children = contas.filter(c => c.nivel > 1 && (c.grupo === grupo)).map(c => c.nome).sort();

  // Only re-initialize when opening a different entry — NOT when the parent
  // re-renders and produces a new `contas` reference (that would wipe user
  // edits like the value mask, e.g. when changing the category).
  useEffect(() => {
    if (entry && open) {
      setData(entry.data || '');
      setValor(formatBRL(Number(entry.valor) || 0));
      setDescricao(entry.descricao || '');
      setContaNome(entry.conta_nome || '');
      const found = contas.find(c => c.nome === entry.conta_nome && c.nivel > 1);
      setGrupo(found?.grupo || '');
      setScope('single');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, open]);

  const isCategoryChanged = entry && contaNome !== entry.conta_nome;

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const numVal = parseBRL(valor);
      if (!isFinite(numVal) || numVal <= 0) { toast.error('Valor inválido'); setSaving(false); return; }

      await onSave(entry.id, {
        data,
        valor: numVal,
        descricao,
        conta_nome: contaNome,
      }, isCategoryChanged ? scope : 'single');
      
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
            <Input
              className="rounded-xl"
              inputMode="decimal"
              value={valor}
              onChange={e => setValor(formatBRL(parseBRL(e.target.value)))}
              onBlur={() => setValor(formatBRL(parseBRL(valor)))}
              placeholder="0,00"
            />
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

          {isCategoryChanged && (
            <div className="space-y-2 border-t pt-3 mt-3">
              <label className="text-xs font-semibold text-foreground block">Escopo da Alteração de Categoria</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="edit-scope"
                    value="single"
                    checked={scope === 'single'}
                    onChange={() => setScope('single')}
                    className="accent-primary"
                  />
                  <span>Editar apenas esse lançamento</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="edit-scope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                    className="accent-primary"
                  />
                  <span>Editar todos os lançamentos com a descrição <strong>"{entry.descricao}"</strong></span>
                </label>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl" onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
