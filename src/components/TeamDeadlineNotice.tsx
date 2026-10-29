import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, Settings, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deadlineParts, todaySP } from '@/lib/teamDeadlines';

type Ann = { id: string; titulo: string; ativo: boolean; team_announcement_deadlines: { id: string; rotulo: string; data: string; ordem: number }[] };

export function TeamDeadlineNotice() {
  const { user, isAdmin, canManageCollaborators } = useAuth() as any;
  const qc = useQueryClient();
  const today = todaySP();
  const [popup, setPopup] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: anns = [] } = useQuery({
    queryKey: ['team_announcements'],
    enabled: !!isAdmin,
    refetchInterval: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('team_announcements')
        .select('id,titulo,ativo,team_announcement_deadlines(id,rotulo,data,ordem)').order('created_at');
      if (error) throw error;
      return (data ?? []) as Ann[];
    },
  });

  const active = anns.filter(a => a.ativo).map(a => ({
    ...a,
    parts: deadlineParts([...a.team_announcement_deadlines].sort((x, y) => x.ordem - y.ordem), today),
  })).filter(a => a.parts.length > 0);

  useEffect(() => {
    if (!user?.id || active.length === 0) return;
    supabase.from('team_announcement_dismissals').select('dia').eq('user_id', user.id).eq('dia', today).maybeSingle()
      .then(({ data }) => { if (!data) setPopup(true); });
  }, [user?.id, today, active.length]);

  if (!isAdmin) return null;

  const dismiss = async () => {
    setPopup(false);
    await supabase.from('team_announcement_dismissals').upsert({ user_id: user.id, dia: today });
  };

  const sentence = (a: (typeof active)[number]) => {
    const t = a.parts.map(p => p.texto);
    const joined = t.length > 1 ? `${t.slice(0, -1).join(', ')} e ${t[t.length - 1]}` : t[0];
    return `${a.titulo} ${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
  };

  return (
    <>
      {active.map(a => (
        <div key={a.id} className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-md">
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
          <span className="text-center">{sentence(a)}</span>
          {canManageCollaborators && (
            <button onClick={() => setEditing(true)} aria-label="Gerenciar avisos" className="opacity-80 hover:opacity-100"><Settings className="h-4 w-4" /></button>
          )}
        </div>
      ))}
      {active.length === 0 && canManageCollaborators && (
        <Button size="sm" variant="outline" className="fixed bottom-4 left-4 z-50" onClick={() => setEditing(true)}>
          <AlertTriangle className="mr-1 h-4 w-4" /> Avisos da equipe
        </Button>
      )}

      <Dialog open={popup} onOpenChange={o => !o && dismiss()}>
        <DialogContent className="border-4 border-accent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl text-accent"><AlertTriangle className="h-7 w-7" /> Prazos de entrega</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                {active.map(a => (
                  <div key={a.id} className="space-y-2">
                    <p className="text-base font-semibold text-foreground">{a.titulo}</p>
                    {a.parts.map(p => (
                      <div key={p.rotulo} className="rounded-md bg-accent/10 p-3 text-base text-foreground">
                        <span className="text-2xl font-bold text-accent">{p.dias === 0 ? 'HOJE' : `${p.dias} dia${p.dias > 1 ? 's' : ''}`}</span>
                        <span className="ml-2">— {p.rotulo} ({p.data.slice(8, 10)}/{p.data.slice(5, 7)})</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={dismiss}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && <AnnouncementEditor anns={anns} onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['team_announcements'] }); }} userId={user?.id} />}
    </>
  );
}

function AnnouncementEditor({ anns, onClose, userId }: { anns: Ann[]; onClose: () => void; userId?: string }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['team_announcements'] });
  const run = async (p: PromiseLike<{ error: any }>) => { const { error } = await p; if (error) toast.error('Não foi possível salvar: ' + error.message); refresh(); };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Avisos da equipe</DialogTitle><DialogDescription>Os prazos vencidos somem sozinhos do aviso.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {anns.map(a => (
            <div key={a.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Input defaultValue={a.titulo} onBlur={e => e.target.value !== a.titulo && run(supabase.from('team_announcements').update({ titulo: e.target.value }).eq('id', a.id))} />
                <Switch checked={a.ativo} onCheckedChange={v => run(supabase.from('team_announcements').update({ ativo: v }).eq('id', a.id))} />
                <Button size="icon" variant="ghost" aria-label="Excluir aviso" onClick={() => confirm('Excluir este aviso?') && run(supabase.from('team_announcements').delete().eq('id', a.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {[...a.team_announcement_deadlines].sort((x, y) => x.ordem - y.ordem).map(d => (
                <div key={d.id} className="flex items-center gap-2 pl-4">
                  <Input defaultValue={d.rotulo} placeholder="ex.: as projeções" onBlur={e => e.target.value !== d.rotulo && run(supabase.from('team_announcement_deadlines').update({ rotulo: e.target.value }).eq('id', d.id))} />
                  <Input type="date" className="w-44" defaultValue={d.data} onBlur={e => e.target.value && e.target.value !== d.data && run(supabase.from('team_announcement_deadlines').update({ data: e.target.value }).eq('id', d.id))} />
                  <Button size="icon" variant="ghost" aria-label="Excluir prazo" onClick={() => run(supabase.from('team_announcement_deadlines').delete().eq('id', d.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="ml-4" onClick={() => run(supabase.from('team_announcement_deadlines').insert({ announcement_id: a.id, rotulo: 'novo prazo', data: todaySP(), ordem: a.team_announcement_deadlines.length }))}>
                <Plus className="mr-1 h-4 w-4" /> Prazo
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => run(supabase.from('team_announcements').insert({ titulo: '🚨 Atenção equipe!', created_by: userId }))}><Plus className="mr-1 h-4 w-4" /> Novo aviso</Button>
        </div>
        <DialogFooter><Button onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
