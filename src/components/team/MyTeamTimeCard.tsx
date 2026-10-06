import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyTeamTime, useSaveJustification, type TeamDaily, type TeamJustification } from '@/hooks/useTeamTime';
import { classifyDay, hhmmToMin, minToHhmm } from './TeamTimePanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock3, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';

const spToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const fmtDate = (d: string) => d.split('-').reverse().join('/');
const fmtDateTime = (iso?: string | null) => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
const ST_LABEL: Record<TeamJustification['status'], string> = { pendente: 'Justificativa enviada', aceita: 'Justificativa aceita', recusada: 'Justificativa recusada' };
const ST_STYLE: Record<TeamJustification['status'], string> = { pendente: 'text-warning', aceita: 'text-success', recusada: 'text-destructive' };

/** Ponto da própria colaboradora: só visualização + justificar dias com problema. */
export function MyTeamTimeCard() {
  const { user } = useAuth();
  const today = spToday();
  const q = useMyTeamTime(today.slice(0, 7), user?.id);
  const save = useSaveJustification();
  const [editing, setEditing] = useState<{ d: TeamDaily; j?: TeamJustification } | null>(null);
  const [motivo, setMotivo] = useState('');

  if (!q.data) return null;
  const { employee: e, daily, hourBank, justifications } = q.data;
  const days = [...daily].sort((a, b) => b.dia.localeCompare(a.dia)).map(d => ({ d, c: classifyDay(d, e.horario_previsto, today) }));
  const hoje = days.find(x => x.d.dia === today);
  const exMes = days.reduce((s, x) => s + x.c.extraMin, 0);
  const faltaDias = days.filter(x => x.c.faltaDia).length;
  const faltaMin = days.reduce((s, x) => s + x.c.faltaMin, 0);
  const jBy = new Map(justifications.map(j => [j.dia, j]));
  const problem = (x: typeof days[number]) => !x.c.emAndamento && (x.c.faltaDia || x.c.faltaMin > 0 || ['incompleta', 'sem_marcacao', 'atraso', 'falta', 'inconsistencia'].includes(x.d.situacao));
  const problemas = days.filter(problem);
  const lastSync = daily.map(d => d.synced_at).sort().at(-1);

  const open = (d: TeamDaily, j?: TeamJustification) => { setEditing({ d, j }); setMotivo(j?.motivo ?? ''); };
  const submit = async () => {
    if (!editing || motivo.trim().length < 3) return;
    try { await save.mutateAsync({ id: editing.j?.id, employee_external_id: e.external_id, dia: editing.d.dia, motivo: motivo.trim().slice(0, 500) }); toast.success('Justificativa enviada.'); setEditing(null); }
    catch { toast.error('Não foi possível enviar a justificativa.'); }
  };
  const Stat = ({ v, l }: { v: string | number; l: string }) => <div className="rounded-md border border-border bg-background p-2.5"><div className="text-lg font-semibold">{v}</div><div className="text-[10px] text-muted-foreground">{l}</div></div>;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-primary" />Meu ponto</h2>
        <span className="text-[10px] text-muted-foreground">Atualizado em {fmtDateTime(lastSync)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat v={(hoje?.d.marcacoes ?? []).join(' · ') || '—'} l="Batidas de hoje" />
        <Stat v={exMes ? minToHhmm(exMes) : '—'} l="Horas extras no mês" />
        <Stat v={faltaDias} l="Faltas (dias) no mês" />
        <Stat v={faltaMin ? minToHhmm(faltaMin) : '—'} l="Atrasos/saídas antes" />
        <Stat v={hourBank[0]?.saldo ?? '—'} l="Banco de horas" />
      </div>
      {problemas.length > 0 && <div className="mt-3 space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Dias para conferir</p>
        {problemas.map(({ d, c }) => { const j = jBy.get(d.dia); return (
          <div key={d.dia} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
            <strong>{fmtDate(d.dia)}</strong>
            <span className="text-muted-foreground">{c.faltaDia ? 'Falta (dia inteiro)' : c.faltaMin ? `Faltou ${minToHhmm(c.faltaMin)}` : d.situacao === 'incompleta' ? 'Batida faltando' : (d.ocorrencia ?? 'Conferir')}</span>
            <span className="text-muted-foreground">{(d.marcacoes ?? []).join(' · ')}</span>
            {hhmmToMin(d.horas_extras) > 0 && <span className="text-info">+{d.horas_extras}</span>}
            <span className="ml-auto flex items-center gap-2">
              {j && <span className={`text-[10px] font-medium ${ST_STYLE[j.status]}`}>{ST_LABEL[j.status]}</span>}
              {(!j || j.status === 'pendente') && <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => open(d, j)}><MessageSquareText className="h-3 w-3" />{j ? 'Editar' : 'Justificar'}</Button>}
            </span>
          </div>); })}
      </div>}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Justificar {editing && fmtDate(editing.d.dia)}</DialogTitle></DialogHeader>
          <Textarea value={motivo} onChange={ev => setMotivo(ev.target.value)} maxLength={500} placeholder="Explique o motivo (ex.: consulta médica, esqueci de bater a saída às 18:00)" rows={4} />
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button disabled={save.isPending || motivo.trim().length < 3} onClick={submit}>Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
