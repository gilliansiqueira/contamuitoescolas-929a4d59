import { Suspense, lazy, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamTimePanel } from '@/components/team/TeamTimePanel';
import { BenefitsTab } from '@/components/team/BenefitsTab';
import { ClientRequestsList, type Person } from '@/components/team/ClientService';
import type { PortfolioRow } from '@/hooks/useManagementPortfolio';

const UsersConfig = lazy(() => import('@/components/UsersConfig').then(m => ({ default: m.UsersConfig })));
const db = supabase as any;

interface Props { schools: { id: string; nome: string }[]; people: Person[]; rows: PortfolioRow[]; canViewTeamTime: boolean }

export function TeamHub({ schools, people, rows, canViewTeamTime }: Props) {
  const { isSuperAdmin } = useAuth() as any;
  const def = canViewTeamTime ? 'ponto' : 'usuarios';
  return (
    <Tabs defaultValue={def} className="space-y-4">
      <div><h1 className="text-2xl font-medium">Equipe</h1></div>
      <TabsList className="flex-wrap">
        {canViewTeamTime && <TabsTrigger value="ponto">Ponto</TabsTrigger>}
        {canViewTeamTime && <TabsTrigger value="beneficios">Benefícios e holerites</TabsTrigger>}
        <TabsTrigger value="usuarios">Usuários e carteiras</TabsTrigger>
        <TabsTrigger value="meudia">Meu Dia, pedidos e avisos</TabsTrigger>
      </TabsList>
      {canViewTeamTime && <TabsContent value="ponto"><TeamTimePanel /></TabsContent>}
      {canViewTeamTime && <TabsContent value="beneficios"><BenefitsTab /></TabsContent>}
      <TabsContent value="usuarios" className="space-y-5">
        <PortfolioTransfer rows={rows} people={people} />
        <section className="rounded-lg border border-border bg-card p-3.5">
          <h2 className="mb-2 text-sm font-medium">Usuários e acessos</h2>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}><UsersConfig /></Suspense>
        </section>
      </TabsContent>
      <TabsContent value="meudia" className="space-y-5">
        <DailyTaskTemplates schools={schools} canEdit={!!isSuperAdmin} />
        <section className="rounded-lg border border-border bg-card p-3.5"><ClientRequestsList schools={schools} people={people} /></section>
        <p className="text-[11px] text-muted-foreground">Os avisos de prazo são editados pelo botão de engrenagem na faixa do aviso (ou "Avisos da equipe" no canto da tela).</p>
      </TabsContent>
    </Tabs>
  );
}

function PortfolioTransfer({ rows, people }: { rows: PortfolioRow[]; people: Person[] }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => r.responsible_user_id && m.set(r.responsible_user_id, (m.get(r.responsible_user_id) ?? 0) + 1)); return m; }, [rows]);
  const list = rows.filter(r => r.responsible_user_id === from);
  const go = async () => {
    setBusy(true);
    const { error } = await db.rpc('transfer_portfolio', { _from: from, _to: to, _school_ids: [...sel] });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${sel.size} empresa(s) transferida(s).`); setSel(new Set()); qc.invalidateQueries({ queryKey: ['management-portfolio'] });
  };
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <h2 className="text-sm font-medium">Carteiras</h2>
      <div className="flex flex-wrap gap-2 text-xs">{people.map(p => <span key={p.id} className="rounded-full bg-muted px-2.5 py-1">{p.name}: {counts.get(p.id) ?? 0}</span>)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={from} onValueChange={v => { setFrom(v); setSel(new Set()); }}><SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="De quem" /></SelectTrigger><SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
        <span className="text-xs">para</span>
        <Select value={to} onValueChange={setTo}><SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Para quem" /></SelectTrigger><SelectContent>{people.filter(p => p.id !== from).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
        <Button size="sm" disabled={!from || !to || !sel.size || busy} onClick={go}>Transferir {sel.size || ''}</Button>
      </div>
      {from && <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{list.map(r => (
        <label key={r.school_id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sel.has(r.school_id)} onChange={e => { const n = new Set(sel); e.target.checked ? n.add(r.school_id) : n.delete(r.school_id); setSel(n); }} />{r.school_name}</label>
      ))}</div>}
    </section>
  );
}

type Tpl = { id: string; task_key: string; label: string; sort_order: number; active: boolean; school_ids: string[] | null; due_time: string | null; weekdays_only: boolean };

function DailyTaskTemplates({ schools, canEdit }: { schools: { id: string; nome: string }[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['daily-task-templates'], queryFn: async () => { const { data, error } = await db.from('daily_task_templates').select('*').order('sort_order'); if (error) throw error; return data as Tpl[]; } });
  const run = async (p: PromiseLike<{ error: any }>) => { const { error } = await p; if (error) toast.error('Não foi possível salvar.'); qc.invalidateQueries({ queryKey: ['daily-task-templates'] }); };
  const name = new Map(schools.map(s => [s.id, s.nome]));
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-3.5">
      <h2 className="text-sm font-medium">Tarefas do Meu Dia</h2>
      <p className="text-[11px] text-muted-foreground">Sem empresa escolhida, a tarefa vale para todas. Com empresas, acompanha a carteira de quem for responsável.</p>
      {data.map(t => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-xs">
          <Input className="h-8 min-w-[16rem] flex-1 text-xs" disabled={!canEdit} defaultValue={t.label} onBlur={e => e.target.value !== t.label && run(db.from('daily_task_templates').update({ label: e.target.value }).eq('id', t.id))} />
          <Input type="time" className="h-8 w-28 text-xs" disabled={!canEdit} defaultValue={t.due_time?.slice(0, 5) ?? ''} onBlur={e => run(db.from('daily_task_templates').update({ due_time: e.target.value || null }).eq('id', t.id))} />
          <label className="flex items-center gap-1">Seg–sex <Switch checked={t.weekdays_only} disabled={!canEdit} onCheckedChange={v => run(db.from('daily_task_templates').update({ weekdays_only: v }).eq('id', t.id))} /></label>
          <label className="flex items-center gap-1">Ativa <Switch checked={t.active} disabled={!canEdit} onCheckedChange={v => run(db.from('daily_task_templates').update({ active: v }).eq('id', t.id))} /></label>
          <Select value="" disabled={!canEdit} onValueChange={v => run(db.from('daily_task_templates').update({ school_ids: [...(t.school_ids ?? []), v] }).eq('id', t.id))}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="+ empresa" /></SelectTrigger>
            <SelectContent>{schools.filter(s => !t.school_ids?.includes(s.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
          </Select>
          {t.school_ids?.map(id => <button key={id} type="button" disabled={!canEdit} className="rounded-full bg-muted px-2 py-0.5" onClick={() => { const n = t.school_ids!.filter(x => x !== id); run(db.from('daily_task_templates').update({ school_ids: n.length ? n : null }).eq('id', t.id)); }}>{name.get(id) ?? 'Empresa'} ×</button>)}
          {canEdit && <Button size="icon" variant="ghost" aria-label="Excluir tarefa" onClick={() => confirm('Excluir esta tarefa?') && run(db.from('daily_task_templates').delete().eq('id', t.id))}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      ))}
      {canEdit && <Button size="sm" variant="outline" onClick={() => run(db.from('daily_task_templates').insert({ task_key: `t_${Date.now()}`, label: 'Nova tarefa', sort_order: data.length + 1 }))}><Plus className="mr-1 h-4 w-4" />Tarefa</Button>}
    </section>
  );
}
