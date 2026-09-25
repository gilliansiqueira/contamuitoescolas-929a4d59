import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildSampleData, isPreviewEnv, useTeamTime, useTeamTimeSync, type TeamSituacao, type TeamTimeData } from '@/hooks/useTeamTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, Clock3, KeyRound, Loader2, RefreshCw, ShieldAlert, UserCheck, UserX, Users, Timer, ListChecks, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

const SIT_LABEL: Record<TeamSituacao, string> = {
  regular: 'Regular', atraso: 'Atraso', sem_marcacao: 'Sem marcação', incompleta: 'Marcação incompleta',
  falta: 'Falta', hora_extra: 'Hora extra', inconsistencia: 'Com inconsistência', aguardando: 'Aguardando informação',
};
const SIT_STYLE: Record<TeamSituacao, string> = {
  regular: 'bg-success/15 text-success border-success/30',
  atraso: 'bg-progress/15 text-progress border-progress/30',
  sem_marcacao: 'bg-muted text-muted-foreground border-border',
  incompleta: 'bg-primary/15 text-primary border-primary/30',
  falta: 'bg-destructive/15 text-destructive border-destructive/30',
  hora_extra: 'bg-info/15 text-info border-info/30',
  inconsistencia: 'bg-destructive/10 text-destructive border-destructive/30',
  aguardando: 'bg-muted text-muted-foreground border-dashed border-border',
};

const spToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const fmtDateTime = (iso?: string | null) => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
const fmtDate = (d: string) => d.split('-').reverse().join('/');

type CardKey = 'all' | 'presentes' | 'sem_marcacao' | 'atraso' | 'incompleta' | 'hora_extra' | 'pendencias';

export function TeamTimePanel() {
  const { isSuperAdmin } = useAuth();
  const [date, setDate] = useState(spToday());
  const month = date.slice(0, 7);
  const [sample, setSample] = useState(false);
  const [card, setCard] = useState<CardKey>('all');
  const [who, setWho] = useState('');
  const [sit, setSit] = useState<'all' | TeamSituacao>('all');
  const [occFilter, setOccFilter] = useState('all');
  const query = useTeamTime(month, isSuperAdmin);
  const sync = useTeamTimeSync();

  if (!isSuperAdmin) {
    return <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground"><ShieldAlert className="h-8 w-8" /><p className="text-sm">Acesso restrito.</p></div>;
  }

  const data: TeamTimeData | undefined = sample ? buildSampleData(date) : query.data;
  const run = data?.lastRun;
  const syncing = sync.isPending || run?.status === 'running';
  const notConfigured = !sample && run?.status === 'not_configured' && !data?.lastSuccess;
  const status: 'nao_configurada' | 'sincronizando' | 'erro' | 'atualizada' | 'sem_dados' =
    syncing ? 'sincronizando' : notConfigured || (!sample && !run) ? 'nao_configurada' : run?.status === 'error' ? 'erro' : data?.lastSuccess ? 'atualizada' : 'sem_dados';

  const onSync = async () => {
    try {
      const r = await sync.mutateAsync();
      if (!r.configured) toast.info('A integração com o PontoFopag ainda não foi configurada.');
      else if (r.status === 'error') toast.error(`Não foi possível atualizar: ${r.message ?? 'erro na consulta'}. Os últimos dados foram mantidos.`);
      else toast.success('Dados do ponto atualizados.');
    } catch { toast.error('Falha ao consultar o PontoFopag. Os últimos dados foram mantidos.'); }
  };

  return (
    <div className="space-y-5">
      <Header date={date} setDate={setDate} status={status} run={run} lastSuccess={data?.lastSuccess?.finished_at ?? null} onSync={onSync} syncing={syncing} sample={sample} setSample={setSample} />
      {query.isLoading && !sample ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>
      ) : query.isError && !sample ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar os dados do ponto.</div>
      ) : status === 'nao_configurada' && !data?.employees.length ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Integração não configurada</h2><p className="mt-1 text-xs text-muted-foreground">Aguardando a credencial oficial da API PontoFopag (Employer/ePays). Assim que ela for cadastrada com segurança, o botão “Atualizar agora” passa a trazer as colaboradoras, marcações, ocorrências e banco de horas.</p>{isPreviewEnv() && <Button size="sm" variant="outline" className="mt-3" onClick={() => setSample(true)}>Ver com dados de exemplo</Button>}</div></div>
        </div>
      ) : !data?.employees.length ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Nenhuma colaboradora recebida do PontoFopag até agora.</div>
      ) : (
        <Content data={data} date={date} card={card} setCard={setCard} who={who} setWho={setWho} sit={sit} setSit={setSit} occFilter={occFilter} setOccFilter={setOccFilter} />
      )}
    </div>
  );
}

function Header({ date, setDate, status, run, lastSuccess, onSync, syncing, sample, setSample }: {
  date: string; setDate: (d: string) => void; status: string; run?: TeamTimeData['lastRun']; lastSuccess: string | null;
  onSync: () => void; syncing: boolean; sample: boolean; setSample: (b: boolean) => void;
}) {
  const badge = {
    atualizada: { t: 'Atualizada', c: 'bg-success/15 text-success', i: CheckCircle2 },
    sincronizando: { t: 'Sincronizando', c: 'bg-info/15 text-info', i: Loader2 },
    erro: { t: 'Com erro', c: 'bg-destructive/15 text-destructive', i: AlertTriangle },
    nao_configurada: { t: 'Integração não configurada', c: 'bg-muted text-muted-foreground', i: KeyRound },
    sem_dados: { t: 'Sem dados', c: 'bg-muted text-muted-foreground', i: Clock3 },
  }[status as 'atualizada']!;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-medium">Ponto da Equipe</h1><span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">Interno</span>{sample && <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">Dados de exemplo</span>}</div>
          <p className="mt-1 text-xs text-muted-foreground">Somente consulta. Correções, justificativas e aprovações continuam no PontoFopag.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={date} max={spToday()} onChange={e => e.target.value && setDate(e.target.value)} className="h-9 w-40" aria-label="Data" />
          <span className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${badge.c}`}><badge.i className={`h-3.5 w-3.5 ${status === 'sincronizando' ? 'animate-spin' : ''}`} />{badge.t}</span>
          {sample ? <Button size="sm" variant="outline" className="h-9" onClick={() => setSample(false)}>Sair do exemplo</Button>
            : <Button size="sm" className="h-9 gap-1.5" onClick={onSync} disabled={syncing}><RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />Atualizar agora</Button>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span>Data: <strong className="text-foreground">{fmtDate(date)}</strong></span>
        <span>Última atualização concluída: <strong className="text-foreground">{fmtDateTime(lastSuccess)}</strong></span>
        {run && <span>Última tentativa: {fmtDateTime(run.started_at)}</span>}
      </div>
      {status === 'erro' && run?.message && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">Última sincronização falhou: {run.message}. Os dados exibidos são da última atualização concluída. Tente novamente.</p>}
    </div>
  );
}

function Content({ data, date, card, setCard, who, setWho, sit, setSit, occFilter, setOccFilter }: {
  data: TeamTimeData; date: string; card: CardKey; setCard: (c: CardKey) => void; who: string; setWho: (s: string) => void;
  sit: 'all' | TeamSituacao; setSit: (s: 'all' | TeamSituacao) => void; occFilter: string; setOccFilter: (s: string) => void;
}) {
  const dayByEmp = useMemo(() => new Map(data.daily.filter(d => d.dia === date).map(d => [d.employee_external_id, d])), [data.daily, date]);
  const bankByEmp = useMemo(() => new Map(data.hourBank.map(b => [b.employee_external_id, b])), [data.hourBank]);
  const occToday = data.occurrences.filter(o => o.dia === date);

  const rows = data.employees.map(e => {
    const d = dayByEmp.get(e.external_id);
    return { e, d, situacao: (d?.situacao ?? 'aguardando') as TeamSituacao, bank: bankByEmp.get(e.external_id), occ: occToday.filter(o => o.employee_external_id === e.external_id) };
  });
  const count = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).length;
  const isPend = (r: typeof rows[number]) => r.occ.length > 0 || ['atraso', 'incompleta', 'falta', 'inconsistencia', 'sem_marcacao'].includes(r.situacao);
  const cards: { k: CardKey; label: string; v: number; icon: typeof Users; f: (r: typeof rows[number]) => boolean }[] = [
    { k: 'all', label: 'Colaboradoras ativas', v: rows.length, icon: Users, f: () => true },
    { k: 'presentes', label: 'Presentes hoje', v: count(r => !!r.d?.primeira_marcacao), icon: UserCheck, f: r => !!r.d?.primeira_marcacao },
    { k: 'sem_marcacao', label: 'Sem marcação', v: count(r => r.situacao === 'sem_marcacao'), icon: UserX, f: r => r.situacao === 'sem_marcacao' },
    { k: 'atraso', label: 'Atrasos', v: count(r => r.situacao === 'atraso'), icon: Clock3, f: r => r.situacao === 'atraso' },
    { k: 'incompleta', label: 'Marcações incompletas', v: count(r => r.situacao === 'incompleta'), icon: AlertTriangle, f: r => r.situacao === 'incompleta' },
    { k: 'hora_extra', label: 'Horas extras', v: count(r => r.situacao === 'hora_extra' || !!r.d?.horas_extras), icon: Timer, f: r => r.situacao === 'hora_extra' || !!r.d?.horas_extras },
    { k: 'pendencias', label: 'Pendências do dia', v: count(isPend), icon: ListChecks, f: isPend },
  ];
  const occTypes = [...new Set(data.occurrences.map(o => o.tipo))].sort();
  const cardF = cards.find(c => c.k === card)!.f;
  const filtered = rows.filter(r => cardF(r) && (sit === 'all' || r.situacao === sit) && (!who || r.e.nome.toLowerCase().includes(who.toLowerCase()) || (r.e.matricula ?? '').includes(who)) && (occFilter === 'all' || r.occ.some(o => o.tipo === occFilter)));

  const alerts = rows.flatMap(r => [
    ...r.occ.map(o => ({ key: o.external_key, nome: r.e.nome, dia: o.dia, texto: o.tipo })),
    ...(r.situacao === 'sem_marcacao' && !r.occ.length ? [{ key: `${r.e.external_id}-sem`, nome: r.e.nome, dia: date, texto: 'Ausência de entrada' }] : []),
    ...(r.situacao === 'incompleta' && !r.occ.length ? [{ key: `${r.e.external_id}-inc`, nome: r.e.nome, dia: date, texto: 'Marcação incompleta' }] : []),
  ]);

  const monthly = data.employees.map(e => {
    const occ = data.occurrences.filter(o => o.employee_external_id === e.external_id);
    const days = data.daily.filter(d => d.employee_external_id === e.external_id);
    const has = (d: typeof days[number], s: TeamSituacao) => d.situacao === s;
    return { e, atrasos: days.filter(d => has(d, 'atraso')).length, faltas: days.filter(d => has(d, 'falta')).length, incompletas: days.filter(d => has(d, 'incompleta')).length, extras: days.filter(d => has(d, 'hora_extra') || d.horas_extras).length, inconsist: occ.filter(o => o.origem === 'inconsistencias').length + days.filter(d => has(d, 'inconsistencia')).length, saldo: bankByEmp.get(e.external_id)?.saldo ?? '—' };
  });

  return (
    <Tabs defaultValue="dia">
      <TabsList><TabsTrigger value="dia">Dia</TabsTrigger><TabsTrigger value="mes">Resumo do mês</TabsTrigger></TabsList>
      <TabsContent value="dia" className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {cards.map(c => <button key={c.k} type="button" onClick={() => setCard(card === c.k ? 'all' : c.k)} className={`rounded-lg border p-3 text-left transition-colors ${card === c.k ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}><c.icon className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-semibold">{c.v}</div><div className="text-[11px] text-muted-foreground">{c.label}</div></button>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              <Input value={who} onChange={e => setWho(e.target.value)} placeholder="Colaboradora ou matrícula" className="h-8 w-52 text-xs" />
              <Select value={sit} onValueChange={v => setSit(v as typeof sit)}><SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem>{(Object.keys(SIT_LABEL) as TeamSituacao[]).map(s => <SelectItem key={s} value={s}>{SIT_LABEL[s]}</SelectItem>)}</SelectContent></Select>
              <Select value={occFilter} onValueChange={setOccFilter}><SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as ocorrências</SelectItem>{occTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>{['Nome', 'Matrícula', 'Previsto', '1ª marcação', 'Última', 'Trabalhadas', 'Banco de horas', 'Ocorrência', 'Situação', 'Atualizado'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">Nenhuma colaboradora neste filtro.</td></tr>}
                  {filtered.map(r => <tr key={r.e.external_id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{r.e.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.e.matricula ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.d?.horario_previsto ?? r.e.horario_previsto ?? '—'}</td>
                    <td className="px-3 py-2">{r.d?.primeira_marcacao ?? '—'}</td>
                    <td className="px-3 py-2">{r.d?.ultima_marcacao ?? '—'}</td>
                    <td className="px-3 py-2">{r.d?.horas_trabalhadas ?? '—'}</td>
                    <td className={`px-3 py-2 font-medium ${(r.bank?.saldo_minutos ?? 0) < 0 ? 'text-destructive' : ''}`}>{r.bank?.saldo ?? '—'}</td>
                    <td className="px-3 py-2">{r.d?.ocorrencia ?? '—'}</td>
                    <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${SIT_STYLE[r.situacao]}`}>{SIT_LABEL[r.situacao]}</span></td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDateTime(r.d?.synced_at)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="h-fit rounded-lg border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium">Alertas</h2><span className="text-[10px] text-muted-foreground">{alerts.length}</span></div>
            {alerts.length === 0 ? <p className="rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">Nenhuma pendência para esta data.</p> : <div className="space-y-2">{alerts.map(a => <div key={a.key} className="rounded-md border-l-4 border-primary bg-primary/10 p-2.5"><strong className="block text-[11px]">{a.nome}</strong><span className="block text-[11px] text-muted-foreground">{a.texto}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarClock className="h-3 w-3" />{fmtDate(a.dia)}</span></div>)}</div>}
            <p className="mt-3 text-[10px] text-muted-foreground">Correções são feitas diretamente no PontoFopag.</p>
          </aside>
        </div>
      </TabsContent>
      <TabsContent value="mes">
        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>{['Colaboradora', 'Atrasos', 'Faltas', 'Marcações incompletas', 'Horas extras (dias)', 'Inconsistências', 'Saldo banco de horas'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{monthly.map(m => <tr key={m.e.external_id} className="border-t border-border"><td className="px-3 py-2 font-medium">{m.e.nome}</td><td className="px-3 py-2">{m.atrasos}</td><td className="px-3 py-2">{m.faltas}</td><td className="px-3 py-2">{m.incompletas}</td><td className="px-3 py-2">{m.extras}</td><td className="px-3 py-2">{m.inconsist}</td><td className="px-3 py-2 font-medium">{m.saldo}</td></tr>)}</tbody>
          </table>
        </section>
      </TabsContent>
    </Tabs>
  );
}
