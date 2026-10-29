import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { isOverdueRequest } from '@/lib/teamAlerts';
import { todaySaoPaulo } from '@/hooks/useManagementPortfolio';

export type Person = { id: string; name: string };
type Req = { id: string; school_id: string; titulo: string; responsavel_id: string | null; prazo: string | null; status: string; observacoes: string | null };
const statusLabel: Record<string, string> = { aberto: 'Aberto', aguardando: 'Aguardando cliente', resolvido: 'Resolvido' };
const fmt = (d: string | null) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—';

function useRequests(schoolId?: string) {
  return useQuery({
    queryKey: ['client_requests', schoolId ?? 'all'],
    queryFn: async () => {
      let q = (supabase as any).from('client_requests').select('*').order('status').order('prazo', { nullsFirst: false });
      if (schoolId) q = q.eq('school_id', schoolId); else q = q.neq('status', 'resolvido');
      const { data, error } = await q; if (error) throw error; return (data ?? []) as Req[];
    },
  });
}

/** Lista de pedidos (de uma empresa, ou todos em aberto). */
export function ClientRequestsList({ schoolId, schools, people }: { schoolId?: string; schools: { id: string; nome: string }[]; people: Person[] }) {
  const qc = useQueryClient();
  const { data: reqs = [] } = useRequests(schoolId);
  const [edit, setEdit] = useState<Partial<Req> | null>(null);
  const today = todaySaoPaulo();
  const refresh = () => qc.invalidateQueries({ queryKey: ['client_requests'] });
  const save = async () => {
    if (!edit?.titulo?.trim() || !edit.school_id) { toast.error('Informe a empresa e o pedido.'); return; }
    const payload = { school_id: edit.school_id, titulo: edit.titulo.trim(), responsavel_id: edit.responsavel_id || null, prazo: edit.prazo || null, status: edit.status || 'aberto', observacoes: edit.observacoes || null };
    const { error } = edit.id ? await (supabase as any).from('client_requests').update(payload).eq('id', edit.id) : await (supabase as any).from('client_requests').insert(payload);
    if (error) { toast.error('Não foi possível salvar o pedido.'); return; }
    setEdit(null); refresh();
  };
  const del = async (id: string) => { await (supabase as any).from('client_requests').delete().eq('id', id); refresh(); };
  const nameOf = (id: string | null) => people.find(p => p.id === id)?.name ?? 'Sem responsável';
  const schoolOf = (id: string) => schools.find(s => s.id === id)?.nome ?? '';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-medium">{schoolId ? 'Pedidos do cliente' : 'Pedidos dos clientes em aberto'} ({reqs.filter(r => r.status !== 'resolvido').length})</h3><Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEdit({ school_id: schoolId, status: 'aberto' })}><Plus className="h-3.5 w-3.5" />Novo pedido</Button></div>
      {reqs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum pedido.</p>}
      <ul className="space-y-1.5">{reqs.map(r => {
        const late = isOverdueRequest(r, today);
        return <li key={r.id} className={`flex items-center gap-2 rounded-md border-l-4 bg-muted/30 px-3 py-2 text-xs ${late ? 'border-l-destructive' : r.status === 'aguardando' ? 'border-l-info' : r.status === 'resolvido' ? 'border-l-success opacity-70' : 'border-l-warning'}`}>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEdit(r)}>
            <strong className="block truncate">{!schoolId && `${schoolOf(r.school_id)} · `}{r.titulo}</strong>
            <span className="text-muted-foreground">{nameOf(r.responsavel_id)} · prazo {fmt(r.prazo)}{late ? ' · vencido' : ''} · {statusLabel[r.status]}</span>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Excluir pedido" onClick={() => del(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </li>;
      })}</ul>
      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? 'Editar pedido' : 'Novo pedido do cliente'}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            {!schoolId && <Select value={edit.school_id ?? ''} onValueChange={v => setEdit({ ...edit, school_id: v })}><SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger><SelectContent>{schools.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>}
            <Input placeholder="O que o cliente pediu" value={edit.titulo ?? ''} onChange={e => setEdit({ ...edit, titulo: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={edit.responsavel_id ?? ''} onValueChange={v => setEdit({ ...edit, responsavel_id: v })}><SelectTrigger><SelectValue placeholder="Quem atende" /></SelectTrigger><SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              <Input type="date" aria-label="Prazo" value={edit.prazo ?? ''} onChange={e => setEdit({ ...edit, prazo: e.target.value })} />
            </div>
            <Select value={edit.status ?? 'aberto'} onValueChange={v => setEdit({ ...edit, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <Textarea placeholder="Observações" value={edit.observacoes ?? ''} onChange={e => setEdit({ ...edit, observacoes: e.target.value })} />
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Contact = { nome: string; funcao: string; telefone: string; email: string };
type Profile = { contatos: Contact[]; bancos: string; sistemas: string; dia_extrato: string; observacoes: string };
const empty: Profile = { contatos: [], bancos: '', sistemas: '', dia_extrato: '', observacoes: '' };

/** Ficha da empresa + pedidos daquela empresa. */
export function SchoolProfileDialog({ school, onClose, people }: { school: { id: string; nome: string } | null; onClose: () => void; people: Person[] }) {
  const [p, setP] = useState<Profile>(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!school) return;
    setP(empty);
    (supabase as any).from('school_profile').select('*').eq('school_id', school.id).maybeSingle().then(({ data }: any) => {
      if (data) setP({ contatos: data.contatos ?? [], bancos: data.bancos ?? '', sistemas: data.sistemas ?? '', dia_extrato: data.dia_extrato ?? '', observacoes: data.observacoes ?? '' });
    });
  }, [school?.id]);
  if (!school) return null;
  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from('school_profile').upsert({ school_id: school.id, ...p, contatos: p.contatos.filter(c => c.nome || c.telefone || c.email) });
    setSaving(false);
    if (error) toast.error('Não foi possível salvar a ficha.'); else toast.success('Ficha salva.');
  };
  const setC = (i: number, k: keyof Contact, v: string) => setP({ ...p, contatos: p.contatos.map((c, j) => j === i ? { ...c, [k]: v } : c) });
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Ficha · {school.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between"><span className="font-medium">Contatos</span><Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setP({ ...p, contatos: [...p.contatos, { nome: '', funcao: '', telefone: '', email: '' }] })}><Plus className="h-3.5 w-3.5" />Contato</Button></div>
            {p.contatos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato cadastrado.</p>}
            {p.contatos.map((c, i) => <div key={i} className="mb-1.5 grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5">
              <Input placeholder="Nome" value={c.nome} onChange={e => setC(i, 'nome', e.target.value)} />
              <Input placeholder="Função" value={c.funcao} onChange={e => setC(i, 'funcao', e.target.value)} />
              <Input placeholder="Telefone" value={c.telefone} onChange={e => setC(i, 'telefone', e.target.value)} />
              <Input placeholder="E-mail" value={c.email} onChange={e => setC(i, 'email', e.target.value)} />
              <Button variant="ghost" size="icon" aria-label="Remover contato" onClick={() => setP({ ...p, contatos: p.contatos.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>)}
          </div>
          <label className="block"><span className="font-medium">Bancos e contas</span><Textarea value={p.bancos} onChange={e => setP({ ...p, bancos: e.target.value })} placeholder="Ex.: Sicredi ag. 0000 c/c 12345-6; Stone" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="font-medium">Sistemas usados</span><Input value={p.sistemas} onChange={e => setP({ ...p, sistemas: e.target.value })} placeholder="Sponte, Omni, Nibo..." /></label>
            <label className="block"><span className="font-medium">Envio do extrato combinado</span><Input value={p.dia_extrato} onChange={e => setP({ ...p, dia_extrato: e.target.value })} placeholder="Ex.: toda segunda" /></label>
          </div>
          <label className="block"><span className="font-medium">Observações</span><Textarea value={p.observacoes} onChange={e => setP({ ...p, observacoes: e.target.value })} /></label>
          <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar ficha'}</Button></div>
          <div className="border-t pt-3"><ClientRequestsList schoolId={school.id} schools={[school]} people={people} /></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
