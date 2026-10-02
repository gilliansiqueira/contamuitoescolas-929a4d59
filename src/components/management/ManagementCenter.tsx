import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { School } from '@/types/financial';
import { useAuth } from '@/hooks/useAuth';
import {
  useManagementResponsibleDisplayNames,
  useManagementPortfolio,
  useManagementResponsibleCandidates,
  useSetManagementResponsible,
  useSetManagementResponsibleDisplayName,
  useManagementDailyStatus,
  useManagementBacklog,
  useManagementBankAvailability,
  todaySaoPaulo,
  type DailyStatusRow,
  type PortfolioRow,
} from '@/hooks/useManagementPortfolio';
import { ReconciliationBacklog } from '@/components/management/ReconciliationBacklog';
import { MyDayPanel, type MyDayPendingItem } from '@/components/management/MyDayPanel';
import { useAddSchool } from '@/hooks/useFinancialData';
import { useClosingStepTemplates, useEnsureMonthlyChecklist, useDailyTasksSummary, useMonthlyChecklistSummary } from '@/hooks/useClosingSteps';
import { ClosingStepTemplatesDialog, SchoolStepsDialog } from '@/components/management/ClosingStepsDialog';
import { TeamTimePanel } from '@/components/team/TeamTimePanel';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  Search,
  UserX,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  schools: School[];
  onSelect: (school: School) => void;
  onSignOut: () => void;
}

type Situation = 'all' | 'finalizado' | 'bloqueado' | 'atrasado' | 'atencao' | 'em_dia' | 'sem_etapas';
type ManagementView = 'portfolio' | 'closing' | 'pending' | 'responsible' | 'team_time';
type RowStatus = Exclude<Situation, 'all'>;

const statusLabels: Record<RowStatus, string> = {
  finalizado: 'Concluída',
  bloqueado: 'Aguardando cliente',
  atrasado: 'Atrasada',
  atencao: 'Em andamento',
  em_dia: 'Em dia',
  sem_etapas: 'Sem etapas cadastradas',
};

const statusStyles: Record<RowStatus, string> = {
  finalizado: 'bg-success text-success-foreground font-semibold shadow-sm',
  bloqueado: 'bg-info text-info-foreground font-semibold shadow-sm',
  atrasado: 'bg-destructive text-destructive-foreground font-semibold shadow-sm',
  atencao: 'bg-progress text-progress-foreground font-semibold shadow-sm',
  em_dia: 'bg-success text-success-foreground font-semibold shadow-sm',
  sem_etapas: 'bg-muted-foreground/70 text-background font-semibold',
};

type ReconDot = 'ok' | 'pending' | 'late' | 'unavailable';
const reconDotStyles: Record<ReconDot, string> = {
  ok: 'bg-success ring-4 ring-success/20',
  pending: 'bg-progress ring-4 ring-progress/25',
  late: 'bg-destructive ring-4 ring-destructive/25',
  unavailable: 'bg-muted-foreground/60 ring-4 ring-muted',
};
const reconDotLabels: Record<ReconDot, string> = {
  ok: 'Conciliação em dia', pending: 'Pendências do dia', late: 'Conciliação atrasada', unavailable: 'Conciliação indisponível',
};

function ReconStatusDot({ state, schoolName }: { state: ReconDot; schoolName: string }) {
  const label = `${schoolName}: ${reconDotLabels[state]}`;
  return <span role="img" aria-label={label} title={label} className={`inline-block h-3 w-3 shrink-0 rounded-full ${reconDotStyles[state]}`} />;
}

const rowAccent: Record<RowStatus, string> = {
  finalizado: 'border-l-success',
  bloqueado: 'border-l-info bg-info/[0.04]',
  atrasado: 'border-l-destructive bg-destructive/[0.06]',
  atencao: 'border-l-progress',
  em_dia: 'border-l-success',
  sem_etapas: 'border-l-muted-foreground/30',
};

const viewLabels: Record<ManagementView, string> = {
  portfolio: 'Carteira de clientes', closing: 'Relatórios', pending: 'Pendências', responsible: 'Por responsável', team_time: 'Ponto da Equipe',
};

type PeriodMode = 'hoje' | 'ontem' | 'mes';
const periodModeLabels: Record<PeriodMode, string> = { hoje: 'Hoje (ao vivo)', ontem: 'Dia anterior', mes: 'Mês' };
const reportGroups = [
  { key: 'projecao', label: 'Projeção', icon: CalendarDays, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary' },
  { key: 'despesas', label: 'Análise de despesas', icon: FileCheck2, tone: 'text-progress-foreground bg-progress', strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress' },
  { key: 'kpis', label: 'KPIs', icon: ListChecks, tone: 'text-info-foreground bg-info', strip: 'border-t-info bg-info/[0.07]', num: 'text-info' },
  { key: 'receitas', label: 'Vendas e receitas', icon: Building2, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary' },
  { key: 'contatos', label: 'Contatos e matrículas', icon: Users, tone: 'text-progress-foreground bg-progress', strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress' },
  { key: 'envio', label: 'Texto e entrega', icon: FileCheck2, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary' },
] as const;
// Horários limite (São Paulo) para marcar a conciliação do dia como atrasada.
const LATE_NO_STATEMENT_HOUR = 12;
const LATE_INCOMPLETE_HOUR = 15;

// Cada card do topo também é um filtro da lista: a regra que conta o número do
// card é a mesma que decide quais empresas aparecem na tabela, então os dois
// sempre batem.
type CardMatch = (row: PortfolioRow, daily: DailyStatusRow | undefined, backlogCount: number) => boolean;
interface CardDef { key: string; label: string; icon: LucideIcon; tone: string; strip: string; num: string; match: CardMatch }

type DailyReconState = 'unavailable' | 'no_statement' | 'not_started' | 'in_progress' | 'done';
function dailyReconState(daily: DailyStatusRow | undefined, bankAvailable: boolean): DailyReconState {
  if (!bankAvailable || !daily) return 'unavailable';
  if (!daily.statement_received) return 'no_statement';
  if (daily.recon_required === 0 || daily.recon_pending === 0) return 'done';
  return daily.reconciled_today > 0 ? 'in_progress' : 'not_started';
}

/** Dia (yyyy-mm-dd, fuso de São Paulo) de um timestamp; null quando não há. */
function spDay(iso: string | null) {
  return iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) : null;
}

function cardDefsFor(mode: PeriodMode, today: string, available: (row: PortfolioRow, daily?: DailyStatusRow) => boolean): CardDef[] {
  if (mode === 'mes') return [
    { key: 'all', label: 'Empresas ativas', icon: Building2, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary', match: () => true },
    { key: 'updated_today', label: 'Atualizadas hoje', icon: CalendarDays, tone: 'text-success-foreground bg-success', strip: 'border-t-success bg-success/[0.08]', num: 'text-success', match: row => row.data_updated_through === today },
    { key: 'recon_pending', label: 'Conciliação pendente', icon: AlertCircle, tone: 'text-progress-foreground bg-progress', strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress', match: row => row.reconciliation_pending > 0 },
    { key: 'closing_pending', label: 'Relatório pendente', icon: FileCheck2, tone: 'text-destructive-foreground bg-destructive', strip: 'border-t-destructive bg-destructive/[0.07]', num: 'text-destructive', match: row => !row.period_closed || !row.report_delivered },
  ];
  if (mode === 'hoje') return [
     { key: 'no_statement', label: 'Extrato não enviado', icon: AlertCircle, tone: 'text-destructive-foreground bg-destructive', strip: 'border-t-destructive bg-destructive/[0.07]', num: 'text-destructive', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'no_statement' },
     { key: 'not_started', label: 'Aguardando início', icon: UserX, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'not_started' },
     { key: 'in_progress', label: 'Conciliação em andamento', icon: Clock3, tone: 'text-progress-foreground bg-progress', strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'in_progress' },
     { key: 'done_today', label: 'Concluídas hoje', icon: CheckCircle2, tone: 'text-success-foreground bg-success', strip: 'border-t-success bg-success/[0.08]', num: 'text-success', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'done' },
     { key: 'no_bank', label: 'Sem Fluxo Bancário', icon: Building2, tone: 'text-muted-foreground bg-muted', strip: 'border-t-muted-foreground bg-muted/40', num: 'text-muted-foreground', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'unavailable' },
  ];
  return [
     { key: 'no_statement', label: 'Extrato não enviado', icon: AlertCircle, tone: 'text-destructive-foreground bg-destructive', strip: 'border-t-destructive bg-destructive/[0.07]', num: 'text-destructive', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'no_statement' },
     { key: 'closed_100', label: 'Concluídas', icon: CheckCircle2, tone: 'text-success-foreground bg-success', strip: 'border-t-success bg-success/[0.08]', num: 'text-success', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'done' },
     { key: 'not_started', label: 'Aguardando início', icon: UserX, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'not_started' },
     { key: 'left_pending', label: 'Deixaram pendência', icon: Clock3, tone: 'text-progress-foreground bg-progress', strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'in_progress' },
    { key: 'backlog', label: 'Pendências acumuladas', icon: FileCheck2, tone: 'text-primary-foreground bg-primary', strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary', match: (_row, _daily, backlogCount) => backlogCount > 0 },
     { key: 'no_bank', label: 'Sem Fluxo Bancário', icon: Building2, tone: 'text-muted-foreground bg-muted', strip: 'border-t-muted-foreground bg-muted/40', num: 'text-muted-foreground', match: (row, daily) => dailyReconState(daily, available(row, daily)) === 'unavailable' },
  ];
}

function spHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
}
function dayPercent(d?: DailyStatusRow) {
  if (!d || d.recon_required === 0) return null;
  return Math.round((d.reconciled / d.recon_required) * 1000) / 10;
}
function isLateToday(d?: DailyStatusRow) {
  if (!d) return false;
  const h = spHour();
  if (!d.statement_received) return h >= LATE_NO_STATEMENT_HOUR;
  const pct = dayPercent(d);
  return pct != null && pct < 100 && h >= LATE_INCOMPLETE_HOUR;
}
function relativeTime(iso: string | null, today: string) {
  if (!iso) return 'Sem atividade';
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
  if (day !== today) return `Sem atividade hoje (última ${date.toLocaleDateString('pt-BR')})`;
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  return mins < 60 ? `Ativa há ${mins} min` : `Ativa há ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
}

/** Tempo decorrido desde a última alteração na empresa (ex.: "há 2 h", "há 3 dias"). */
function lastActivityLabel(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 2) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

function lastActivityTitle(iso: string | null) {
  if (!iso) return 'Nenhuma alteração registrada';
  return `Última alteração em ${new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
}

const displayNameSchema = z.string().trim().min(1, 'Digite um nome.').max(60, 'Use no máximo 60 caracteres.');

function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('pt-BR'));
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? ''}`.toLocaleUpperCase('pt-BR');
}

function statusOf(row: PortfolioRow, month: string, dueDate?: string | null): RowStatus {
  if (row.period_closed && row.report_delivered && row.checklist_pending === 0) return 'finalizado';
  if (row.waiting_for_client) return 'bloqueado';
  if (row.closing_percent == null && !row.report_delivered && !row.period_closed) return 'sem_etapas';
  // Prazo oficial: 5º dia útil do mês seguinte (report_due_date no banco).
  const todaySp = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const late = dueDate ? todaySp > dueDate : month < new Date().toISOString().slice(0, 7);
  if (late && !row.report_delivered) return 'atrasado';
  if (row.reconciliation_pending > 0 || row.checklist_pending > 0) return 'atencao';
  return 'em_dia';
}

function progressTone(percent: number) {
  if (percent >= 100) return { bar: '[&>div]:bg-success', text: 'text-success' };
  if (percent >= 50) return { bar: '[&>div]:bg-info', text: 'text-info' };
  return { bar: '[&>div]:bg-progress', text: 'text-progress' };
}

function formatPeriodLong(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1)).replace(/^./, letter => letter.toLocaleUpperCase('pt-BR'));
}

function formatDate(date: string | null) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem dados';
}

function ProgressRing({ value, label, tone }: { value: number | null; label: string; tone: 'success' | 'warning' }) {
  const normalized = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative h-14 w-14 shrink-0" aria-label={`${label}: ${value == null ? 'Indisponível' : `${value}%`}`}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="21" cy="21" r="16" fill="none" pathLength="100" strokeWidth="4" className="stroke-muted" />
          {value != null && <circle cx="21" cy="21" r="16" fill="none" pathLength="100" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${normalized} 100`} className={tone === 'success' ? 'stroke-success' : 'stroke-primary'} />}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{value == null ? '—' : `${value}%`}</span>
      </div>
      <div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="truncate text-xs font-medium">{value == null ? 'Indisponível' : value === 100 ? 'Concluída' : 'Em andamento'}</p></div>
    </div>
  );
}

export function ManagementCenter({ schools, onSelect, onSignOut }: Props) {
  const { isSuperAdmin, profile } = useAuth();
  // Padrão: mês do relatório em produção (mês anterior).
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('sv-SE').slice(0, 7); });
  const { data: dueDate = null } = useQuery({
    queryKey: ['report-due-date', month],
    enabled: /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('report_due_date', { _month: month });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
  const dueInfo = useMemo(() => {
    if (!dueDate) return null;
    const todaySp = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const days = Math.round((Date.parse(dueDate) - Date.parse(todaySp)) / 86400000);
    const label = `${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}`;
    const text = days < 0 ? `prazo ${label} · atrasado ${-days} dia(s)` : days === 0 ? `prazo hoje (${label})` : `prazo ${label} · faltam ${days} dia(s)`;
    const tone = days < 0 ? 'bg-destructive text-destructive-foreground' : days <= 2 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground';
    return { text, tone };
  }, [dueDate]);
  const [search, setSearch] = useState('');
  const [situation, setSituation] = useState<Situation>('all');
  const [view, setView] = useState<ManagementView>('portfolio');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [stepsSchool, setStepsSchool] = useState<{ id: string; name: string } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>('ontem');
  const [focusSchoolId, setFocusSchoolId] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [cardGroupMode, setCardGroupMode] = useState<'open' | 'done'>('open');
  // Painel "Meu dia": por padrão a pessoa logada; super admin pode ver o de outra.
  const [myDayPerson, setMyDayPerson] = useState<string | null>(null);
  const today = todaySaoPaulo();
  const qc = useQueryClient();
  const [toggleSchool, setToggleSchool] = useState<{ id: string; name: string; ativo: boolean } | null>(null);
  const [toggling, setToggling] = useState(false);
  const { data: inactiveSchools = [] } = useQuery({
    queryKey: ['schools', 'inactive'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('schools').select('id, nome').eq('ativo', false).order('nome');
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const { data: dailyRows = [], isLoading: dailyLoading } = useManagementDailyStatus(today, true);
  const { data: backlog = [], isLoading: backlogLoading } = useManagementBacklog(today, true);
  const { data: bankStartMonths, isLoading: bankLoading } = useManagementBankAvailability(true);
  const { data: rows = [], isLoading, isError } = useManagementPortfolio(month, true);
  const { data: responsibleCandidates = [] } = useManagementResponsibleCandidates(isSuperAdmin);
  const { data: displayNames = [] } = useManagementResponsibleDisplayNames(true);
  const { data: stepTemplates = [] } = useClosingStepTemplates(true);
  const { data: monthlySteps, isLoading: monthlyStepsLoading } = useMonthlyChecklistSummary(month, view === 'closing');
  const ensureChecklist = useEnsureMonthlyChecklist();
  const setResponsible = useSetManagementResponsible(month);
  const setDisplayName = useSetManagementResponsibleDisplayName();
  const addSchool = useAddSchool();

  // Gera as etapas do mês e roda as conferências automáticas (idempotente, uma vez por empresa/mês na sessão)
  const ensuredRef = useRef(new Set<string>());
  useEffect(() => {
    if (stepTemplates.length === 0 || rows.length === 0) return;
    rows.forEach(row => {
      const key = `${row.school_id}:${month}`;
      if (ensuredRef.current.has(key)) return;
      ensuredRef.current.add(key);
      ensureChecklist.mutate({ schoolId: row.school_id, month });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, stepTemplates.length, month]);
   const { data: dailyTasksBySchool = new Map<string, { done: number; total: number }>() } = useDailyTasksSummary(rows.map(row => row.school_id), today);

  const schoolById = useMemo(() => new Map(schools.map(school => [school.id, school])), [schools]);
  const candidatesBySchool = useMemo(() => {
    const grouped = new Map<string, typeof responsibleCandidates>();
    responsibleCandidates.forEach(candidate => grouped.set(candidate.school_id, [...(grouped.get(candidate.school_id) ?? []), candidate]));
    return grouped;
  }, [responsibleCandidates]);
  const displayNameByUser = useMemo(() => new Map(displayNames.map(item => [item.user_id, item.display_name])), [displayNames]);
  const dailyBySchool = useMemo(() => new Map(dailyRows.map(d => [d.school_id, d])), [dailyRows]);
  const bankAvailable = (row: PortfolioRow, daily?: DailyStatusRow) => {
    const start = bankStartMonths?.get(row.school_id);
    return !!daily && !!start && start <= daily.ref_day.slice(0, 7);
  };
  const backlogBySchool = useMemo(() => { const m = new Map<string, number>(); backlog.forEach(b => m.set(b.school_id, (m.get(b.school_id) ?? 0) + 1)); return m; }, [backlog]);
  const reconDotOf = (row: PortfolioRow): ReconDot => {
    const daily = dailyBySchool.get(row.school_id);
    const startMonth = bankStartMonths?.get(row.school_id);
    if (dailyLoading || backlogLoading || bankLoading || !daily || !startMonth || startMonth > daily.ref_day.slice(0, 7)) return 'unavailable';
    if (!daily.statement_received || backlog.some(item => item.school_id === row.school_id && item.data < daily.ref_day)) return 'late';
    if (daily.recon_pending > 0) return 'pending';
    return 'ok';
  };
  const responsibleLabelOf = (row: PortfolioRow) => row.responsible_email ? (displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : 'Sem responsável';
  const schoolInfo = useMemo(() => new Map(rows.map(row => [row.school_id, { school_id: row.school_id, school_name: row.school_name, responsible_user_id: row.responsible_user_id, responsibleLabel: responsibleLabelOf(row) }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, displayNameByUser]);
  const reconValueOf = (row: PortfolioRow) => mode === 'mes' ? row.reconciliation_percent : dayPercent(dailyBySchool.get(row.school_id));

  const reportStage = useMemo(() => {
    const bySchool = new Map<string, string>();
    if (!monthlySteps) return bySchool;
    const groupByKey = new Map(stepTemplates.map(t => [t.step_key, t.group_key]));
    for (const row of rows) {
      const steps = monthlySteps.get(row.school_id) ?? [];
      if (row.report_delivered) { bySchool.set(row.school_id, 'entregue'); continue; }
      if (steps.length === 0) { bySchool.set(row.school_id, 'sem_etapas'); continue; }
      const first = reportGroups.find(g => steps.some(s => s.status === 'open' && (groupByKey.get(s.step_key) === g.key || (g.key === 'receitas' && groupByKey.get(s.step_key) === 'vendas'))));
      bySchool.set(row.school_id, first?.key ?? (steps.some(s => s.status === 'open') ? 'extras' : 'entregue'));
    }
    return bySchool;
  }, [monthlySteps, rows, stepTemplates]);
  // Cada card agrupa várias etapas: pendente = alguma etapa aberta; concluída = todas fechadas (ou relatório entregue).
  const { openGroups, doneGroups } = useMemo(() => {
    const open = new Map<string, Set<string>>();
    const done = new Map<string, Set<string>>();
    if (!monthlySteps) return { openGroups: open, doneGroups: done };
    const groupByKey = new Map(stepTemplates.map(t => [t.step_key, t.group_key]));
    for (const row of rows) {
      const seen = new Set<string>(); const o = new Set<string>();
      for (const s of monthlySteps.get(row.school_id) ?? []) {
        if (s.status === 'not_applicable') continue;
        const g0 = groupByKey.get(s.step_key); if (!g0) continue;
        const g = g0 === 'vendas' ? 'receitas' : g0;
        seen.add(g);
        if (s.status === 'open' && !row.report_delivered) o.add(g);
      }
      open.set(row.school_id, o);
      done.set(row.school_id, new Set([...seen].filter(g => !o.has(g))));
    }
    return { openGroups: open, doneGroups: done };
  }, [monthlySteps, rows, stepTemplates]);
  const cardDefs = useMemo(() => view === 'closing' ? [
    ...reportGroups.map(g => ({ ...g, reportGroup: true, match: (row: PortfolioRow) => !!(cardGroupMode === 'done' ? doneGroups : openGroups).get(row.school_id)?.has(g.key) })),
    { key: 'sem_etapas', label: 'Outras pendências', icon: AlertCircle, tone: 'text-destructive-foreground bg-destructive', strip: 'border-t-destructive bg-destructive/[0.07]', num: 'text-destructive', match: (row: PortfolioRow) => reportStage.get(row.school_id) === 'sem_etapas' || reportStage.get(row.school_id) === 'extras' },
    { key: 'entregue', label: 'Entregues', icon: CheckCircle2, tone: 'text-success-foreground bg-success', strip: 'border-t-success bg-success/[0.08]', num: 'text-success', match: (row: PortfolioRow) => reportStage.get(row.school_id) === 'entregue' },
  ] : cardDefsFor(mode, today, bankAvailable), [view, mode, today, bankStartMonths, reportStage, openGroups, doneGroups, cardGroupMode]);
  const activeCard = cardDefs.find(card => card.key === cardFilter) ?? null;

  // Busca, visão e situação. O filtro do card é aplicado depois, em `filtered`.
  const baseFiltered = useMemo(() => rows.filter(row => {
    const term = search.toLocaleLowerCase('pt-BR');
    const matchesSearch = row.school_name.toLocaleLowerCase('pt-BR').includes(term)
      || (row.responsible_email ?? '').toLocaleLowerCase('pt-BR').includes(term)
      || (row.responsible_user_id ? (displayNameByUser.get(row.responsible_user_id) ?? '').toLocaleLowerCase('pt-BR').includes(term) : false);
    const status = statusOf(row, month, dueDate);
    const matchesView = view === 'portfolio'
      || view === 'closing'
      || (view === 'pending' && (row.reconciliation_pending > 0 || row.checklist_pending > 0 || row.waiting_for_client))
      || (view === 'responsible' && !!row.responsible_user_id);
    return matchesSearch && matchesView && (mode !== 'mes' || situation === 'all' || status === situation);
  }), [displayNameByUser, month, dueDate, mode, rows, search, situation, view]);

  const filtered = useMemo(() => {
    if (!activeCard) return baseFiltered;
    return baseFiltered.filter(row => activeCard.match(row, dailyBySchool.get(row.school_id), backlogBySchool.get(row.school_id) ?? 0));
  }, [activeCard, baseFiltered, dailyBySchool, backlogBySchool]);

  const responsibleGroups = useMemo(() => {
    if (view !== 'responsible') return [];
    const map = new Map<string, PortfolioRow[]>();
    filtered.forEach(row => {
      const key = row.responsible_user_id ?? '__none';
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    const avg = (values: number[]) => values.length === 0 ? null : Math.round(values.reduce((total, value) => total + value, 0) / values.length);
    return [...map.entries()].map(([key, groupRows]) => {
      const statusCounts = { finalizado: 0, atrasado: 0, bloqueado: 0 };
      let pending = 0;
      groupRows.forEach(row => {
        const status = statusOf(row, month, dueDate);
        if (status === 'finalizado' || status === 'atrasado' || status === 'bloqueado') statusCounts[status] += 1;
        pending += row.reconciliation_pending + row.checklist_pending;
      });
      const email = key === '__none' ? 'Não definida' : (groupRows.find(row => row.responsible_user_id === key)?.responsible_email ?? 'Não definida');
      return {
        key, email,
        label: key === '__none' ? 'Não definida' : (displayNameByUser.get(key) ?? nameFromEmail(email)),
        rows: [...groupRows].sort((a, b) => a.school_name.localeCompare(b.school_name, 'pt-BR')),
        reconciliationPercent: mode === 'mes'
          ? avg(groupRows.map(row => reconValueOf(row)).filter((value): value is number => value != null))
          : avg(groupRows.map(row => dailyBySchool.get(row.school_id)).filter((d): d is DailyStatusRow => !!d)
              .map(d => !d.statement_received ? 0 : d.recon_required === 0 ? 100 : (d.reconciled / d.recon_required) * 100)),
        withStatement: groupRows.filter(row => dailyBySchool.get(row.school_id)?.statement_received).length,
        withBank: groupRows.filter(row => !!dailyBySchool.get(row.school_id)).length,
        closingPercent: avg(groupRows.map(row => row.closing_percent).filter((value): value is number => value != null)),
        statusCounts, pending: mode === 'mes' ? pending : groupRows.reduce((t, row) => t + (backlogBySchool.get(row.school_id) ?? 0), 0),
        reconciledToday: groupRows.reduce((t, row) => t + (dailyBySchool.get(row.school_id)?.reconciled_today ?? 0), 0),
        lateCount: groupRows.filter(row => isLateToday(dailyBySchool.get(row.school_id))).length,
        lastActivity: groupRows.map(row => dailyBySchool.get(row.school_id)?.last_activity ?? null).filter((v): v is string => !!v).sort().pop() ?? null,
      };
    }).sort((a, b) => a.key === '__none' ? 1 : b.key === '__none' ? -1 : a.label.localeCompare(b.label, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayNameByUser, filtered, month, dueDate, view, mode, dailyBySchool, backlogBySchool]);

  const completedReconciliation = rows.filter(row => row.reconciliation_percent === 100).length;
  const deliveredReports = rows.filter(row => row.report_delivered).length;
  const priorities = useMemo(() => filtered
    .map(row => ({ row, status: statusOf(row, month, dueDate), pending: backlogBySchool.get(row.school_id) ?? 0 }))
    .filter(item => item.status === 'atrasado' || item.status === 'bloqueado' || item.pending > 0 || !!item.row.next_action)
    .sort((a, b) => {
      const weight = (item: typeof a) => item.status === 'atrasado' ? 0 : item.status === 'bloqueado' ? 1 : item.pending > 0 ? 2 : 3;
      return weight(a) - weight(b) || b.pending - a.pending;
    }).slice(0, 4), [filtered, month, dueDate, backlogBySchool]);
  const refDay = dailyRows[0]?.ref_day ?? null;
  const withMovementBase = useMemo(() => baseFiltered.filter(row => {
    const daily = dailyBySchool.get(row.school_id);
    return !!daily && bankAvailable(row, daily) && daily.recon_required > 0;
  }).length, [baseFiltered, dailyBySchool, bankStartMonths]);

  // O número do card conta as empresas que passam pela regra do card dentro dos
  // demais filtros já ativos — a mesma regra usada em `filtered`, por isso os
  // dois sempre batem.
  const summaryCards = useMemo(() => cardDefs.map(def => {
    const matched = baseFiltered.filter(row => def.match(row, dailyBySchool.get(row.school_id), backlogBySchool.get(row.school_id) ?? 0));
    const dailyMatched = matched.map(row => dailyBySchool.get(row.school_id)).filter((d): d is DailyStatusRow => !!d);
    const note = (() => {
      switch (def.key) {
        case 'no_statement': return mode === 'hoje' ? `Atrasa a partir das ${LATE_NO_STATEMENT_HOUR}h` : refDay ? `Extrato de ${formatDate(refDay)}` : 'Dia anterior';
        case 'closed_100': return `de ${withMovementBase} com movimento · sem movimento também concluída`;
        case 'left_pending': return `${dailyMatched.reduce((t, d) => t + d.recon_pending, 0)} lançamentos pendentes`;
        case 'backlog': return 'Todos os dias anteriores';
        case 'in_progress': return `${dailyMatched.filter(isLateToday).length} atrasada(s) agora`;
        case 'not_started': return mode === 'hoje' ? 'Extrato recebido; nenhuma conciliação iniciada hoje' : 'Extrato recebido; nenhuma conciliação iniciada no dia';
        case 'done_today': return `${dailyMatched.reduce((t, d) => t + d.reconciled_today, 0)} lançamentos conciliados hoje`;
        case 'no_bank': return 'Nenhuma conta bancária cadastrada';
        case 'all': return 'Toda a carteira';
        case 'updated_today': return 'Dados até hoje';
        case 'recon_pending': return `${completedReconciliation} já concluída${completedReconciliation === 1 ? '' : 's'}`;
        case 'closing_pending': return `${deliveredReports} relatório${deliveredReports === 1 ? '' : 's'} entregue${deliveredReports === 1 ? '' : 's'}`;
        default: return '';
      }
    })();
      const doneCount = view === 'closing' && (def as { reportGroup?: boolean }).reportGroup
        ? baseFiltered.filter(row => !!doneGroups.get(row.school_id)?.has(def.key)).length
        : 0;
      const reportNote = view === 'closing'
        ? def.key === 'entregue' ? 'Relatórios entregues'
        : def.key === 'sem_etapas' ? 'Sem etapas geradas ou extras pendentes'
        : `${matched.length} pendente${matched.length === 1 ? '' : 's'} · ${doneCount} concluída${doneCount === 1 ? '' : 's'}`
        : note;
      return { ...def, value: matched.length, note: reportNote, doneCount };
    }), [baseFiltered, backlogBySchool, cardDefs, completedReconciliation, dailyBySchool, deliveredReports, doneGroups, mode, refDay, withMovementBase, view]);

  // Quantidade do selo = empresas realmente filtradas (mesma regra do card).
  const activeCardCount = activeCard ? filtered.length : 0;

  const openSchool = (id: string) => { const school = schoolById.get(id); if (school) onSelect(school); };

  // ─── Painel "Meu dia" ───
  const myDayUserId = myDayPerson ?? profile?.user_id ?? null;
  const myDaySchools = useMemo(
    () => rows.filter(row => row.responsible_user_id && row.responsible_user_id === myDayUserId)
      .map(row => ({ id: row.school_id, nome: row.school_name })),
    [rows, myDayUserId],
  );
  const myDayPersonOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach(row => {
      if (row.responsible_user_id && !seen.has(row.responsible_user_id)) {
        seen.set(row.responsible_user_id, displayNameByUser.get(row.responsible_user_id) ?? (row.responsible_email ? nameFromEmail(row.responsible_email) : 'Sem nome'));
      }
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [rows, displayNameByUser]);
  const myDayPersonLabel = myDayUserId
    ? (displayNameByUser.get(myDayUserId) ?? (myDayUserId === profile?.user_id ? profileName : 'Responsável'))
    : 'Equipe';
  const myDayPendingItems = useMemo<MyDayPendingItem[]>(() => {
    const items: MyDayPendingItem[] = [];
    for (const school of myDaySchools) {
      const row = rows.find(r => r.school_id === school.id);
      if (!row) continue;
      const daily = dailyBySchool.get(school.id);
      const lateCount = backlogBySchool.get(school.id) ?? 0;
      if (lateCount > 0) items.push({ schoolId: school.id, schoolName: school.nome, tone: 'late', label: `Conciliação atrasada: ${lateCount} lançamento${lateCount === 1 ? '' : 's'} de dias anteriores` });
      if (dailyReconState(daily, bankAvailable(row, daily)) === 'no_statement') items.push({ schoolId: school.id, schoolName: school.nome, tone: 'late', label: 'Extrato não enviado' });
      const tasks = dailyTasksBySchool.get(school.id);
      if (tasks && tasks.done < tasks.total) items.push({ schoolId: school.id, schoolName: school.nome, tone: 'warn', label: `Tarefas do dia: ${tasks.done} de ${tasks.total} concluídas` });
      if (row.checklist_pending > 0 && !row.report_delivered) {
        const late = dueDate && dueDate < today;
        items.push({ schoolId: school.id, schoolName: school.nome, tone: late ? 'late' : 'warn', label: `Relatório ${month.slice(5, 7)}/${month.slice(0, 4)}: ${row.checklist_pending} etapa${row.checklist_pending === 1 ? '' : 's'} aberta${row.checklist_pending === 1 ? '' : 's'}${dueInfo ? ` · ${dueInfo.text}` : ''}` });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDaySchools, rows, dailyBySchool, backlogBySchool, dailyTasksBySchool, dueDate, dueInfo, month, today, bankStartMonths]);
  const toggleGroup = (key: string) => setExpanded(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const changeResponsible = (schoolId: string, value: string) => setResponsible.mutate(
    { schoolId, userId: value === '__none' ? null : value },
    { onSuccess: () => toast.success('Responsável atualizada.'), onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a responsável.') },
  );
  const saveDisplayName = (userId: string) => {
    const parsed = displayNameSchema.safeParse(displayNameDraft.replace(/\s+/g, ' '));
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Nome inválido.'); return; }
    setDisplayName.mutate({ userId, displayName: parsed.data }, {
      onSuccess: () => { toast.success('Nome exibido atualizado.'); setEditingUserId(null); setDisplayNameDraft(''); },
      onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o nome.'),
    });
  };
  const confirmToggle = async () => {
    if (!toggleSchool) return;
    setToggling(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('schools').update({
      ativo: toggleSchool.ativo,
      inativado_em: toggleSchool.ativo ? null : new Date().toISOString(),
      inativado_por: toggleSchool.ativo ? null : auth?.user?.id ?? null,
    }).eq('id', toggleSchool.id);
    setToggling(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(toggleSchool.ativo ? 'Empresa reativada.' : 'Empresa inativada. Histórico preservado.');
    setToggleSchool(null);
    qc.invalidateQueries();
  };
  const createSchool = async () => {
    const name = newSchoolName.trim();
    if (!name) { toast.error('Digite o nome da empresa.'); return; }
    try {
      const created = await addSchool.mutateAsync({ nome: name });
      setCreateOpen(false); setNewSchoolName(''); toast.success('Empresa criada com sucesso.');
      onSelect({ id: created.id, nome: created.nome, createdAt: created.created_at, saldoInicial: Number(created.saldo_inicial) || 0 });
    } catch { toast.error('Não foi possível criar a empresa.'); }
  };

  const navigation = [
    { key: 'portfolio' as const, label: 'Carteira de clientes', icon: Building2 },
    { key: 'closing' as const, label: 'Relatórios', icon: FileCheck2 },
    { key: 'pending' as const, label: 'Pendências', icon: AlertCircle },
    { key: 'responsible' as const, label: 'Por responsável', icon: Users },
  ];
  const profileName = profile?.email ? nameFromEmail(profile.email) : 'Equipe Conta Muito';
  const profileInitials = initialsOf(profileName);

  return (
    <div className="management-center min-h-screen bg-background lg:grid lg:grid-cols-[188px_minmax(0,1fr)]">
      <aside className="management-sidebar hidden min-h-screen flex-col lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15">
            <img src={contaMuitoLogo} alt="Conta Muito" className="h-7 w-7 object-contain brightness-0 invert" />
          </div>
          <div className="leading-none text-primary-foreground"><span className="block text-[10px] uppercase tracking-[0.16em] opacity-75">Conta</span><strong className="text-[17px] font-medium">Muito</strong></div>
        </div>
        <nav className="mt-6 flex-1 space-y-1 px-3" aria-label="Central de Clientes">
          {navigation.map(item => <Button key={item.key} type="button" variant="ghost" onClick={() => { setFocusSchoolId(null); setCardFilter(null); setView(item.key); }} className={`management-nav-item h-10 w-full justify-start gap-2.5 px-3 text-xs ${view === item.key ? 'management-nav-active' : ''}`}><item.icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></Button>)}
          {isSuperAdmin && <>
            <p className="px-3 pb-1 pt-4 text-[10px] uppercase tracking-[0.14em] text-primary-foreground/70">Equipe</p>
            <Button type="button" variant="ghost" onClick={() => { setCardFilter(null); setView('team_time'); }} className={`management-nav-item h-10 w-full justify-start gap-2.5 px-3 text-xs ${view === 'team_time' ? 'management-nav-active' : ''}`}><Clock3 className="h-4 w-4 shrink-0" /><span>Ponto da Equipe</span></Button>
          </>}
        </nav>
        <div className="management-profile mx-3 mb-4 flex items-center gap-2 border-t px-1 pt-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-semibold text-primary">{profileInitials}</div>
          <div className="min-w-0 text-primary-foreground"><strong className="block truncate text-xs font-medium">{profileName}</strong><span className="block truncate text-[10px] opacity-70">{isSuperAdmin ? 'Proprietária' : 'Administradora'}</span></div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:hidden">
          <div className="flex items-center gap-2"><img src={contaMuitoLogo} alt="Conta Muito" className="h-8 w-8 object-contain" /><span className="text-sm font-semibold">Conta Muito</span></div>
          <div className="flex items-center gap-1"><ThemeToggle /><Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button></div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card p-2 lg:hidden" aria-label="Central de Clientes">
          {navigation.map(item => <Button key={item.key} type="button" size="sm" variant={view === item.key ? 'secondary' : 'ghost'} onClick={() => { setFocusSchoolId(null); setCardFilter(null); setView(item.key); }} className="shrink-0 gap-1.5 text-xs"><item.icon className="h-3.5 w-3.5" />{item.label}</Button>)}
          {isSuperAdmin && <Button type="button" size="sm" variant={view === 'team_time' ? 'secondary' : 'ghost'} onClick={() => { setCardFilter(null); setView('team_time'); }} className="shrink-0 gap-1.5 text-xs"><Clock3 className="h-3.5 w-3.5" />Ponto da Equipe</Button>}
        </nav>

        {view === 'team_time' && isSuperAdmin ? (
          <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5 lg:px-6 lg:py-6"><TeamTimePanel /></main>
        ) : (
        <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5 lg:px-6 lg:py-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><h1 className="text-2xl font-medium tracking-normal">Central de Clientes</h1><p className="mt-1 text-xs text-muted-foreground">Acompanhe a carteira e priorize o que precisa de atenção.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Visão da conciliação" className="flex rounded-md border border-border bg-card p-0.5">{(Object.keys(periodModeLabels) as PeriodMode[]).map(m => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setCardFilter(null); }} className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${mode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{periodModeLabels[m]}</button>)}</div>
              {dueInfo && <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${dueInfo.tone}`} title="5º dia útil do mês seguinte (sem domingos e feriados)">Relatório {month.slice(5, 7)}/{month.slice(0, 4)} · {dueInfo.text}</span>}
              {mode === 'mes' && <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Período" type="month" value={month} onChange={event => setMonth(event.target.value)} className="h-9 w-[168px] bg-card pl-9 text-xs" /></label>}
              {isSuperAdmin && <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setTemplatesOpen(true)}><ListChecks className="h-3.5 w-3.5" />Etapas padrão</Button>}
              {isSuperAdmin && <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Nova empresa</Button>}
              <div className="hidden items-center gap-1 lg:flex"><ThemeToggle /><Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button></div>
            </div>
          </div>

          {view !== 'pending' && <>
              <div className={`mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 ${view === 'closing' ? 'xl:grid-cols-4' : 'xl:grid-cols-5'}`}>
              {summaryCards.map(card => {
                const isActive = activeCard?.key === card.key;
                const empty = card.value === 0 && (card.doneCount ?? 0) === 0;
                 return <button key={card.key} type="button" aria-pressed={isActive} disabled={empty} title={empty ? 'Nenhuma empresa nesta situação' : `Mostrar só: ${card.label}`} onClick={() => { setCardFilter(isActive ? null : card.key); setCardGroupMode('open'); }} className={`relative min-w-0 rounded-lg border border-border border-t-4 p-3 text-left shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${card.strip} ${isActive ? 'ring-2 ring-primary ring-offset-2' : ''} ${empty ? 'cursor-not-allowed opacity-60' : 'hover:shadow-md'}`}>
                  {isActive && <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">filtrando</span>}
                   <div className="flex min-h-8 items-start justify-between gap-1.5"><span className="text-xs font-medium leading-tight text-foreground/80">{card.label}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm ${card.tone}`}><card.icon className="h-3.5 w-3.5" /></span></div>
                    <p className={`mt-1 text-2xl font-semibold leading-none ${card.num}`}>{isLoading || (view === 'closing' && monthlyStepsLoading) ? '—' : card.value}</p>
                   <p className="mt-1 min-h-7 text-[10px] leading-snug text-muted-foreground">{card.note}</p>
                </button>;
              })}
            </div>
            {activeCard && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.05] px-3 py-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Mostrando só: {activeCard.label} · {activeCardCount} empresa{activeCardCount === 1 ? '' : 's'}
                <button type="button" onClick={() => setCardFilter(null)} aria-label={`Parar de filtrar por ${activeCard.label}`} className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80"><X className="h-2.5 w-2.5" /></button>
              </span>
              {view === 'closing' && (activeCard as { reportGroup?: boolean }).reportGroup && <div role="tablist" aria-label="Grupo da etapa" className="flex rounded-md border border-border bg-card p-0.5">{(['open', 'done'] as const).map(g => <button key={g} type="button" role="tab" aria-selected={cardGroupMode === g} onClick={() => setCardGroupMode(g)} className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${cardGroupMode === g ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{g === 'open' ? 'Pendentes' : 'Concluídas'}</button>)}</div>}
              <span className="text-[11px] text-muted-foreground">Clique no mesmo card para limpar, ou em outro card para trocar.</span>
            </div>}
          </>}

          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa ou responsável..." className="h-9 bg-muted/30 pl-9 text-xs" /></div>
            {view !== 'pending' && mode === 'mes' && <Select value={situation} onValueChange={value => setSituation(value as Situation)}><SelectTrigger className="h-9 w-full bg-card text-xs sm:w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem><SelectItem value="finalizado">Finalizadas</SelectItem><SelectItem value="bloqueado">Aguardando cliente</SelectItem><SelectItem value="atrasado">Atrasadas</SelectItem><SelectItem value="atencao">Em andamento</SelectItem><SelectItem value="em_dia">Em dia</SelectItem><SelectItem value="sem_etapas">Sem etapas cadastradas</SelectItem></SelectContent></Select>}
          </div>

          {view === 'pending' ? (
            <ReconciliationBacklog key={focusSchoolId ?? 'all'} rows={backlog} schools={schoolInfo} today={today} search={search} isLoading={backlogLoading} focusSchoolId={focusSchoolId} onOpenSchool={openSchool} />
          ) : view === 'responsible' ? (
            <section aria-label="Resumo por responsável"><div className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">{responsibleGroups.map(group => {
              const isOpen = expanded.has(group.key); const isEditing = editingUserId === group.key;
              return <article key={group.key} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{group.key === '__none' ? <UserX className="h-4 w-4" /> : initialsOf(group.label)}</div><div className="text-right"><p className="text-[10px] text-muted-foreground">Empresas</p><p className="text-xl font-medium">{group.rows.length}</p></div></div>
                {isEditing ? <div className="flex gap-1"><Input value={displayNameDraft} onChange={event => setDisplayNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveDisplayName(group.key); if (event.key === 'Escape') { setEditingUserId(null); setDisplayNameDraft(''); } }} maxLength={60} autoFocus className="h-8 text-sm" /><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveDisplayName(group.key)}><CheckCircle2 className="h-4 w-4 text-success" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingUserId(null); setDisplayNameDraft(''); }}><X className="h-4 w-4" /></Button></div> : <div className="flex items-center gap-1"><h2 className="truncate text-base font-medium">{group.label}</h2>{isSuperAdmin && group.key !== '__none' && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingUserId(group.key); setDisplayNameDraft(group.label); }} aria-label={`Editar nome de ${group.label}`}><Pencil className="h-3 w-3" /></Button>}</div>}
                <p className="truncate text-[11px] text-muted-foreground">{group.email}</p><div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2.5"><ProgressRing value={group.reconciliationPercent} label={mode === 'mes' ? 'Conciliação do mês' : 'Conciliação do dia'} tone="success" /><ProgressRing value={group.closingPercent} label="Relatório" tone="warning" /></div>{mode === 'hoje' && <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]"><span className="rounded-full bg-muted px-2 py-0.5">{group.reconciledToday} conciliados hoje</span><span className="rounded-full bg-muted px-2 py-0.5">{relativeTime(group.lastActivity, today)}</span>{group.lateCount > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 font-semibold text-destructive-foreground">{group.lateCount} atrasada(s)</span>}</div>}</div>
                <div className="grid grid-cols-4 border-t border-border bg-muted/15 text-center text-[10px]"><div className="border-r border-border py-2.5"><strong className="block text-sm text-success">{group.statusCounts.finalizado}</strong><span className="text-muted-foreground">Finalizadas</span></div><div className="border-r border-border py-2.5"><strong className="block text-sm text-destructive">{group.statusCounts.atrasado}</strong><span className="text-muted-foreground">Atrasadas</span></div><div className="border-r border-border py-2.5"><strong className="block text-sm text-info">{group.statusCounts.bloqueado}</strong><span className="text-muted-foreground">Cliente</span></div><div className="py-2.5"><strong className="block text-sm text-warning">{group.pending}</strong><span className="text-muted-foreground">Pendências</span></div></div>
                <Button variant="ghost" onClick={() => toggleGroup(group.key)} aria-expanded={isOpen} className="h-9 w-full justify-between rounded-none border-t px-4 text-xs"><span>{isOpen ? 'Ocultar empresas' : 'Ver empresas'}</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></Button>
                  {isOpen && <div className="divide-y divide-border border-t">{group.rows.map(row => { const status = statusOf(row, month, dueDate); const daily = dailyBySchool.get(row.school_id); const recon = dailyReconState(daily, bankAvailable(row, daily)); const tasks = dailyTasksBySchool.get(row.school_id); const oldPending = backlogBySchool.get(row.school_id) ?? 0; return <div key={row.school_id} className="space-y-2 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><ReconStatusDot state={reconDotOf(row)} schoolName={row.school_name} /><strong className="min-w-0 flex-1 truncate text-xs" title={row.school_name}>{row.school_name}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] ${statusStyles[status]}`}>{statusLabels[status]}</span></div><p className="text-[11px] text-muted-foreground">{recon === 'no_statement' ? 'Extrato não enviado' : recon === 'not_started' ? 'Aguardando início da conciliação' : recon === 'in_progress' ? 'Conciliação em andamento' : recon === 'done' ? 'Conciliação concluída' : 'Conciliação indisponível'}{isLateToday(daily) && recon !== 'unavailable' ? ' · Atrasada' : ''}</p><div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]"><span>Pendências do dia: <strong>{daily && recon !== 'unavailable' ? daily.recon_pending : '—'}</strong></span><span>Acumuladas: <strong>{oldPending}</strong></span><span>Tarefas do dia: <strong>{tasks ? `${tasks.done} de ${tasks.total}` : '—'}</strong></span><span>Relatório: <strong>{row.closing_percent == null ? '—' : `${row.closing_percent}%`}</strong></span></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setStepsSchool({ id: row.school_id, name: row.school_name })}>Ver tarefas e relatório</Button><Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => openSchool(row.school_id)}>Abrir empresa<ArrowRight className="h-3 w-3" /></Button></div></div>; })}</div>}
              </article>;
            })}</div>{!isLoading && responsibleGroups.length === 0 && <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Nenhuma responsável encontrada.</div>}</section>
          ) : (
             <div className="grid gap-3">
              <section className="overflow-hidden rounded-lg border border-border bg-card">
                {isError ? <p className="p-8 text-center text-sm text-destructive">Não foi possível carregar a carteira.</p> : <>
                   <div className="hidden grid-cols-[minmax(100px,1.1fr)_minmax(100px,1fr)_minmax(90px,.7fr)_minmax(150px,1.5fr)_minmax(170px,1.7fr)_28px] gap-2 border-b bg-muted/30 px-3 py-2.5 text-[11px] font-medium text-muted-foreground lg:grid"><span>Empresa</span><span>Responsável</span><span>Última alteração</span><span>Relatório</span><span>{mode === 'mes' ? 'Situação' : 'Conciliação do dia'}</span><span /></div>
                  <div className="divide-y divide-border">{!isLoading && filtered.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>}{filtered.map(row => {
                      const status = statusOf(row, month, dueDate); const daily = dailyBySchool.get(row.school_id); const recon = dailyReconState(daily, bankAvailable(row, daily)); const progress = row.closing_percent; const dayProgress = recon === 'unavailable' || recon === 'no_statement' ? null : daily?.recon_required === 0 ? 100 : dayPercent(daily); const tone = progress != null ? progressTone(progress) : null; const candidates = candidatesBySchool.get(row.school_id) ?? [];
                     return <div key={row.school_id} role="button" tabIndex={0} title="Abrir empresa" onClick={() => openSchool(row.school_id)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openSchool(row.school_id); } }} className={`cursor-pointer grid gap-2 border-l-4 px-3 py-3 text-xs transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(100px,1.1fr)_minmax(100px,1fr)_minmax(90px,.7fr)_minmax(150px,1.5fr)_minmax(170px,1.7fr)_28px] lg:items-center ${rowAccent[status]}`}>
                        <div className="flex min-w-0 items-center gap-2"><ReconStatusDot state={reconDotOf(row)} schoolName={row.school_name} /><span className="truncate font-medium" title={row.school_name}>{row.school_name}</span></div>
                      <div className="min-w-0" onClick={e => e.stopPropagation()}>{isSuperAdmin && candidates.length > 1 ? <Select value={row.responsible_user_id ?? '__none'} onValueChange={value => changeResponsible(row.school_id, value)} disabled={setResponsible.isPending}><SelectTrigger className="h-7 bg-background text-[11px]"><SelectValue placeholder="Definir responsável" /></SelectTrigger><SelectContent><SelectItem value="__none">Definir responsável</SelectItem>{candidates.map(candidate => <SelectItem key={candidate.user_id} value={candidate.user_id}>{candidate.email}</SelectItem>)}</SelectContent></Select> : <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{row.responsible_email ? initialsOf(displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : '?'}</span><span className="truncate">{row.responsible_email ? (displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : 'Definir responsável'}</span></div>}</div>
                      <span className="text-muted-foreground" title={lastActivityTitle(row.last_activity_at)}><span className="mr-1 lg:hidden">Última alteração:</span>{lastActivityLabel(row.last_activity_at)}</span>
                       <div onClick={e => e.stopPropagation()}><Button type="button" variant="ghost" onClick={() => setStepsSchool({ id: row.school_id, name: row.school_name })} className="h-auto w-full flex-col items-stretch gap-1 px-0 py-1 text-left hover:bg-transparent" aria-label={`Etapas do relatório de ${row.school_name}`}><div className="flex w-full items-center gap-2"><Progress value={progress ?? 0} className={`h-2.5 flex-1 bg-muted ${tone?.bar ?? ''}`} /><span className={`w-11 text-right text-xs font-bold ${tone?.text ?? 'text-muted-foreground'}`}>{progress == null ? '—' : `${progress}%`}</span></div><span className="text-[10px] font-normal text-muted-foreground">{row.report_delivered ? 'Relatório entregue' : 'Ver etapas e criar análise'}</span></Button></div>

                        <div className="min-w-0 space-y-1">{mode === 'mes' ? <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] ${statusStyles[status]}`}>{statusLabels[status]}</span> : <><div className="flex items-center gap-2"><Progress value={dayProgress ?? 0} className="h-2.5 flex-1 bg-muted [&>div]:bg-success" aria-label={`Conciliação de ${row.school_name}: ${dayProgress == null ? 'sem dados' : `${dayProgress}%`}`} /><span className="w-11 text-right text-xs font-bold text-foreground">{dayProgress == null ? '—' : `${dayProgress}%`}</span></div><div className="flex flex-wrap items-center gap-1.5"><span className={`text-[10px] font-medium ${recon === 'no_statement' ? 'text-destructive' : recon === 'done' ? 'text-success' : 'text-muted-foreground'}`}>{recon === 'no_statement' ? 'Extrato não enviado' : recon === 'not_started' ? 'Aguardando início' : recon === 'in_progress' ? 'Em andamento' : recon === 'done' ? daily?.recon_required === 0 ? 'Concluída · sem movimento' : 'Concluída' : (dailyLoading || bankLoading) ? '…' : 'Sem conta bancária cadastrada'}</span>{isLateToday(daily) && recon !== 'unavailable' && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">Atrasada</span>}</div></>}</div>
                      <div className="flex justify-end" onClick={e => e.stopPropagation()}>{isSuperAdmin && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Mais opções de ${row.school_name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive" onClick={() => setToggleSchool({ id: row.school_id, name: row.school_name, ativo: false })}>Inativar empresa</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div>
                    </div>;
                  })}</div><div className="border-t px-3 py-3 text-[10px] text-muted-foreground">Mostrando {filtered.length} de {rows.length} empresas em {viewLabels[view].toLocaleLowerCase('pt-BR')}{activeCard ? ` · ${activeCard.label}` : ''}</div>
                  {inactiveSchools.length > 0 && <div className="border-t px-3 py-3"><p className="mb-2 text-[11px] font-medium text-muted-foreground">Empresas inativas ({inactiveSchools.length}) — histórico preservado, fora da carteira e sem acesso do cliente</p><div className="flex flex-wrap gap-2">{inactiveSchools.map(s => <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-[11px]"><button type="button" className="hover:text-primary hover:underline" onClick={() => openSchool(s.id)}>{s.nome}</button>{isSuperAdmin && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label={`Mais opções de ${s.nome}`}><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setToggleSchool({ id: s.id, name: s.nome, ativo: true })}>Reativar empresa</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</span>)}</div></div>}
                </>}
              </section>
               <aside className="rounded-lg border border-border bg-card p-3.5"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-medium">Prioridades de hoje</h2><span className="text-[10px] text-muted-foreground">{priorities.length} itens</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{priorities.length === 0 && <p className="rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">Nenhuma prioridade encontrada para este período.</p>}{priorities.map(({ row, status, pending }) => <Button key={row.school_id} type="button" variant="ghost" onClick={() => { if (pending > 0) { setFocusSchoolId(row.school_id); setView('pending'); } else openSchool(row.school_id); }} className={`h-auto min-w-0 flex-col items-stretch rounded-md border-l-4 p-3 text-left transition-transform hover:-translate-y-0.5 ${status === 'atrasado' ? 'border-destructive bg-destructive/15 shadow-sm' : status === 'bloqueado' ? 'border-info bg-info/15 shadow-sm' : 'border-progress bg-progress/15 shadow-sm'}`}><strong className="block truncate text-[11px] font-medium">{row.school_name}</strong><span className="mt-1 block whitespace-normal text-[11px] font-normal leading-snug text-muted-foreground">{row.next_action || (status === 'bloqueado' ? 'Aguardando informações do cliente.' : pending > 0 ? `${pending} pendência${pending === 1 ? '' : 's'} de conciliação acumulada${pending === 1 ? '' : 's'} — ver quais.` : statusLabels[status])}</span><span className="mt-1.5 flex justify-between gap-2 text-[10px] font-normal text-muted-foreground"><span>{row.responsible_email ? (displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : 'Sem responsável'}</span><span>{statusLabels[status]}</span></span></Button>)}</div></aside>
            </div>
          )}
        </main>
        )}
      </div>

      <Dialog open={!!toggleSchool} onOpenChange={open => { if (!open) setToggleSchool(null); }}><DialogContent><DialogHeader><DialogTitle>{toggleSchool?.ativo ? 'Reativar' : 'Inativar'} {toggleSchool?.name}?</DialogTitle><DialogDescription>{toggleSchool?.ativo ? 'A empresa volta para a carteira da responsável e o cliente volta a ter acesso.' : 'Nada será apagado. A empresa sai da carteira e das porcentagens, e o cliente deixa de ter acesso. Você pode reativar quando quiser.'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setToggleSchool(null)}>Cancelar</Button><Button onClick={() => void confirmToggle()} disabled={toggling}>{toggling ? 'Salvando…' : toggleSchool?.ativo ? 'Reativar' : 'Inativar'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Nova empresa</DialogTitle><DialogDescription>Informe o nome da empresa para criar o cadastro.</DialogDescription></DialogHeader><Input value={newSchoolName} onChange={event => setNewSchoolName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createSchool(); }} placeholder="Nome da empresa" autoFocus /><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => void createSchool()} disabled={addSchool.isPending}>{addSchool.isPending ? 'Criando…' : 'Criar empresa'}</Button></DialogFooter></DialogContent></Dialog>
      <ClosingStepTemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <SchoolStepsDialog open={stepsSchool !== null} onOpenChange={open => { if (!open) setStepsSchool(null); }} schoolId={stepsSchool?.id ?? null} schoolName={stepsSchool?.name ?? ''} month={month} canEditTemplates={isSuperAdmin} onOpenTemplates={() => { setStepsSchool(null); setTemplatesOpen(true); }} />
    </div>
  );
}
