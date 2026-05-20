import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { PiggyBank, Plus, Trash2, Save, Settings } from 'lucide-react';
import { InvestimentoCard } from '@/components/InvestimentoCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  selectedMonth: string;
}

interface InvestmentRow {
  id?: string;
  school_id: string;
  month: string;
  nome: string;
  sort_order: number;
  aplicacao: number;
  resgate: number;
  rendimentos: number;
  encargos: number;
  rendimento_provisionado: number;
  saldo_inicial: number;
  saldo_final: number;
}

const FIELDS: { key: keyof InvestmentRow; label: string }[] = [
  { key: 'saldo_inicial', label: 'Saldo Inicial' },
  { key: 'aplicacao', label: 'Aplicação' },
  { key: 'resgate', label: 'Resgate' },
  { key: 'rendimentos', label: 'Rendimentos' },
  { key: 'encargos', label: 'Encargos' },
  { key: 'rendimento_provisionado', label: 'Rend. Provisionado' },
  { key: 'saldo_final', label: 'Saldo Final' },
];

function emptyRow(schoolId: string, month: string, nome: string, sort = 0): InvestmentRow {
  return {
    school_id: schoolId, month, nome, sort_order: sort,
    aplicacao: 0, resgate: 0, rendimentos: 0, encargos: 0,
    rendimento_provisionado: 0, saldo_inicial: 0, saldo_final: 0,
  };
}

function parseBR(v: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

export function InvestimentoSection({ schoolId, selectedMonth }: Props) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const targetMonth = useMemo(() => {
    if (selectedMonth === 'all') return new Date().toISOString().slice(0, 7);
    const first = selectedMonth.split(',')[0].trim();
    return first || new Date().toISOString().slice(0, 7);
  }, [selectedMonth]);

  const { data: rows = [] } = useQuery({
    queryKey: ['investment_entries', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_entries' as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order', { ascending: true })
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvestmentRow[];
    },
    enabled: !!schoolId,
  });

  // Bancos distintos, na ordem do sort_order do primeiro registro encontrado
  const banks = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (!seen.has(r.nome)) seen.set(r.nome, r.sort_order ?? 0);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([nome]) => nome);
  }, [rows]);

  // ---- Mutations ----
  const upsertOne = useMutation({
    mutationFn: async (payload: InvestmentRow) => {
      if (payload.id) {
        const { error } = await supabase.from('investment_entries' as any)
          .update(payload as any).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('investment_entries' as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] }),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_entries' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] }),
  });

  const deleteBank = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from('investment_entries' as any)
        .delete().eq('school_id', schoolId).eq('nome', nome);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] }),
  });

  const renameBank = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { error } = await supabase.from('investment_entries' as any)
        .update({ nome: to } as any).eq('school_id', schoolId).eq('nome', from);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment_entries', schoolId] }),
  });

  // ---- Add bank ----
  const [addOpen, setAddOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');

  const handleAddBank = async () => {
    const name = newBankName.trim();
    if (!name) return toast.error('Informe um nome');
    if (banks.includes(name)) return toast.error('Já existe um investimento com esse nome');
    await upsertOne.mutateAsync(emptyRow(schoolId, targetMonth, name, banks.length));
    toast.success('Investimento adicionado');
    setNewBankName('');
    setAddOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-4"
    >
      {/* Cabeçalho com ação de admin para adicionar novo card */}
      {isAdmin && (
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <PiggyBank className="w-3.5 h-3.5" /> Investimentos
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar investimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Novo investimento</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Nome do banco / investimento</label>
                <Input
                  autoFocus
                  value={newBankName}
                  onChange={e => setNewBankName(e.target.value)}
                  placeholder="Ex.: Itaú, Nubank, CDB XP..."
                  onKeyDown={e => { if (e.key === 'Enter') handleAddBank(); }}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddBank} disabled={upsertOne.isPending}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {banks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
          Nenhum investimento cadastrado.
          {isAdmin && <> Clique em <b>Adicionar investimento</b> para começar.</>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {banks.map(bank => (
            <div key={bank} className="relative">
              <InvestimentoCard schoolId={schoolId} selectedMonth={selectedMonth} bankName={bank} />
              {isAdmin && (
                <BankAdminControls
                  bank={bank}
                  schoolId={schoolId}
                  targetMonth={targetMonth}
                  rows={rows.filter(r => r.nome === bank)}
                  onUpsert={(p) => upsertOne.mutateAsync(p)}
                  onDeleteRow={(id) => deleteRow.mutateAsync(id)}
                  onDeleteBank={() => deleteBank.mutateAsync(bank)}
                  onRename={(to) => renameBank.mutateAsync({ from: bank, to })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---------- Admin controls (gear + delete) per bank card ----------
function BankAdminControls({
  bank, schoolId, targetMonth, rows,
  onUpsert, onDeleteRow, onDeleteBank, onRename,
}: {
  bank: string;
  schoolId: string;
  targetMonth: string;
  rows: InvestmentRow[];
  onUpsert: (p: InvestmentRow) => Promise<void>;
  onDeleteRow: (id: string) => Promise<void>;
  onDeleteBank: () => Promise<void>;
  onRename: (to: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editMonth, setEditMonth] = useState(targetMonth);
  useEffect(() => setEditMonth(targetMonth), [targetMonth]);

  const [name, setName] = useState(bank);
  useEffect(() => setName(bank), [bank]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>(rows.map(r => r.month));
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort();
  }, [rows]);

  const rowForMonth = useMemo(() => rows.find(r => r.month === editMonth), [rows, editMonth]);
  const [draft, setDraft] = useState<InvestmentRow>(
    rowForMonth ?? emptyRow(schoolId, editMonth, bank, 0)
  );
  useEffect(() => {
    setDraft(rowForMonth ?? emptyRow(schoolId, editMonth, bank, 0));
  }, [rowForMonth, editMonth, bank, schoolId]);

  const handleSave = async () => {
    try {
      await onUpsert({ ...draft, nome: bank, month: editMonth, school_id: schoolId });
      toast.success('Salvo');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleRename = async () => {
    const to = name.trim();
    if (!to || to === bank) return;
    try {
      await onRename(to);
      toast.success('Renomeado');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            className="p-2 rounded-full bg-background/60 hover:bg-background/90 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
            title="Editar investimento (admin)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4" /> Editar: {bank}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground">Nome do banco</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
              </div>
              <Button size="sm" variant="outline" onClick={handleRename} disabled={name.trim() === bank}>
                Renomear
              </Button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Mês:</span>
              <Select value={editMonth} onValueChange={setEditMonth}>
                <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {monthOptions.map(m => (
                    <SelectItem key={m} value={m}>{m.split('-').reverse().join('/')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.id && (
                <Button size="sm" variant="ghost" className="text-destructive ml-auto"
                  onClick={async () => {
                    if (!draft.id) return;
                    await onDeleteRow(draft.id);
                    toast.success('Mês removido');
                  }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir este mês
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(f => (
                <div key={f.key as string}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String((draft as any)[f.key] ?? '')}
                    onChange={e => setDraft(d => ({ ...d, [f.key]: parseBR(e.target.value) } as InvestmentRow))}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={handleSave}>
              <Save className="w-3.5 h-3.5 mr-1" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="p-2 rounded-full bg-background/60 hover:bg-destructive/15 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-destructive transition-colors"
            title="Remover investimento"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{bank}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto irá apagar todos os registros mensais deste investimento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                await onDeleteBank();
                toast.success('Investimento removido');
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
