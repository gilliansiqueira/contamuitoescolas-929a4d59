import { useEffect, useMemo, useState } from 'react';
import type { School } from '@/types/financial';
import { useAuth } from '@/hooks/useAuth';
import {
  useManagementResponsibleDisplayNames,
  useManagementPortfolio,
  useManagementResponsibleCandidates,
  useSetManagementResponsible,
  useSetManagementResponsibleDisplayName,
  type PortfolioRow,
} from '@/hooks/useManagementPortfolio';
import { useAddSchool } from '@/hooks/useFinancialData';
import { useClosingStepTemplates, useEnsureMonthlyChecklist } from '@/hooks/useClosingSteps';
import { ClosingStepTemplatesDialog, SchoolStepsDialog } from '@/components/management/ClosingStepsDialog';
import { Button } from '@/components/ui/button';
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

interface Props {
  schools: School[];
  onSelect: (school: School) => void;
  onSignOut: () => void;
}

type Situation = 'all' | 'finalizado' | 'bloqueado' | 'atrasado' | 'atencao' | 'em_dia' | 'sem_etapas';
type ManagementView = 'portfolio' | 'closing' | 'pending' | 'responsible';
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
  finalizado: 'bg-success/10 text-success',
  bloqueado: 'bg-info/10 text-info',
  atrasado: 'bg-destructive/10 text-destructive',
  atencao: 'bg-warning/10 text-warning',
  em_dia: 'bg-success/10 text-success',
  sem_etapas: 'bg-muted text-muted-foreground',
};

const statusDotStyles: Record<RowStatus, string> = {
  finalizado: 'bg-success', bloqueado: 'bg-info', atrasado: 'bg-destructive',
  atencao: 'bg-warning', em_dia: 'bg-success', sem_etapas: 'bg-muted-foreground',
};

const viewLabels: Record<ManagementView, string> = {
  portfolio: 'Carteira de clientes', closing: 'Fechamentos', pending: 'Pendências', responsible: 'Por responsável',
};

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

function statusOf(row: PortfolioRow, month: string): RowStatus {
  if (row.period_closed && row.report_delivered && row.checklist_pending === 0) return 'finalizado';
  if (row.waiting_for_client) return 'bloqueado';
  if (row.closing_percent == null && !row.report_delivered && !row.period_closed) return 'sem_etapas';
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (month < currentMonth && (!row.period_closed || !row.report_delivered)) return 'atrasado';
  if (row.reconciliation_pending > 0 || row.checklist_pending > 0) return 'atencao';
  return 'em_dia';
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
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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
  const { data: rows = [], isLoading, isError } = useManagementPortfolio(month, true);
  const { data: responsibleCandidates = [] } = useManagementResponsibleCandidates(isSuperAdmin);
  const { data: displayNames = [] } = useManagementResponsibleDisplayNames(true);
  const { data: stepTemplates = [] } = useClosingStepTemplates(true);
  const ensureChecklist = useEnsureMonthlyChecklist();
  const setResponsible = useSetManagementResponsible(month);
  const setDisplayName = useSetManagementResponsibleDisplayName();
  const addSchool = useAddSchool();

  // Gera as etapas do mês para empresas que ainda não têm (idempotente)
  useEffect(() => {
    if (stepTemplates.length === 0 || rows.length === 0) return;
    rows.filter(row => row.closing_percent == null).forEach(row => {
      ensureChecklist.mutate({ schoolId: row.school_id, month });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, stepTemplates.length, month]);

  const schoolById = useMemo(() => new Map(schools.map(school => [school.id, school])), [schools]);
  const candidatesBySchool = useMemo(() => {
    const grouped = new Map<string, typeof responsibleCandidates>();
    responsibleCandidates.forEach(candidate => grouped.set(candidate.school_id, [...(grouped.get(candidate.school_id) ?? []), candidate]));
    return grouped;
  }, [responsibleCandidates]);
  const displayNameByUser = useMemo(() => new Map(displayNames.map(item => [item.user_id, item.display_name])), [displayNames]);

  const filtered = useMemo(() => rows.filter(row => {
    const term = search.toLocaleLowerCase('pt-BR');
    const matchesSearch = row.school_name.toLocaleLowerCase('pt-BR').includes(term)
      || (row.responsible_email ?? '').toLocaleLowerCase('pt-BR').includes(term)
      || (row.responsible_user_id ? (displayNameByUser.get(row.responsible_user_id) ?? '').toLocaleLowerCase('pt-BR').includes(term) : false);
    const status = statusOf(row, month);
    const matchesView = view === 'portfolio'
      || (view === 'closing' && (!row.period_closed || !row.report_delivered))
      || (view === 'pending' && (row.reconciliation_pending > 0 || row.checklist_pending > 0 || row.waiting_for_client))
      || (view === 'responsible' && !!row.responsible_user_id);
    return matchesSearch && matchesView && (situation === 'all' || status === situation);
  }), [displayNameByUser, month, rows, search, situation, view]);

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
        const status = statusOf(row, month);
        if (status === 'finalizado' || status === 'atrasado' || status === 'bloqueado') statusCounts[status] += 1;
        pending += row.reconciliation_pending + row.checklist_pending;
      });
      const email = key === '__none' ? 'Não definida' : (groupRows.find(row => row.responsible_user_id === key)?.responsible_email ?? 'Não definida');
      return {
        key, email,
        label: key === '__none' ? 'Não definida' : (displayNameByUser.get(key) ?? nameFromEmail(email)),
        rows: [...groupRows].sort((a, b) => a.school_name.localeCompare(b.school_name, 'pt-BR')),
        reconciliationPercent: avg(groupRows.map(row => row.reconciliation_percent).filter((value): value is number => value != null)),
        closingPercent: avg(groupRows.map(row => row.closing_percent).filter((value): value is number => value != null)),
        statusCounts, pending,
      };
    }).sort((a, b) => a.key === '__none' ? 1 : b.key === '__none' ? -1 : a.label.localeCompare(b.label, 'pt-BR'));
  }, [displayNameByUser, filtered, month, view]);

  const pendingClosing = rows.filter(row => !row.period_closed || !row.report_delivered).length;
  const pendingReconciliationCompanies = rows.filter(row => row.reconciliation_pending > 0).length;
  const completedReconciliation = rows.filter(row => row.reconciliation_percent === 100).length;
  const deliveredReports = rows.filter(row => row.report_delivered).length;
  const updatedToday = rows.filter(row => row.data_updated_through === new Date().toISOString().slice(0, 10)).length;
  const priorities = useMemo(() => filtered
    .map(row => ({ row, status: statusOf(row, month), pending: row.reconciliation_pending + row.checklist_pending }))
    .filter(item => item.status === 'atrasado' || item.status === 'bloqueado' || item.pending > 0 || !!item.row.next_action)
    .sort((a, b) => {
      const weight = (item: typeof a) => item.status === 'atrasado' ? 0 : item.status === 'bloqueado' ? 1 : item.pending > 0 ? 2 : 3;
      return weight(a) - weight(b) || b.pending - a.pending;
    }).slice(0, 4), [filtered, month]);

  const openSchool = (id: string) => { const school = schoolById.get(id); if (school) onSelect(school); };
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
    { key: 'closing' as const, label: 'Fechamentos', icon: FileCheck2 },
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
          {navigation.map(item => <Button key={item.key} type="button" variant="ghost" onClick={() => setView(item.key)} className={`management-nav-item h-10 w-full justify-start gap-2.5 px-3 text-xs ${view === item.key ? 'management-nav-active' : ''}`}><item.icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></Button>)}
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
          {navigation.map(item => <Button key={item.key} type="button" size="sm" variant={view === item.key ? 'secondary' : 'ghost'} onClick={() => setView(item.key)} className="shrink-0 gap-1.5 text-xs"><item.icon className="h-3.5 w-3.5" />{item.label}</Button>)}
        </nav>

        <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5 lg:px-6 lg:py-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><h1 className="text-2xl font-medium tracking-normal">Central de Clientes</h1><p className="mt-1 text-xs text-muted-foreground">Acompanhe a carteira e priorize o que precisa de atenção.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Período" type="month" value={month} onChange={event => setMonth(event.target.value)} className="h-9 w-[168px] bg-card pl-9 text-xs" /></label>
              {isSuperAdmin && <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />Nova empresa</Button>}
              <div className="hidden items-center gap-1 lg:flex"><ThemeToggle /><Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button></div>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {[
              { label: 'Empresas ativas', value: rows.length, note: 'Toda a carteira', icon: Building2, tone: 'text-primary bg-primary/10' },
              { label: 'Atualizadas hoje', value: updatedToday, note: 'Dados até hoje', icon: CalendarDays, tone: 'text-success bg-success/10' },
              { label: 'Conciliação pendente', value: pendingReconciliationCompanies, note: `${completedReconciliation} já concluída${completedReconciliation === 1 ? '' : 's'}`, icon: AlertCircle, tone: 'text-warning bg-warning/10' },
              { label: 'Fechamento pendente', value: pendingClosing, note: `${deliveredReports} relatório${deliveredReports === 1 ? '' : 's'} entregue${deliveredReports === 1 ? '' : 's'}`, icon: FileCheck2, tone: 'text-destructive bg-destructive/10' },
            ].map(card => <div key={card.label} className="rounded-lg border border-border bg-card p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{card.label}</span><span className={`flex h-7 w-7 items-center justify-center rounded-md ${card.tone}`}><card.icon className="h-3.5 w-3.5" /></span></div><p className="mt-2 text-2xl font-medium leading-none">{isLoading ? '—' : card.value}</p><p className="mt-1.5 text-[11px] text-muted-foreground">{card.note}</p></div>)}
          </div>

          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa ou responsável..." className="h-9 bg-muted/30 pl-9 text-xs" /></div>
            <Select value={situation} onValueChange={value => setSituation(value as Situation)}><SelectTrigger className="h-9 w-full bg-card text-xs sm:w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem><SelectItem value="finalizado">Finalizadas</SelectItem><SelectItem value="bloqueado">Aguardando cliente</SelectItem><SelectItem value="atrasado">Atrasadas</SelectItem><SelectItem value="atencao">Em andamento</SelectItem><SelectItem value="em_dia">Em dia</SelectItem><SelectItem value="sem_etapas">Sem etapas cadastradas</SelectItem></SelectContent></Select>
          </div>

          {view === 'responsible' ? (
            <section aria-label="Resumo por responsável"><div className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">{responsibleGroups.map(group => {
              const isOpen = expanded.has(group.key); const isEditing = editingUserId === group.key;
              return <article key={group.key} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{group.key === '__none' ? <UserX className="h-4 w-4" /> : initialsOf(group.label)}</div><div className="text-right"><p className="text-[10px] text-muted-foreground">Empresas</p><p className="text-xl font-medium">{group.rows.length}</p></div></div>
                {isEditing ? <div className="flex gap-1"><Input value={displayNameDraft} onChange={event => setDisplayNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveDisplayName(group.key); if (event.key === 'Escape') { setEditingUserId(null); setDisplayNameDraft(''); } }} maxLength={60} autoFocus className="h-8 text-sm" /><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveDisplayName(group.key)}><CheckCircle2 className="h-4 w-4 text-success" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingUserId(null); setDisplayNameDraft(''); }}><X className="h-4 w-4" /></Button></div> : <div className="flex items-center gap-1"><h2 className="truncate text-base font-medium">{group.label}</h2>{isSuperAdmin && group.key !== '__none' && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingUserId(group.key); setDisplayNameDraft(group.label); }} aria-label={`Editar nome de ${group.label}`}><Pencil className="h-3 w-3" /></Button>}</div>}
                <p className="truncate text-[11px] text-muted-foreground">{group.email}</p><div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2.5"><ProgressRing value={group.reconciliationPercent} label="Conciliação" tone="success" /><ProgressRing value={group.closingPercent} label="Fechamento" tone="warning" /></div></div>
                <div className="grid grid-cols-4 border-t border-border bg-muted/15 text-center text-[10px]"><div className="border-r border-border py-2.5"><strong className="block text-sm text-success">{group.statusCounts.finalizado}</strong><span className="text-muted-foreground">Finalizadas</span></div><div className="border-r border-border py-2.5"><strong className="block text-sm text-destructive">{group.statusCounts.atrasado}</strong><span className="text-muted-foreground">Atrasadas</span></div><div className="border-r border-border py-2.5"><strong className="block text-sm text-info">{group.statusCounts.bloqueado}</strong><span className="text-muted-foreground">Cliente</span></div><div className="py-2.5"><strong className="block text-sm text-warning">{group.pending}</strong><span className="text-muted-foreground">Pendências</span></div></div>
                <Button variant="ghost" onClick={() => toggleGroup(group.key)} aria-expanded={isOpen} className="h-9 w-full justify-between rounded-none border-t px-4 text-xs"><span>{isOpen ? 'Ocultar empresas' : 'Ver empresas'}</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></Button>
                {isOpen && <div className="divide-y divide-border border-t">{group.rows.map(row => { const status = statusOf(row, month); return <div key={row.school_id} className="flex items-center justify-between gap-2 px-4 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-medium">{row.school_name}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] ${statusStyles[status]}`}>{statusLabels[status]}</span></div><Button variant="ghost" size="sm" onClick={() => openSchool(row.school_id)} className="h-7 text-xs text-primary">Abrir <ArrowRight className="ml-1 h-3 w-3" /></Button></div>; })}</div>}
              </article>;
            })}</div>{!isLoading && responsibleGroups.length === 0 && <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Nenhuma responsável encontrada.</div>}</section>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(240px,.7fr)]">
              <section className="overflow-hidden rounded-lg border border-border bg-card">
                {isError ? <p className="p-8 text-center text-sm text-destructive">Não foi possível carregar a carteira.</p> : <>
                  <div className="hidden grid-cols-[1.3fr_1fr_.8fr_1fr_1fr_.55fr] gap-3 border-b bg-muted/30 px-3 py-2.5 text-[11px] font-medium text-muted-foreground lg:grid"><span>Empresa</span><span>Responsável</span><span>Atualizado até</span><span>Andamento</span><span>Situação</span><span /></div>
                  <div className="divide-y divide-border">{!isLoading && filtered.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>}{filtered.map(row => {
                    const status = statusOf(row, month); const progress = row.closing_percent ?? row.reconciliation_percent; const candidates = candidatesBySchool.get(row.school_id) ?? [];
                    return <div key={row.school_id} className="grid gap-3 px-3 py-3 text-xs transition-colors hover:bg-muted/20 lg:grid-cols-[1.3fr_1fr_.8fr_1fr_1fr_.55fr] lg:items-center">
                      <div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${statusDotStyles[status]}`} /><span className="truncate font-medium">{row.school_name}</span></div>
                      <div className="min-w-0">{isSuperAdmin && candidates.length > 1 ? <Select value={row.responsible_user_id ?? '__none'} onValueChange={value => changeResponsible(row.school_id, value)} disabled={setResponsible.isPending}><SelectTrigger className="h-7 bg-background text-[11px]"><SelectValue placeholder="Definir responsável" /></SelectTrigger><SelectContent><SelectItem value="__none">Definir responsável</SelectItem>{candidates.map(candidate => <SelectItem key={candidate.user_id} value={candidate.user_id}>{candidate.email}</SelectItem>)}</SelectContent></Select> : <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{row.responsible_email ? initialsOf(displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : '?'}</span><span className="truncate">{row.responsible_email ? (displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : 'Definir responsável'}</span></div>}</div>
                      <span className="text-muted-foreground"><span className="mr-1 lg:hidden">Atualizado:</span>{formatDate(row.data_updated_through)}</span>
                      <div>{progress == null ? <span className="text-[11px] text-muted-foreground">{row.closing_percent == null ? 'Configurar etapas' : 'Indisponível'}</span> : <div className="flex items-center gap-2"><Progress value={progress} className={`h-1.5 flex-1 bg-muted ${progress === 100 ? '[&>div]:bg-success' : '[&>div]:bg-warning'}`} /><span className="w-8 text-right text-[11px]">{progress}%</span></div>}</div>
                      <div><span className={`inline-flex rounded-full px-2 py-1 text-[10px] ${statusStyles[status]}`}>{statusLabels[status]}</span></div>
                      <Button variant="ghost" size="sm" onClick={() => openSchool(row.school_id)} className="h-7 justify-start px-1 text-xs text-primary lg:justify-center">Abrir <ArrowRight className="ml-1 h-3 w-3" /></Button>
                    </div>;
                  })}</div><div className="border-t px-3 py-3 text-[10px] text-muted-foreground">Mostrando {filtered.length} de {rows.length} empresas em {viewLabels[view].toLocaleLowerCase('pt-BR')}</div>
                </>}
              </section>
              <aside className="h-fit rounded-lg border border-border bg-card p-3.5"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-medium">Prioridades de hoje</h2><span className="text-[10px] text-muted-foreground">{priorities.length} itens</span></div><div className="space-y-2">{priorities.length === 0 && <p className="rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">Nenhuma prioridade encontrada para este período.</p>}{priorities.map(({ row, status, pending }) => <button key={row.school_id} type="button" onClick={() => openSchool(row.school_id)} className={`w-full rounded-md border-l-[3px] bg-muted/30 p-2.5 text-left ${status === 'atrasado' ? 'border-destructive' : status === 'bloqueado' ? 'border-info' : 'border-warning'}`}><strong className="block truncate text-[11px] font-medium">{row.school_name}</strong><span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{row.next_action || (status === 'bloqueado' ? 'Aguardando informações do cliente.' : pending > 0 ? `${pending} pendência${pending === 1 ? '' : 's'} no período.` : statusLabels[status])}</span><span className="mt-1.5 flex justify-between gap-2 text-[10px] text-muted-foreground"><span>{row.responsible_email ? (displayNameByUser.get(row.responsible_user_id ?? '') ?? nameFromEmail(row.responsible_email)) : 'Sem responsável'}</span><span>{statusLabels[status]}</span></span></button>)}</div></aside>
            </div>
          )}
        </main>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Nova empresa</DialogTitle><DialogDescription>Informe o nome da empresa para criar o cadastro.</DialogDescription></DialogHeader><Input value={newSchoolName} onChange={event => setNewSchoolName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createSchool(); }} placeholder="Nome da empresa" autoFocus /><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => void createSchool()} disabled={addSchool.isPending}>{addSchool.isPending ? 'Criando…' : 'Criar empresa'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
