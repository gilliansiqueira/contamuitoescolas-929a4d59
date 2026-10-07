import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { buildSampleData, isPreviewEnv, useTeamTime, useTeamTimeSync, useSetEmployeeHidden, useLinkEmployeeUser, useTeamJustifications, useReviewJustification, type TeamSituacao, type TeamTimeData, type TeamOccurrence } from '@/hooks/useTeamTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CalendarX2, CheckCircle2, ChevronDown, ChevronRight, Clock3, Hourglass, KeyRound, ListChecks, Loader2, RefreshCw, ShieldAlert, Timer, Trash2, Undo2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ImportCartaoPonto } from './ImportCartaoPonto';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
const fmtMonth = (m: string) => { const [y, mo] = m.split('-'); return `${mo}/${y}`; };
const monthLastDay = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`; };

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

type CardKey = 'all' | 'pendencias' | 'devidas' | 'extras' | 'faltas' | 'incompletas';
type Mode = 'hoje' | 'mes';

export function TeamTimePanel() {
  const { isSuperAdmin, canViewTeamTime } = useAuth();
  const today = spToday();
  const [mode, setMode] = useState<Mode>('hoje');
  const [date, setDate] = useState(today);
  const [monthFrom, setMonthFrom] = useState(today.slice(0, 7));
  const [monthTo, setMonthTo] = useState(today.slice(0, 7));
  const [sample, setSample] = useState(false);
  const [card, setCard] = useState<CardKey>('all');
  const [who, setWho] = useState('all');
  const [sit, setSit] = useState<'all' | TeamSituacao>('all');
  const queryMonth = mode === 'hoje' ? date.slice(0, 7) : monthFrom;
  const queryMonthTo = mode === 'hoje' ? undefined : (monthTo >= monthFrom ? monthTo : monthFrom);
  const query = useTeamTime(queryMonth, canViewTeamTime, queryMonthTo);
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

  const start = mode === 'hoje' ? date : `${monthFrom}-01`;
  const end = mode === 'hoje' ? date : monthLastDay(queryMonthTo ?? monthFrom);
  const periodLabel = mode === 'hoje' ? fmtDate(date) : queryMonthTo && queryMonthTo !== queryMonth ? `${fmtMonth(queryMonth)} – ${fmtMonth(queryMonthTo)}` : fmtMonth(queryMonth);

  return (
    <div className="space-y-5">
      <Header mode={mode} setMode={setMode} date={date} setDate={setDate} monthFrom={monthFrom} setMonthFrom={setMonthFrom} monthTo={monthTo} setMonthTo={setMonthTo} today={today} periodLabel={periodLabel} status={status} run={run} lastSuccess={data?.lastSuccess?.finished_at ?? null} onSync={onSync} syncing={syncing} sample={sample} setSample={setSample} canEdit={isSuperAdmin} />
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
        <Content data={data} mode={mode} start={start} end={end} card={card} setCard={setCard} who={who} setWho={setWho} sit={sit} setSit={setSit} canEdit={isSuperAdmin} />
      )}
    </div>
  );
}

function Header({ mode, setMode, date, setDate, monthFrom, setMonthFrom, monthTo, setMonthTo, today, periodLabel, status, run, lastSuccess, onSync, syncing, sample, setSample, canEdit }: {
  mode: Mode; setMode: (m: Mode) => void; date: string; setDate: (d: string) => void; monthFrom: string; setMonthFrom: (m: string) => void; monthTo: string; setMonthTo: (m: string) => void;
  today: string; periodLabel: string; status: string; run?: TeamTimeData['lastRun']; lastSuccess: string | null; onSync: () => void; syncing: boolean; sample: boolean; setSample: (b: boolean) => void; canEdit: boolean;
}) {
  const badge = {
    atualizada: { t: 'Atualizada', c: 'bg-success/15 text-success', i: CheckCircle2 },
    sincronizando: { t: 'Sincronizando', c: 'bg-info/15 text-info', i: Loader2 },
    erro: { t: 'Com erro', c: 'bg-destructive/15 text-destructive', i: AlertTriangle },
    nao_configurada: { t: 'Integração não configurada', c: 'bg-muted text-muted-foreground', i: KeyRound },
    sem_dados: { t: 'Sem dados', c: 'bg-muted text-muted-foreground', i: Clock3 },
  }[status as 'atualizada']!;
  const chip = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)} className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors ${mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50'}`}>{label}</button>
  );
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-medium">Ponto da Equipe</h1><span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">Interno</span>{sample && <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">Dados de exemplo</span>}</div>
          <p className="mt-1 text-xs text-muted-foreground">Somente consulta. Correções, justificativas e aprovações continuam no PontoFopag.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chip('hoje', 'Hoje')}
          {chip('mes', 'Por mês')}
          {mode === 'hoje'
            ? <Input type="date" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} className="h-9 w-40" aria-label="Data" />
            : <div className="flex items-center gap-1.5">
                <Input type="month" value={monthFrom} max={today.slice(0, 7)} onChange={e => e.target.value && setMonthFrom(e.target.value)} className="h-9 w-36" aria-label="Mês inicial" />
                <span className="text-[11px] text-muted-foreground">até</span>
                <Input type="month" value={monthTo >= monthFrom ? monthTo : monthFrom} min={monthFrom} max={today.slice(0, 7)} onChange={e => e.target.value && setMonthTo(e.target.value)} className="h-9 w-36" aria-label="Mês final" />
              </div>}
          <span className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${badge.c}`}><badge.i className={`h-3.5 w-3.5 ${status === 'sincronizando' ? 'animate-spin' : ''}`} />{badge.t}</span>
          {sample ? <Button size="sm" variant="outline" className="h-9" onClick={() => setSample(false)}>Sair do exemplo</Button>
            : canEdit && <Button size="sm" className="h-9 gap-1.5" onClick={onSync} disabled={syncing}><RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />Atualizar agora</Button>}
          {!sample && canEdit && <ImportCartaoPonto />}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span>Período: <strong className="text-foreground">{periodLabel}</strong></span>
        <span>Última atualização concluída: <strong className="text-foreground">{fmtDateTime(lastSuccess)}</strong></span>
        {run && <span>Última tentativa: {fmtDateTime(run.started_at)}</span>}
      </div>
      {status === 'erro' && run?.message && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">Última sincronização falhou: {run.message}. Os dados exibidos são da última atualização concluída. Tente novamente.</p>}
    </div>
  );
}

interface PersonRow {
  e: TeamTimeData['employees'][number];
  cls: { d: TeamTimeData['daily'][number]; c: ReturnType<typeof classifyDay>; occ: TeamOccurrence[] }[];
  problemas: { d: TeamTimeData['daily'][number]; c: ReturnType<typeof classifyDay>; occ: TeamOccurrence[] }[];
  pend: boolean; faltas: number; devidasMin: number; extrasMin: number; incDias: number;
}

/** Regra: ocorrência no dia (fora de "Em andamento"), situação marcada, falta do dia ou minutos faltando = problema. */
const dayProblem = (d: TeamTimeData['daily'][number], c: ReturnType<typeof classifyDay>, occ: TeamOccurrence[]) =>
  (occ.length > 0 && d.situacao !== 'em_andamento') ||
  ['atraso', 'incompleta', 'falta', 'inconsistencia', 'sem_marcacao'].includes(d.situacao) ||
  c.faltaDia || c.faltaMin > 0;

function Content({ data, mode, start, end, card, setCard, who, setWho, sit, setSit, canEdit }: {
  data: TeamTimeData; mode: Mode; start: string; end: string; card: CardKey; setCard: (c: CardKey) => void;
  who: string; setWho: (s: string) => void; sit: 'all' | TeamSituacao; setSit: (s: 'all' | TeamSituacao) => void; canEdit: boolean;
}) {
  const hide = useSetEmployeeHidden();
  const [open, setOpen] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const setHidden = (id: string, nome: string, hidden: boolean) => {
    if (hidden && !confirm(`Ocultar ${nome} do Ponto? As horas ficam guardadas e dá para restaurar depois.`)) return;
    hide.mutate({ external_id: id, hidden }, { onSuccess: () => toast.success(hidden ? `${nome} ocultada do Ponto` : `${nome} restaurada`), onError: (e: any) => toast.error(e.message ?? 'Erro') });
  };

  const occKey = useMemo(() => {
    const m = new Map<string, TeamOccurrence[]>();
    for (const o of data.occurrences) {
      const k = `${o.employee_external_id}|${o.dia}`;
      const arr = m.get(k);
      if (arr) arr.push(o); else m.set(k, [o]);
    }
    return m;
  }, [data.occurrences]);

  const rows = useMemo<PersonRow[]>(() => data.employees.map(e => {
    const days = data.daily.filter(d => d.employee_external_id === e.external_id && d.dia >= start && d.dia <= end).sort((a, b) => b.dia.localeCompare(a.dia));
    const cls = days.map(d => ({ d, c: classifyDay(d, e.horario_previsto), occ: occKey.get(`${e.external_id}|${d.dia}`) ?? [] }));
    const problemas = cls.filter(x => dayProblem(x.d, x.c, x.occ));
    return {
      e, cls, problemas,
      pend: problemas.length > 0,
      faltas: cls.filter(x => x.c.faltaDia).length,
      devidasMin: cls.reduce((s, x) => s + x.c.faltaMin, 0),
      extrasMin: cls.reduce((s, x) => s + x.c.extraMin, 0),
      incDias: cls.filter(x => x.d.situacao === 'incompleta').length,
    };
  }).sort((a, b) => a.e.nome.localeCompare(b.e.nome)), [data.employees, data.daily, occKey, start, end]);

  const count = (f: (r: PersonRow) => boolean) => rows.filter(f).length;
  const totDevidas = rows.reduce((s, r) => s + r.devidasMin, 0);
  const totExtras = rows.reduce((s, r) => s + r.extrasMin, 0);
  const totFaltas = rows.reduce((s, r) => s + r.faltas, 0);
  const totInc = rows.reduce((s, r) => s + r.incDias, 0);
  const totProblemas = rows.reduce((s, r) => s + r.problemas.length, 0);
  const cards: { k: CardKey; label: string; v: number | string; sub?: string; icon: typeof Users; f: (r: PersonRow) => boolean }[] = [
    { k: 'all', label: 'Colaboradoras', v: rows.length, icon: Users, f: () => true },
    { k: 'pendencias', label: 'Pendências', v: count(r => r.pend), sub: totProblemas ? `${totProblemas} ${totProblemas === 1 ? 'dia' : 'dias'} com problema` : undefined, icon: ListChecks, f: r => r.pend },
    { k: 'devidas', label: 'Atrasos / horas devidas', v: count(r => r.devidasMin > 0), sub: totDevidas ? `${minToHhmm(totDevidas)} no período` : undefined, icon: Hourglass, f: r => r.devidasMin > 0 },
    { k: 'extras', label: 'Horas extras', v: count(r => r.extrasMin > 0), sub: totExtras ? `${minToHhmm(totExtras)} no período` : undefined, icon: Timer, f: r => r.extrasMin > 0 },
    { k: 'faltas', label: 'Faltas (dias)', v: totFaltas, sub: totFaltas ? `${count(r => r.faltas > 0)} ${count(r => r.faltas > 0) === 1 ? 'pessoa' : 'pessoas'}` : undefined, icon: CalendarX2, f: r => r.faltas > 0 },
    { k: 'incompletas', label: 'Batidas faltando', v: totInc, sub: totInc ? `${count(r => r.incDias > 0)} ${count(r => r.incDias > 0) === 1 ? 'pessoa' : 'pessoas'}` : undefined, icon: AlertTriangle, f: r => r.incDias > 0 },
  ];
  const cardF = cards.find(c => c.k === card)!.f;
  const filtered = rows.filter(r =>
    cardF(r) &&
    (who === 'all' || r.e.external_id === who) &&
    (sit === 'all' || r.cls.some(x => x.d.situacao === sit)),
  );

  // Situação de um único dia — mesma regra das três telas do Ponto.
  const diaSit = (x?: PersonRow['cls'][number]) => {
    if (!x) return { t: SIT_LABEL.aguardando, s: SIT_STYLE.aguardando };
    const { d, c } = x;
    if (c.emAndamento) return { t: 'Em andamento', s: SIT_STYLE.em_andamento };
    if (c.faltaDia) return { t: 'Falta', s: SIT_STYLE.falta };
    if (c.faltaMin > 0) return { t: `Atraso/saída antes · ${minToHhmm(c.faltaMin)}`, s: SIT_STYLE.atraso };
    return { t: SIT_LABEL[d.situacao], s: SIT_STYLE[d.situacao] };
  };

  const hiddenBlock = (!!data.hidden?.length || canEdit) && (
    <div className="space-y-1">
      {canEdit && !!data.hidden?.length && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowHidden(v => !v)}>{showHidden ? 'Esconder ocultos' : `Ver ocultos (${data.hidden.length})`}</Button>}
      {showHidden && !!data.hidden?.length && (
        <div className="space-y-1 rounded-md bg-muted/30 p-2">{data.hidden.map(h => (
          <div key={h.external_id} className="flex items-center gap-2 text-xs">
            <span className="font-medium">{h.nome}</span><span className="text-muted-foreground">{h.matricula ?? ''}</span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" disabled={hide.isPending || !canEdit} onClick={() => setHidden(h.external_id, h.nome, false)}><Undo2 className="h-3 w-3" />Restaurar</Button>
          </div>
        ))}</div>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="conferencia">
      <TabsList><TabsTrigger value="conferencia">Conferência</TabsTrigger><TabsTrigger value="acessos">Logins e justificativas</TabsTrigger></TabsList>
      <TabsContent value="acessos"><AccessAndJustifications data={data} date={spToday()} canEdit={canEdit} /></TabsContent>
      <TabsContent value="conferencia" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {cards.map(c => (
            <button key={c.k} type="button" onClick={() => setCard(card === c.k ? 'all' : c.k)} className={`rounded-lg border p-3 text-left transition-colors ${card === c.k ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}>
              <c.icon className="h-4 w-4 text-primary" />
              <div className="mt-2 text-2xl font-semibold">{c.v}</div>
              <div className="text-[11px] text-muted-foreground">{c.label}</div>
              {c.sub && <div className="mt-0.5 text-[10px] font-medium text-warning">{c.sub}</div>}
            </button>
          ))}
        </div>

        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as pessoas</SelectItem>{data.employees.map(e => <SelectItem key={e.external_id} value={e.external_id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sit} onValueChange={v => setSit(v as typeof sit)}>
              <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as situações</SelectItem>{(Object.keys(SIT_LABEL) as TeamSituacao[]).map(s => <SelectItem key={s} value={s}>{SIT_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            {hiddenBlock}
          </div>

          {mode === 'hoje' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>{['Nome', 'Batidas', 'Extras', 'Devidas', 'Situação'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhuma colaboradora neste filtro.</td></tr>}
                  {filtered.map(r => {
                    const x = r.cls[0];
                    const s = diaSit(x);
                    return (
                      <tr key={r.e.external_id} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-2 font-medium"><span className="inline-flex items-center gap-1">{r.e.nome}{canEdit && <Button size="sm" variant="ghost" className="h-6 px-1 text-muted-foreground" disabled={hide.isPending} onClick={() => setHidden(r.e.external_id, r.e.nome, true)} title="Ocultar do Ponto" aria-label={`Ocultar ${r.e.nome}`}><Trash2 className="h-3 w-3" /></Button>}</span></td>
                        <td className="px-3 py-2"><BatidasCelula previsto={x ? (x.d.horario_previsto ?? r.e.horario_previsto) : null} marcacoes={x?.d.marcacoes} /></td>
                        <td className="px-3 py-2 font-medium text-info">{x?.c.extraMin ? `+${minToHhmm(x.c.extraMin)}` : '—'}</td>
                        <td className="px-3 py-2 font-medium text-progress">{x?.c.faltaMin ? minToHhmm(x.c.faltaMin) : '—'}</td>
                        <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.s}`}>{s.t}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>{['Nome', 'Extras no período', 'Devidas no período', 'Faltas (dias)', 'Dias com problema'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhuma colaboradora neste filtro.</td></tr>}
                  {filtered.map(r => (
                    <Fragment key={r.e.external_id}>
                      <tr className={`cursor-pointer border-t border-border ${open === r.e.external_id ? 'bg-muted/30' : 'hover:bg-muted/30'}`} onClick={() => setOpen(open === r.e.external_id ? null : r.e.external_id)}>
                        <td className="whitespace-nowrap px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5">{open === r.e.external_id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}{r.e.nome}{canEdit && <Button size="sm" variant="ghost" className="h-6 px-1 text-muted-foreground" disabled={hide.isPending} onClick={ev => { ev.stopPropagation(); setHidden(r.e.external_id, r.e.nome, true); }} title="Ocultar do Ponto" aria-label={`Ocultar ${r.e.nome}`}><Trash2 className="h-3 w-3" /></Button>}</span></td>
                        <td className="px-3 py-2 font-medium text-info">{r.extrasMin ? `+${minToHhmm(r.extrasMin)}` : '—'}</td>
                        <td className="px-3 py-2 font-medium text-progress">{r.devidasMin ? minToHhmm(r.devidasMin) : '—'}</td>
                        <td className="px-3 py-2 font-medium text-destructive">{r.faltas || '—'}</td>
                        <td className="px-3 py-2">{r.problemas.length || '—'}</td>
                      </tr>
                      {open === r.e.external_id && r.cls.map(({ d, c }) => {
                        const s = diaSit({ d, c, occ: occKey.get(`${r.e.external_id}|${d.dia}`) ?? [] });
                        return (
                          <tr key={d.dia} className="bg-muted/20 text-[11px]">
                            <td className="whitespace-nowrap px-3 py-1.5 pl-7"><strong>{fmtDate(d.dia)}</strong></td>
                            <td className="px-3 py-1.5"><BatidasCelula previsto={d.horario_previsto ?? r.e.horario_previsto} marcacoes={d.marcacoes} /></td>
                            <td className="px-3 py-1.5 text-right">{c.emAndamento ? '—' : d.horas_trabalhadas || '—'}</td>
                            <td className="px-3 py-1.5 text-right text-info">{c.extraMin ? `+${minToHhmm(c.extraMin)}` : '—'}</td>
                            <td className="px-3 py-1.5 text-right text-progress">{c.faltaMin ? minToHhmm(c.faltaMin) : '—'}</td>
                            <td className="px-3 py-1.5"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.s}`}>{s.t}</span></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-border p-2 text-[10px] text-muted-foreground">Somente consulta. Correções, justificativas e aprovações continuam no PontoFopag.</p>
        </section>
      </TabsContent>
    </Tabs>
  );
}

export function hhmmToMin(v?: string | null): number {
  const m = v?.trim().match(/^([+-])?(\d{1,3}):(\d{2})$/);
  if (!m) return 0;
  const n = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -n : n;
}
export function minToHhmm(n: number): string {
  const a = Math.abs(n);
  return `${n < 0 ? '-' : ''}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** Regra única do Ponto: falta do dia inteiro, minutos faltando e extras. */
export function classifyDay(d: TeamTimeData['daily'][number] | undefined, previstoEmp: string | null, today = spToday()) {
  if (!d) return { faltaDia: false, faltaMin: 0, extraMin: 0, emAndamento: false };
  const isToday = d.dia === today;
  const semBatida = !(d.marcacoes?.length) && !d.primeira_marcacao;
  const prev = (d.horario_previsto ?? previstoEmp ?? '').split(/\s+/).find(x => TIME_RE.test(x));
  const syncMin = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d.synced_at)) |> undefined;
  return { faltaDia, faltaMin: 0, extraMin: 0, emAndamento: false };
}

function AccessAndJustifications({ data, date, canEdit }: { data: TeamTimeData; date: string; canEdit: boolean }) {
  const { user } = useAuth();
  const link = useLinkEmployeeUser();
  const review = useReviewJustification();
  const just = useTeamJustifications(date.slice(0, 7), true);
  const users = useQuery({
    queryKey: ['team-time-logins'], enabled: canEdit,
    queryFn: async () => { const { data: p } = await supabase.from('profiles').select('user_id,email').order('email'); return (p ?? []) as { user_id: string; email: string }[]; },
  });
  const nameBy = new Map(data.employees.map(e => [e.external_id, e.nome]));
  const onLink = async (ext: string, v: string) => {
    try { await link.mutateAsync({ external_id: ext, user_id: v === 'none' ? null : v }); toast.success('Login vinculado atualizado.'); }
    catch { toast.error('Não foi possível vincular o login.'); }
  };
  const th = 'whitespace-nowrap px-3 py-2 font-medium';
  const ST: Record<string, string> = { pendente: 'border-warning/40 bg-warning/10 text-warning', aceita: 'border-success/40 bg-success/10 text-success', recusada: 'border-destructive/40 bg-destructive/10 text-destructive' };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Login de cada colaboradora</h2>
        <p className="text-[11px] text-muted-foreground">Quem tiver login vinculado vê somente o próprio ponto na Central e pode justificar dias com falta ou batida faltando.</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr><th className={th}>Colaboradora</th><th className={th}>Login vinculado</th></tr></thead>
          <tbody>{data.employees.map(e => <tr key={e.external_id} className="border-t border-border"><td className="px-3 py-2 font-medium">{e.nome}</td><td className="px-3 py-2">
            <Select value={e.user_id ?? 'none'} disabled={!canEdit || link.isPending} onValueChange={v => onLink(e.external_id, v)}>
              <SelectTrigger className="h-8 w-64 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem login</SelectItem>{(users.data ?? []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.email}</SelectItem>)}</SelectContent>
            </Select></td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Justificativas do mês</h2>
        {!just.data?.length ? <p className="rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">Nenhuma justificativa neste mês.</p> :
        <div className="space-y-2">{just.data.map(j => <div key={j.id} className="rounded-lg border border-border bg-card p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2"><strong>{nameBy.get(j.employee_external_id) ?? j.employee_external_id}</strong><span className="text-muted-foreground">{fmtDate(j.dia)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ST[j.status]}`}>{j.status === 'pendente' ? 'Pendente' : j.status === 'aceita' ? 'Aceita' : 'Recusada'}</span></div>
          <p className="mt-1 whitespace-pre-wrap">{j.motivo}</p>
          {canEdit && user && <div className="mt-2 flex gap-2">
            {j.status !== 'aceita' && <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={review.isPending} onClick={() => review.mutate({ id: j.id, status: 'aceita', reviewer: user.id })}>Aceitar</Button>}
            {j.status !== 'recusada' && <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={review.isPending} onClick={() => review.mutate({ id: j.id, status: 'recusada', reviewer: user.id })}>Recusar</Button>}
          </div>}
        </div>)}</div>}
      </section>
    </div>
  );
}
