import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { filterTasks, isOverdue, memberName, type MgmtTask, type MgmtTaskStatus, type MgmtView } from '@/lib/mgmtTasks';

const db = supabase as any;
const STATUS_LABEL: Record<MgmtTaskStatus, string> = { pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída' };
const fmtDate = (d: string | null) => d ? d.slice(0, 10).split('-').reverse().join('/') : '';
const todayIso = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export function MgmtTasks() {
  const { user } = useAuth() as any;
  const me: string = user?.id ?? '';
  const qc = useQueryClient();
  const [view, setView] = useState<MgmtView>('minhas');
  const [assignee, setAssignee] = useState('all');
  const [school, setSchool] = useState('all');
  const [editing, setEditing] = useState<Partial<MgmtTask> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({ queryKey: ['mgmtMembers'], queryFn: async () => (await db.rpc('mgmt_task_members')).data ?? [] });
  const { data: schools = [] } = useQuery({ queryKey: ['mgmtSchools'], queryFn: async () => (await db.from('schools').select('id,nome').eq('ativo', true).order('nome')).data ?? [] });
  const { data: tasks = [] } = useQuery({ queryKey: ['mgmtTasks'], queryFn: async () => (await db.from('mgmt_tasks').select('*')).data ?? [] });
  const { data: comments = [] } = useQuery({ queryKey: ['mgmtComments'], queryFn: async () => (await db.from('mgmt_task_comments').select('*').order('created_at')).data ?? [] });

  const emailOf = (id: string) => (members as any[]).find(m => m.user_id === id)?.email;
  const schoolOf = (id: string | null) => (schools as any[]).find(s => s.id === id)?.nome;
  const list = useMemo(() => filterTasks(tasks as MgmtTask[], view, me, assignee, school), [tasks, view, me, assignee, school]);
  const today = todayIso();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['mgmtTasks'] }); qc.invalidateQueries({ queryKey: ['mgmtComments'] }); };

  const save = async () => {
    if (!editing?.title?.trim() || !editing.assignee_id) { toast.error('Preencha o título e a responsável.'); return; }
    const row = { title: editing.title.trim(), description: editing.description || null, school_id: editing.school_id || null, assignee_id: editing.assignee_id, due_date: editing.due_date || null, status: editing.status ?? 'pendente' };
    const { error } = editing.id ? await db.from('mgmt_tasks').update(row).eq('id', editing.id) : await db.from('mgmt_tasks').insert(row);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    setEditing(null); refresh();
  };
  const setStatus = async (t: MgmtTask, status: MgmtTaskStatus) => { await db.from('mgmt_tasks').update({ status }).eq('id', t.id); refresh(); };
  const remove = async (t: MgmtTask) => { if (!confirm('Excluir esta tarefa?')) return; await db.from('mgmt_tasks').delete().eq('id', t.id); setEditing(null); refresh(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Tarefas</h2>
        <Button onClick={() => setEditing({ assignee_id: me, status: 'pendente' })}><Plus className="h-4 w-4 mr-1" />Nova tarefa</Button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Tabs value={view} onValueChange={v => setView(v as MgmtView)}>
          <TabsList><TabsTrigger value="minhas">Minhas</TabsTrigger><TabsTrigger value="todas">Todas</TabsTrigger><TabsTrigger value="concluidas">Concluídas</TabsTrigger></TabsList>
        </Tabs>
        <Select value={assignee} onValueChange={setAssignee}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as pessoas</SelectItem>{(members as any[]).map(m => <SelectItem key={m.user_id} value={m.user_id}>{memberName(m.email)}</SelectItem>)}</SelectContent></Select>
        <Select value={school} onValueChange={setSchool}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as empresas</SelectItem><SelectItem value="none">Sem empresa</SelectItem>{(schools as any[]).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>
      </div>

      {list.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa aqui.</p>}
      <div className="space-y-2">
        {list.map(t => {
          const late = isOverdue(t, today);
          const cs = (comments as any[]).filter(c => c.task_id === t.id);
          return (
            <div key={t.id} className={`rounded-lg border bg-card p-3 ${late ? 'border-destructive' : ''}`}>
              <div className="flex flex-wrap items-start gap-2">
                <button className="flex-1 min-w-[200px] text-left" onClick={() => setEditing(t)}>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {schoolOf(t.school_id) && <span>{schoolOf(t.school_id)}</span>}
                    <span>Responsável: {memberName(emailOf(t.assignee_id))}</span>
                    <span>Criada por {memberName(emailOf(t.created_by))} em {fmtDate(t.created_at)}</span>
                    {t.completed_at && <span>Concluída em {fmtDate(t.completed_at)}</span>}
                  </div>
                </button>
                {t.due_date && <Badge variant={late ? 'destructive' : 'outline'}>{late ? 'Atrasada · ' : 'Prazo '}{fmtDate(t.due_date)}</Badge>}
                <Select value={t.status} onValueChange={v => setStatus(t, v as MgmtTaskStatus)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(STATUS_LABEL) as MgmtTaskStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select>
                <Button variant="ghost" size="sm" onClick={() => setOpenId(openId === t.id ? null : t.id)}><MessageSquare className="h-4 w-4 mr-1" />{cs.length}</Button>
              </div>
              {t.description && <p className="text-sm mt-1 whitespace-pre-wrap">{t.description}</p>}
              {openId === t.id && <Comments taskId={t.id} items={cs} me={me} nameOf={id => memberName(emailOf(id))} onChange={refresh} />}
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle></DialogHeader>
          {editing && <div className="space-y-3">
            <Input placeholder="O que precisa ser feito?" value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            <Textarea placeholder="Detalhes (opcional)" value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            <Select value={editing.school_id ?? 'none'} onValueChange={v => setEditing({ ...editing, school_id: v === 'none' ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem empresa</SelectItem>{(schools as any[]).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>
            <Select value={editing.assignee_id} onValueChange={v => setEditing({ ...editing, assignee_id: v })}><SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>{(members as any[]).map(m => <SelectItem key={m.user_id} value={m.user_id}>{memberName(m.email)}</SelectItem>)}</SelectContent></Select>
            <label className="text-sm block">Prazo (opcional)<Input type="date" value={editing.due_date ?? ''} onChange={e => setEditing({ ...editing, due_date: e.target.value })} /></label>
          </div>}
          <DialogFooter className="gap-2">
            {editing?.id && <Button variant="ghost" onClick={() => remove(editing as MgmtTask)}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>}
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Comments({ taskId, items, me, nameOf, onChange }: { taskId: string; items: any[]; me: string; nameOf: (id: string) => string; onChange: () => void }) {
  const [text, setText] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    const { error } = await db.from('mgmt_task_comments').insert({ task_id: taskId, body: text.trim() });
    if (error) { toast.error('Não foi possível enviar.'); return; }
    setText(''); onChange();
  };
  return (
    <div className="mt-3 border-t pt-2 space-y-2">
      {items.map(c => (
        <div key={c.id} className="text-sm flex gap-2">
          <span className="font-medium">{nameOf(c.user_id)}</span>
          <span className="text-muted-foreground text-xs pt-0.5">{fmtDate(c.created_at)}</span>
          <span className="flex-1 whitespace-pre-wrap">{c.body}</span>
          {c.user_id === me && <button className="text-xs text-muted-foreground" onClick={async () => { await db.from('mgmt_task_comments').delete().eq('id', c.id); onChange(); }}>apagar</button>}
        </div>
      ))}
      <div className="flex gap-2"><Input placeholder="Escreva um andamento…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} /><Button size="sm" onClick={send}>Enviar</Button></div>
    </div>
  );
}
