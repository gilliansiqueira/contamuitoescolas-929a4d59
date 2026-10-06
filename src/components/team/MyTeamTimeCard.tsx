import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyTeamTime, useSaveJustification, type TeamDaily, type TeamJustification } from '@/hooks/useTeamTime';
import { classifyDay, hhmmToMin, minToHhmm } from './TeamTimePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarX2, Clock3, Hourglass, MessageSquareText, PiggyBank, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const spToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const fmtDate = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
const fmtDateTime = (iso?: string | null) => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const weekday = (d: string) => WEEK[new Date(`${d}T12:00:00`).getDay()];
const TIME_RE = /^\d{1,2}:\d{2}$/;
const ST_LABEL: Record<TeamJustification['status'], string> = { pendente: 'Justificativa enviada', aceita: 'Justificativa aceita', recusada: 'Justificativa recusada' };
const ST_STYLE: Record<TeamJustification['status'], string> = { pendente: 'text-warning', aceita: 'text-success', recusada: 'text-destructive' };

/** Aba "Meu ponto": a colaboradora vê o mês inteiro e só justifica batida não registrada. */
export function MyTeamTimeCard({ showEmpty = false }: { showEmpty?: boolean }) {
  const { user } = useAuth();
  const today = spToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const q = useMyTeamTime(month, user?.id);
  const save = useSaveJustification();
  const [editing, setEditing] = useState<{ d: TeamDaily; j?: TeamJustification } | null>(null);
  const [motivo, setMotivo] = useState('');

  if (!q.data) return showEmpty ? <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{q.isLoading ? 'Carregando seu ponto…' : 'Seu login ainda não está ligado ao ponto. Fale com a Bruna.'}</p> : null;
  const { employee: e, daily, hourBank, justifications } = q.data;
  const days = [...daily].sort((a, b) => b.dia.localeCompare(a.dia)).map(d => {
    const c = classifyDay(d, e.horario_previsto, today);
    const previstas = (d.horario_previsto ?? e.horario_previsto ?? '').split(/\s+/).filter(x => TIME_RE.test(x)).length;
    const batidas = d.marcacoes ?? [];
    const faltando = Math.max(0, previstas - batidas.length);
    // Só batida não registrada pode ser justificada — atraso/saída antes não.
    const canJustify = !c.emAndamento && (c.faltaDia || d.situacao === 'incompleta' || d.situacao === 'sem_marcacao' || (batidas.length > 0 && faltando > 0));
    return { d, c, batidas, faltando, canJustify };
  });
  const exMes = days.reduce((s, x) => s + x.c.extraMin, 0);
  const faltaDias = days.filter(x => x.c.faltaDia).length;
  const devidas = days.reduce((s, x) => s + x.c.faltaMin, 0);
  const jBy = new Map(justifications.map(j => [j.dia, j]));
  const lastSync = daily.map(d => d.synced_at).sort().at(-1);

  const open = (d: TeamDaily, j?: TeamJustification) => { setEditing({ d, j }); setMotivo(j?.motivo ?? ''); };
  const submit = async () => {
    if (!editing || motivo.trim().length < 3) return;
    try { await save.mutateAsync({ id: editing.j?.id, employee_external_id: e.external_id, dia: editing.d.dia, motivo: motivo.trim().slice(0, 500) }); toast.success('Justificativa enviada.'); setEditing(null); }
    catch { toast.error('Não foi possível enviar a justificativa.'); }
  };

  const cards = [
    { l: 'Horas extras no mês', v: exMes ? minToHhmm(exMes) : '0:00', icon: TrendingUp, tone: 'text-success-foreground bg-success', strip: 'border-t-success bg-success/[0.08]', num: 'text-success' },
    { l: 'Horas devidas no mês', v: devidas ? minToHhmm(devidas) : '0:00', note: 'atrasos + saídas antes', icon: Hourglass, tone: 'text-progress-foreground bg-progress', strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress' },
    { l: 'Faltas no mês', v: `${faltaDias} ${faltaDias === 1 ? 'dia' : 'dias'}`, icon: CalendarX2, tone: 'text-destructive-foreground bg-destructive', strip: 'border-t-destructive bg-destructive/[0.07]', num: 'text-destructive' },
    { l: 'Banco de horas', v: hourBank[0]?.saldo ?? '—', icon: PiggyBank, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-medium"><Clock3 className="h-5 w-5 text-primary" />Meu ponto</h1>
          <p className="mt-1 text-xs text-muted-foreground">{e.nome} · atualizado em {fmtDateTime(lastSync)}</p>
        </div>
        <Input aria-label="Mês" type="month" value={month} max={today.slice(0, 7)} onChange={ev => ev.target.value && setMonth(ev.target.value)} className="h-9 w-[168px] bg-card text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(c => (
          <div key={c.l} className={`rounded-lg border border-border border-t-4 p-3 shadow-sm ${c.strip}`}>
            <div className="flex min-h-8 items-start justify-between gap-1.5"><span className="text-xs font-medium text-foreground/80">{c.l}</span><span className={`flex h-7 w-7 items-center justify-center rounded-md shadow-sm ${c.tone}`}><c.icon className="h-3.5 w-3.5" /></span></div>
            <p className={`mt-1 text-2xl font-semibold leading-none ${c.num}`}>{c.v}</p>
            <p className="mt-1 min-h-4 text-[10px] text-muted-foreground">{c.note ?? ''}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] text-muted-foreground">
            <tr><th className="px-3 py-2 text-left font-medium">Dia</th><th className="px-3 py-2 text-left font-medium">Batidas</th><th className="px-3 py-2 text-right font-medium">Trabalhadas</th><th className="px-3 py-2 text-right font-medium">Extras</th><th className="px-3 py-2 text-right font-medium">Devidas</th><th className="px-3 py-2 text-left font-medium">Situação</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum registro neste mês.</td></tr>}
            {days.map(({ d, c, batidas, faltando, canJustify }) => {
              const j = jBy.get(d.dia);
              const sit = c.emAndamento ? { t: 'Em andamento', s: 'bg-muted text-muted-foreground' }
                : c.faltaDia ? { t: 'Falta', s: 'bg-destructive/10 text-destructive' }
                : canJustify ? { t: 'Batida faltando', s: 'bg-warning/15 text-warning' }
                : c.faltaMin > 0 ? { t: 'Atraso / saída antes', s: 'bg-progress/15 text-progress' }
                : c.extraMin > 0 ? { t: 'Hora extra', s: 'bg-success/10 text-success' }
                : { t: 'OK', s: 'bg-success/10 text-success' };
              return (
                <tr key={d.dia} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2"><strong>{fmtDate(d.dia)}</strong> <span className="text-muted-foreground">{weekday(d.dia)}</span></td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
                    {batidas.map((b, i) => <span key={i} className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">{b}</span>)}
                    {!c.emAndamento && Array.from({ length: faltando }).map((_, i) => <span key={`f${i}`} className="rounded border border-dashed border-warning px-1.5 py-0.5 text-[11px] text-warning">faltou</span>)}
                  </div></td>
                  <td className="px-3 py-2 text-right">{c.emAndamento ? '—' : d.horas_trabalhadas || '—'}</td>
                  <td className="px-3 py-2 text-right text-success">{c.extraMin ? `+${minToHhmm(c.extraMin)}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-progress">{c.faltaMin ? minToHhmm(c.faltaMin) : '—'}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sit.s}`}>{sit.t}</span>{j && <span className={`ml-2 text-[10px] font-medium ${ST_STYLE[j.status]}`}>{ST_LABEL[j.status]}</span>}</td>
                  <td className="px-3 py-2 text-right">{canJustify && (!j || j.status === 'pendente') && <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => open(d, j)}><MessageSquareText className="h-3 w-3" />{j ? 'Editar' : 'Justificar'}</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">Só é possível justificar batidas que não foram registradas. Atrasos e saídas antes do horário aparecem em "Horas devidas". {hhmmToMin('0:00') === 0 ? '' : ''}</p>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Justificar batida de {editing && fmtDate(editing.d.dia)}</DialogTitle></DialogHeader>
          <Textarea value={motivo} onChange={ev => setMotivo(ev.target.value)} maxLength={500} placeholder="Ex.: esqueci de bater a saída às 18:00" rows={4} />
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button disabled={save.isPending || motivo.trim().length < 3} onClick={submit}>Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
