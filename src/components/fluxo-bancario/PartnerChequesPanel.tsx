import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSchoolModelItems, useInvalidateBank } from '@/hooks/useBankPilot';
import { fmtBRL, fmtDate, todayIso } from './shared';
import { Trash2, Users } from 'lucide-react';

const db = supabase as any;

/** Valor em formato brasileiro (1.500,50) ou com ponto decimal. */
function parseBRL(s: string): number {
  const t = s.trim().replace(/[R$\s]/g, '');
  if (!t) return NaN;
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(n);
}

interface PairRow { manual_pair_id: string; data: string; descricao: string; valor: number; tipo: string; recon_note: string | null }

export function PartnerChequesPanel({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const invalidate = useInvalidateBank(schoolId);
  const { toast } = useToast();
  const { data: items = [] } = useSchoolModelItems(schoolId);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(todayIso());
  const [valor, setValor] = useState('');
  const [socio, setSocio] = useState('');
  const [nota, setNota] = useState('');
  const entradas = items.filter(i => i.tipo === 'entrada');
  const saidas = items.filter(i => i.tipo === 'saida');
  const defIn = entradas.find(i => /^receitas?$/i.test(i.name))?.id ?? '';
  const defOut = saidas.find(i => /^pr[oó][-\s]?labore$/i.test(i.name))?.id ?? '';
  const [inItem, setInItem] = useState('');
  const [outItem, setOutItem] = useState('');
  const inSel = inItem || defIn;
  const outSel = outItem || defOut;
  const v = parseBRL(valor);

  const { data: rows = [] } = useQuery({
    queryKey: ['partnerCheques', schoolId],
    queryFn: async () => {
      const { data, error } = await db.from('bank_transactions').select('manual_pair_id, data, descricao, valor, tipo, recon_note')
        .eq('school_id', schoolId).not('manual_pair_id', 'is', null).order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PairRow[];
    },
  });
  const pairs = useMemo(() => rows.filter(r => r.tipo === 'entrada'), [rows]);

  const refresh = () => { invalidate(); qc.invalidateQueries({ queryKey: ['partnerCheques', schoolId] }); qc.invalidateQueries({ queryKey: ['entries'] }); };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc('create_partner_cheque_pair', { _school_id: schoolId, _data: data, _valor: v, _socio: socio, _nota: nota, _in_item: inSel, _out_item: outSel });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setOpen(false); setValor(''); setNota(''); toast({ title: 'Lançado', description: 'Entrada e saída gravadas; saldo dos bancos não mudou.' }); },
    onError: (e: any) => toast({ title: 'Não foi possível lançar', description: e.message, variant: 'destructive' }),
  });
  const remove = useMutation({
    mutationFn: async (pairId: string) => {
      const motivo = window.prompt('Motivo da exclusão (entrada e saída serão apagadas juntas):');
      if (!motivo?.trim()) throw new Error('Exclusão cancelada: informe o motivo.');
      const { error } = await db.rpc('delete_partner_cheque_pair', { _pair_id: pairId, _motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: 'Excluído', description: 'Entrada e saída removidas.' }); },
    onError: (e: any) => toast({ title: 'Não excluído', description: e.message, variant: 'destructive' }),
  });

  const nameOf = (id: string) => items.find(i => i.id === id)?.name ?? '—';
  const ok = v > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data) && !!inSel && !!outSel;

  return (
    <div className="mb-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Cheques depositados pelos sócios</p>
          <p className="text-xs text-muted-foreground">Lança a entrada (receita) e a saída (pró-labore) do mesmo valor. Efeito no saldo dos bancos: R$ 0,00.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>Lançar cheques dos sócios</Button>
      </div>
      {pairs.length > 0 && (
        <div className="mt-3 divide-y text-sm">
          {pairs.map(p => (
            <div key={p.manual_pair_id} className="flex items-center justify-between gap-2 py-2">
              <span>{fmtDate(p.data)} · {p.descricao}{p.recon_note ? ` · ${p.recon_note}` : ''}</span>
              <span className="flex items-center gap-3 tabular-nums">+{fmtBRL(p.valor)} / −{fmtBRL(p.valor)}
                <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => remove.mutate(p.manual_pair_id)}><Trash2 className="h-4 w-4" /></Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cheques depositados pelos sócios</DialogTitle>
            <DialogDescription>Grava duas linhas iguais: uma entrada e uma saída. Não muda o saldo de nenhum banco.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} /></div>
              <div><Label>Valor (R$)</Label><Input inputMode="decimal" placeholder="20.535,76" value={valor} onChange={e => setValor(e.target.value)} /></div>
            </div>
            <div><Label>Sócio</Label><Input placeholder="Marta, Ariel ou ambos" value={socio} onChange={e => setSocio(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Entrada como</Label>
                <Select value={inSel} onValueChange={setInItem}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{entradas.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Saída como</Label>
                <Select value={outSel} onValueChange={setOutItem}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{saidas.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Observação</Label><Input value={nota} onChange={e => setNota(e.target.value)} /></div>
            {v > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>Entrada ({nameOf(inSel)}): +{fmtBRL(v)}</p>
                <p>Saída ({nameOf(outSel)}): −{fmtBRL(v)}</p>
                <p className="font-medium">Efeito no saldo dos bancos: {fmtBRL(0)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!ok || create.isPending} onClick={() => create.mutate()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
