import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildSampleData, isPreviewEnv, useTeamTime, useTeamTimeSync, useSetEmployeeHidden, type TeamSituacao, type TeamTimeData } from '@/hooks/useTeamTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, Clock3, KeyRound, Loader2, RefreshCw, ShieldAlert, UserCheck, UserX, Trash2, Undo2, Users, Timer, ListChecks, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { ImportCartaoPonto } from './ImportCartaoPonto';

const SIT_LABEL: Record<TeamSituacao, string> = {
  regular: 'Regular', atraso: 'Atraso', sem_marcacao: 'Sem marcação', incompleta: 'Marcação incompleta',
  falta: 'Falta', hora_extra: 'Hora extra', inconsistencia: 'Com inconsistência', aguardando: 'Aguardando informação', em_andamento: 'Em andamento',
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
  em_andamento: 'bg-muted text-muted-foreground border-border',
};

const spToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const fmtDateTime = (iso?: string | null) => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
const fmtDate = (d: string) => d.split('-').reverse().join('/');

const TIME_RE = /^\d{1,2}:\d{2}$/;
const chipOk = 'rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium';
const chipFalta = (t: string, key: string) => <span key={key} title={`Batida faltando (previsto ${t})`} className="rounded border border-dashed border-destructive/60 bg-destructive/5 px-1.5 py-0.5 text-[10px] text-destructive">{t}</span>;

/** Mostra todas as batidas do dia; quando falta alguma, o slot previsto fica tracejado em vermelho. */
function BatidasCelula({ previsto, marcacoes }: { previsto?: string | null; marcacoes?: string[] | null }) {
  const slots = (previsto ?? '').trim().split(/\s+/).filter(t => TIME_RE.test(t));
  const marc = (marcacoes ?? []).filter(t => TIME_RE.test(t));
  if (!marc.length) {
    if (!slots.length) return <span className="text-muted-foreground">—</span>;
    return <span className="inline-flex flex-wrap gap-1">{slots.map((t, i) => chipFalta(t, String(i)))}</span>;
  }
  if (!slots.length || marc.length >= slots.length) {
    return <span className="inline-flex flex-wrap gap-1">{marc.map((t, i) => <span key={i} className={chipOk}>{t}</span>)}</span>;
  }
  const cells: ReactNode[] = [];
  if (slots.length - marc.length === 1 && marc.length >= 2) {
    // Falta uma batida: as primeiras casam em ordem e a última casou com a saída final (ex.: saída do almoço faltando).
    for (let i = 0; i < slots.length; i++) {
      if (i < marc.length - 1) cells.push(<span key={i} className={chipOk}>{marc[i]}</span>);
      else if (i === slots.length - 1) cells.push(<span key={i} className={chipOk}>{marc[marc.length - 1]}</span>);
      else cells.push(chipFalta(slots[i], String(i)));
    }
  } else {
    marc.forEach((t, i) => cells.push(<span key={i} className={chipOk}>{t}</span>));
    for (let i = marc.length; i < slots.length; i++) cells.push(chipFalta(slots[i], `f${i}`));
  }
  return <span className="inline-flex flex-wrap gap-1">{cells}</span>;
}

type CardKey = 'all' | 'presentes' | 'sem_marcacao' | 'atraso' | 'incompleta' | 'hora_extra' | 'pendencias';

export function TeamTimePanel() {
  const { isSuperAdmin, canViewTeamTime } = useAuth();
  const [date, setDate] = useState(spToday());
  const month = date.slice(0, 7);
  const [sample, setSample] = useState(false);
  const [card, setCard] = useState<CardKey>('all');
  const [who, setWho] = useState('');
  const [sit, setSit] = useState<'all' | TeamSituacao>('all');
  const [occFilter, setOccFilter] = useState('all');
  const query = useTeamTime(month, canViewTeamTime);
  const sync = useTeamTimeSync();

  if (!canViewTeamTime) {
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
      <Header date={date} setDate={setDate} status={status} run={run} lastSuccess={data?.lastSuccess?.finished_at ?? null} onSync={onSync} syncing={syncing} sample={sample} setSample={setSample} canEdit={isSuperAdmin} />
      {query.isLoading && !sample ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>
      ) : query.isError && !sample ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar os dados do ponto.</div>
      ) : status === 'nao_configurada' && !data?.employees.length ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Integração não configurada</h2><p className="mt-1 text-xs text-muted-foreground">Aguardando a credencial oficial da API PontoFopag (Employer/ePays). Enquanto isso, use “Importar relatório de ponto (PDF)” com o Relatório de Cartão Ponto exportado do PontoFopag.</p>{isPreviewEnv() && <Button size="sm" variant="outline" className="mt-3" onClick={() => setSample(true)}>Ver com dados de exemplo</Button>}</div></div>
        </div>
      ) : !data?.employees.length ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Nenhuma colaboradora recebida do PontoFopag até agora.</div>
      ) : (
        <Content data={data} date={date} card={card} setCard={setCard} who={who} setWho={setWho} sit={sit} setSit={setSit} occFilter={occFilter} setOccFilter={setOccFilter} canEdit={isSuperAdmin} />
      )}
    </div>
  );
}

function Header({ date, setDate, status, run, lastSuccess, onSync, syncing, sample, setSample, canEdit }: {
  date: string; setDate: (d: string) => void; status: string; run?: TeamTimeData['lastRun']; lastSuccess: string | null;
  onSync: () => void; syncing: boolean; sample: boolean; setSample: (b: boolean) => void; canEdit: boolean;
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
            : canEdit && <Button size="sm" className="h-9 gap-1.5" onClick={onSync} disabled={syncing}><RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />Atualizar agora</Button>}
          {!sample && canEdit && <ImportCartaoPonto />}
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

function Content({ data, date, card, setCard, who, setWho, sit, setSit, occFilter, setOccFilter, canEdit }: {
  data: TeamTimeData; date: string; card: CardKey; setCard: (c: CardKey) => void; who: string; setWho: (s: string) => void;
  sit: 'all' | TeamSituacao; setSit: (s: 'all' | TeamSituacao) => void; occFilter: string; setOccFilter: (s: string) => void; canEdit: boolean;
}) {
  const hide = useSetEmployeeHidden();
  const [showHidden, setShowHidden] = useState(false);
  const setHidden = (id: string, nome: string, hidden: boolean) => {
    if (hidden && !confirm(`Ocultar ${nome} do Ponto? As horas ficam guardadas e dá para restaurar depois.`)) return;
    hide.mutate({ external_id: id, hidden }, { onSuccess: () => toast.success(hidden ? `${nome} ocultada do Ponto` : `${nome} restaurada`), onError: (e: any) => toast.error(e.message ?? 'Erro') });
  };
  const dayByEmp = useMemo(() => new Map(data.daily.filter(d => d.dia === date).map(d => [d.employee_external_id, d])), [data.daily, date]);
  const bankByEmp = useMemo(() => new Map(data.hourBank.map(b => [b.employee_external_id, b])), [data.hourBank]);
  const occToday = data.occurrences.filter(o => o.dia === date);

  const rows = data.employees.map(e => {
    const d = dayByEmp.get(e.external_id);
    return { e, d, situacao: (d?.situacao ?? 'aguardando') as TeamSituacao, bank: bankByEmp.get(e.external_id), occ: occToday.filter(o => o.employee_external_id === e.external_id) };
  });
  const count = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).length;
  const isPend = (r: typeof rows[number]) => r.situacao !== 'em_andamento' && r.occ.length > 0 || ['atraso', 'incompleta', 'falta', 'inconsistencia', 'sem_marcacao'].includes(r.situacao);
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
    const cls = days.map(d => classifyDay(d, e.horario_previsto));
    const has = (d: typeof days[number], s: TeamSituacao) => d.situacao === s;
    return { e, atrasos: days.filter(d => has(d, 'atraso')).length, faltas: cls.filter(c => c.faltaDia).length, faltaMin: cls.reduce((s, c) => s + c.faltaMin, 0), incompletas: days.filter(d => has(d, 'incompleta')).length, extras: cls.filter(c => c.extraMin > 0).length, exMin: cls.reduce((s, c) => s + c.extraMin, 0), inconsist: occ.filter(o => o.origem === 'inconsistencias').length + days.filter(d => has(d, 'inconsistencia')).length, saldo: bankByEmp.get(e.external_id)?.saldo ?? '—' };
  });

  return (
    <Tabs defaultValue="dia">
      <TabsList><TabsTrigger value="dia">Dia</TabsTrigger><TabsTrigger value="mes">Resumo do mês</TabsTrigger><TabsTrigger value="extras">Extras e faltas</TabsTrigger></TabsList>
      <TabsContent value="dia" className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {cards.map(c => <button key={c.k} type="button" onClick={() => setCard(card === c.k ? 'all' : c.k)} className={`rounded-lg border p-3 text-left transition-colors ${card === c.k ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}><c.icon className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-semibold">{c.v}</div><div className="text-[11px] text-muted-foreground">{c.label}</div></button>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              <Input value={who} onChange={e => setWho(e.target.value)} placeholder="Colaboradora" className="h-8 w-52 text-xs" />
              <Select value={sit} onValueChange={v => setSit(v as typeof sit)}><SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem>{(Object.keys(SIT_LABEL) as TeamSituacao[]).map(s => <SelectItem key={s} value={s}>{SIT_LABEL[s]}</SelectItem>)}</SelectContent></Select>
              {!!data.hidden?.length && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowHidden(v => !v)}>Ver ocultos ({data.hidden.length})</Button>}
              <Select value={occFilter} onValueChange={setOccFilter}><SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as ocorrências</SelectItem>{occTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </div>
            {showHidden && !!data.hidden?.length && <div className="space-y-1 border-b border-border bg-muted/30 p-3">{data.hidden.map(h => <div key={h.external_id} className="flex items-center gap-2 text-xs"><span className="font-medium">{h.nome}</span><span className="text-muted-foreground">{h.matricula ?? ''}</span><Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" disabled={hide.isPending || !canEdit} onClick={() => setHidden(h.external_id, h.nome, false)}><Undo2 className="h-3 w-3" />Restaurar</Button></div>)}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>{['Nome', 'Batidas', '1ª marcação', 'Última', 'Trabalhadas', 'Extras', 'Banco de horas', 'Ocorrência', 'Situação', 'Atualizado'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">Nenhuma colaboradora neste filtro.</td></tr>}
                  {filtered.map(r => { const c = classifyDay(r.d, r.e.horario_previsto); const sitKey: TeamSituacao = r.situacao === 'aguardando' && c.faltaDia ? 'falta' : r.situacao; const sitLabel = r.situacao === 'aguardando' && c.faltaMin ? `Faltou ${minToHhmm(c.faltaMin)}` : SIT_LABEL[sitKey]; const sitStyle = r.situacao === 'aguardando' && c.faltaMin ? SIT_STYLE.atraso : SIT_STYLE[sitKey]; const occ = c.faltaMin ? `Faltou ${minToHhmm(c.faltaMin)}` : (r.d?.ocorrencia ?? '—'); return <tr key={r.e.external_id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 font-medium"><span className="inline-flex items-center gap-1">{r.e.nome}{canEdit && <Button size="sm" variant="ghost" className="h-6 px-1 text-muted-foreground" disabled={hide.isPending} onClick={() => setHidden(r.e.external_id, r.e.nome, true)} title="Ocultar do Ponto" aria-label={`Ocultar ${r.e.nome}`}><Trash2 className="h-3 w-3" /></Button>}</span></td>
                    <td className="px-3 py-2"><BatidasCelula previsto={r.d ? (r.d.horario_previsto ?? r.e.horario_previsto) : null} marcacoes={r.d?.marcacoes} /></td>
                    <td className="px-3 py-2">{r.d?.primeira_marcacao ?? '—'}</td>
                    <td className="px-3 py-2">{r.d?.ultima_marcacao ?? '—'}</td>
                    <td className="px-3 py-2">{r.d?.horas_trabalhadas ?? '—'}</td>
                    <td className="px-3 py-2 font-medium text-info">{hhmmToMin(r.d?.horas_extras) > 0 ? minToHhmm(hhmmToMin(r.d?.horas_extras)) : '—'}</td>
                    <td className={`px-3 py-2 font-medium ${(r.bank?.saldo_minutos ?? 0) < 0 ? 'text-destructive' : ''}`}>{r.bank?.saldo ?? '—'}</td>
                    <td className="px-3 py-2">{occ}</td>
                    <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${sitStyle}`}>{sitLabel}</span></td>
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
            <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>{['Colaboradora', 'Atrasos', 'Faltas (dias)', 'Atrasos/saídas antes', 'Marcações incompletas', 'Horas extras', 'Inconsistências', 'Saldo banco de horas'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{monthly.map(m => <tr key={m.e.external_id} className="border-t border-border"><td className="px-3 py-2 font-medium">{m.e.nome}</td><td className="px-3 py-2">{m.atrasos}</td><td className="px-3 py-2">{m.faltas}</td><td className="px-3 py-2">{m.faltaMin ? minToHhmm(m.faltaMin) : '—'}</td><td className="px-3 py-2">{m.incompletas}</td><td className="px-3 py-2">{m.extras} dia(s){m.exMin > 0 && <span className="text-muted-foreground"> · {minToHhmm(m.exMin)}</span>}</td><td className="px-3 py-2">{m.inconsist}</td><td className="px-3 py-2 font-medium">{m.saldo}</td></tr>)}</tbody>
          </table>
        </section>
      </TabsContent>
      <TabsContent value="extras"><ExtrasFaltas data={data} date={date} /></TabsContent>
    </Tabs>
  );
}

function hhmmToMin(v?: string | null): number {
  const m = v?.trim().match(/^([+-])?(\d{1,3}):(\d{2})$/);
  if (!m) return 0;
  const n = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -n : n;
}
function minToHhmm(n: number): string {
  const a = Math.abs(n);
  return `${n < 0 ? '-' : ''}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
/** Jornada prevista do dia a partir dos horários impressos (pares entrada/saída). */
function previstoMin(p?: string | null): number {
  const t = (p ?? '').split(/\s+/).filter(x => TIME_RE.test(x)).map(x => hhmmToMin(x));
  let s = 0;
  for (let i = 0; i + 1 < t.length; i += 2) s += Math.max(0, t[i + 1] - t[i]);
  return s;
}

const spTimeMin = (iso?: string | null) => {
  if (!iso) return null;
  const s = new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
  return hhmmToMin(s);
};
/** Regra única do Ponto para as três abas: falta do dia inteiro, minutos faltando e extras. */
export function classifyDay(d: TeamTimeData['daily'][number] | undefined, previstoEmp: string | null, today = spToday()) {
  if (!d) return { faltaDia: false, faltaMin: 0, extraMin: 0, emAndamento: false };
  const isToday = d.dia === today;
  const semBatida = !(d.marcacoes?.length) && !d.primeira_marcacao;
  const prev = (d.horario_previsto ?? previstoEmp ?? '').split(/\s+/).find(x => TIME_RE.test(x));
  const syncMin = spTimeMin(d.synced_at);
  const syncedSameDay = d.synced_at ? new Date(d.synced_at).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) === d.dia : false;
  const entradaPassou = !isToday && !syncedSameDay ? true : (prev != null && syncMin != null && syncMin > hhmmToMin(prev));
  const marcadoFalta = d.situacao === 'falta' || /^falta$/i.test((d.ocorrencia ?? '').trim()) || d.situacao === 'sem_marcacao';
  const faltaDia = semBatida && marcadoFalta && entradaPassou;
  const emAndamento = isToday && !faltaDia;
  const fm = (d.ocorrencia ?? '').match(/Faltas\s+(\d+:\d{2})/i);
  return { faltaDia, faltaMin: emAndamento || !fm ? 0 : hhmmToMin(fm[1]), extraMin: emAndamento ? 0 : Math.max(0, hhmmToMin(d.horas_extras)), emAndamento };
}

function ExtrasFaltas({ data, date }: { data: TeamTimeData; date: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = data.employees.map(e => {
    const days = data.daily.filter(d => d.employee_external_id === e.external_id && d.dia.slice(0, 7) === date.slice(0, 7)).sort((a, b) => a.dia.localeCompare(b.dia)).map(d => ({ d, c: classifyDay(d, e.horario_previsto) }));
    const today = days.find(x => x.d.dia === date);
    const extraDays = days.filter(x => x.c.extraMin > 0).map(x => x.d);
    const faltaDays = days.filter(x => x.c.faltaDia || x.c.faltaMin > 0);
    const faltaDias = faltaDays.filter(x => x.c.faltaDia).length;
    const faltaMinMes = faltaDays.reduce((s, x) => s + x.c.faltaMin, 0);
    return {
      e, extraDays, faltaDays, faltaDias, faltaMinMes,
      exHoje: today?.c.extraMin ?? 0, exMes: days.reduce((s, x) => s + x.c.extraMin, 0),
      faltouHoje: !!today?.c.faltaDia,
      naoTrab: faltaMinMes + faltaDays.filter(x => x.c.faltaDia).reduce((s, x) => s + previstoMin(x.d.horario_previsto ?? e.horario_previsto), 0),
    };
  });
  const tot = (f: (r: typeof rows[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const Card = ({ v, l }: { v: string | number; l: string }) => <div className="rounded-lg border border-border bg-card p-3"><div className="text-2xl font-semibold">{v}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>;
  const th = 'whitespace-nowrap px-3 py-2 font-medium';
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Timer className="h-4 w-4 text-primary" />Horas extras</h2>
        <div className="grid grid-cols-2 gap-3"><Card v={minToHhmm(tot(r => r.exHoje))} l={`Equipe em ${fmtDate(date)}`} /><Card v={minToHhmm(tot(r => r.exMes))} l="Equipe no mês" /></div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr><th className={th}>Colaboradora</th><th className={th}>No dia</th><th className={th}>No mês</th><th className={th}>Dias com extra</th></tr></thead>
            <tbody>{rows.map(r => <Fragment key={r.e.external_id}>
              <tr className={`border-t border-border ${r.extraDays.length ? 'cursor-pointer hover:bg-muted/30' : ''}`} onClick={() => r.extraDays.length && setOpen(open === `x${r.e.external_id}` ? null : `x${r.e.external_id}`)}>
                <td className="px-3 py-2 font-medium">{r.e.nome}</td><td className="px-3 py-2">{r.exHoje ? minToHhmm(r.exHoje) : '—'}</td><td className="px-3 py-2 font-medium">{r.exMes ? minToHhmm(r.exMes) : '—'}</td><td className="px-3 py-2">{r.extraDays.length}</td>
              </tr>
              {open === `x${r.e.external_id}` && r.extraDays.map(d => <tr key={d.dia} className="bg-muted/20 text-[11px]"><td className="px-3 py-1.5 pl-6">{fmtDate(d.dia)}</td><td colSpan={2} className="px-3 py-1.5 text-muted-foreground">{(d.marcacoes ?? []).join(' · ') || '—'}</td><td className="px-3 py-1.5 font-medium">{d.horas_extras}</td></tr>)}
            </Fragment>)}</tbody>
          </table>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium"><UserX className="h-4 w-4 text-destructive" />Faltas</h2>
        <div className="grid grid-cols-3 gap-3"><Card v={tot(r => (r.faltouHoje ? 1 : 0))} l={`Faltas em ${fmtDate(date)}`} /><Card v={tot(r => r.faltaDias)} l="Dias de falta no mês" /><Card v={minToHhmm(tot(r => r.faltaMinMes))} l="Atrasos/saídas antes no mês" /></div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr><th className={th}>Colaboradora</th><th className={th}>Faltou no dia</th><th className={th}>Faltas (dias)</th><th className={th}>Atrasos/saídas antes</th><th className={th}>Horas não trabalhadas</th></tr></thead>
            <tbody>{rows.map(r => <Fragment key={r.e.external_id}>
              <tr className={`border-t border-border ${r.faltaDays.length ? 'cursor-pointer hover:bg-muted/30' : ''}`} onClick={() => r.faltaDays.length && setOpen(open === `f${r.e.external_id}` ? null : `f${r.e.external_id}`)}>
                <td className="px-3 py-2 font-medium">{r.e.nome}</td><td className={`px-3 py-2 ${r.faltouHoje ? 'font-medium text-destructive' : ''}`}>{r.faltouHoje ? 'Sim' : 'Não'}</td><td className="px-3 py-2 font-medium">{r.faltaDias}</td><td className="px-3 py-2">{r.faltaMinMes ? minToHhmm(r.faltaMinMes) : '—'}</td><td className="px-3 py-2">{r.naoTrab ? minToHhmm(r.naoTrab) : '—'}</td>
              </tr>
              {open === `f${r.e.external_id}` && r.faltaDays.map(f => <tr key={f.d.dia} className="bg-muted/20 text-[11px]"><td className="px-3 py-1.5 pl-6">{fmtDate(f.d.dia)}</td><td colSpan={4} className="px-3 py-1.5 text-muted-foreground">{f.c.faltaDia ? 'Falta (dia inteiro)' : `Faltou ${minToHhmm(f.c.faltaMin)} (atraso/saída antes)`}</td></tr>)}
            </Fragment>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
