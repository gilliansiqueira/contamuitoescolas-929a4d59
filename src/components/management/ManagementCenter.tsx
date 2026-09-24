import { useMemo, useState } from 'react';
import type { School } from '@/types/financial';
import { useAuth } from '@/hooks/useAuth';
import {
  useManagementPortfolio,
  useManagementResponsibleCandidates,
  useSetManagementResponsible,
  type PortfolioRow,
} from '@/hooks/useManagementPortfolio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';
import { toast } from 'sonner';
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCheck2,
  LogOut,
  Search,
  Settings2,
  UserX,
  Users,
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
  finalizado: 'Fechamento concluído',
  bloqueado: 'Aguardando cliente',
  atrasado: 'Atrasada',
  atencao: 'Atenção',
  em_dia: 'Em dia',
  sem_etapas: 'Sem etapas cadastradas',
};

const statusStyles: Record<RowStatus, string> = {
  finalizado: 'bg-success/15 text-success',
  bloqueado: 'bg-info/15 text-info',
  atrasado: 'bg-destructive/15 text-destructive',
  atencao: 'bg-warning/15 text-warning',
  em_dia: 'bg-success/15 text-success',
  sem_etapas: 'bg-muted text-muted-foreground',
};

const viewLabels: Record<ManagementView, string> = {
  portfolio: 'Carteira de Clientes',
  closing: 'Fechamentos',
  pending: 'Pendências',
  responsible: 'Por Responsável',
};

function statusOf(row: PortfolioRow, month: string): RowStatus {
  if (row.period_closed && row.report_delivered && row.checklist_pending === 0) return 'finalizado';
  if (row.waiting_for_client) return 'bloqueado';
  if (row.closing_percent == null && !row.report_delivered && !row.period_closed) return 'sem_etapas';
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (month < currentMonth && (!row.period_closed || !row.report_delivered)) return 'atrasado';
  if (row.reconciliation_pending > 0 || row.checklist_pending > 0) return 'atencao';
  return 'em_dia';
}

function formatPeriod(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${monthLabels[monthNumber - 1]}/${year}`;
}

export function ManagementCenter({ schools, onSelect, onSignOut }: Props) {
  const { isSuperAdmin, profile } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [situation, setSituation] = useState<Situation>('all');
  const [view, setView] = useState<ManagementView>('portfolio');
  const { data: rows = [], isLoading, isError } = useManagementPortfolio(month, true);
  const { data: responsibleCandidates = [] } = useManagementResponsibleCandidates(isSuperAdmin);
  const setResponsible = useSetManagementResponsible(month);
  const schoolById = useMemo(() => new Map(schools.map(school => [school.id, school])), [schools]);
  const candidatesBySchool = useMemo(() => {
    const grouped = new Map<string, typeof responsibleCandidates>();
    responsibleCandidates.forEach(candidate => {
      grouped.set(candidate.school_id, [...(grouped.get(candidate.school_id) ?? []), candidate]);
    });
    return grouped;
  }, [responsibleCandidates]);

  const filtered = useMemo(() => rows.filter(row => {
    const term = search.toLocaleLowerCase('pt-BR');
    const matchesSearch = row.school_name.toLocaleLowerCase('pt-BR').includes(term)
      || (row.responsible_email ?? '').toLocaleLowerCase('pt-BR').includes(term);
    const status = statusOf(row, month);
    const matchesView = view === 'portfolio'
      || (view === 'closing' && (!row.period_closed || !row.report_delivered))
      || (view === 'pending' && (row.reconciliation_pending > 0 || row.checklist_pending > 0 || row.waiting_for_client))
      || (view === 'responsible' && !!row.responsible_user_id);
    return matchesSearch && matchesView && (situation === 'all' || status === situation);
  }), [month, rows, search, situation, view]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const responsibleGroups = useMemo(() => {
    if (view !== 'responsible') return [];
    const map = new Map<string, PortfolioRow[]>();
    filtered.forEach(row => {
      const key = row.responsible_user_id ?? '__none';
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    const avg = (values: number[]) => values.length === 0
      ? null
      : Math.round(values.reduce((total, value) => total + value, 0) / values.length);
    const groups = [...map.entries()].map(([key, groupRows]) => {
      const statusCounts = { finalizado: 0, atrasado: 0, bloqueado: 0 };
      let pending = 0;
      groupRows.forEach(row => {
        const status = statusOf(row, month);
        if (status === 'finalizado' || status === 'atrasado' || status === 'bloqueado') statusCounts[status] += 1;
        pending += row.reconciliation_pending + row.checklist_pending;
      });
      return {
        key,
        label: key === '__none'
          ? 'Não definida'
          : (groupRows.find(row => row.responsible_user_id === key)?.responsible_email ?? 'Não definida'),
        rows: [...groupRows].sort((a, b) => a.school_name.localeCompare(b.school_name, 'pt-BR')),
        reconciliationPercent: avg(groupRows.map(row => row.reconciliation_percent).filter((value): value is number => value != null)),
        closingPercent: avg(groupRows.map(row => row.closing_percent).filter((value): value is number => value != null)),
        statusCounts,
        pending,
      };
    });
    return groups.sort((a, b) => {
      if (a.key === '__none') return 1;
      if (b.key === '__none') return -1;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
  }, [filtered, month, view]);

  const finalized = rows.filter(row => statusOf(row, month) === 'finalizado').length;
  const pendingClosing = rows.filter(row => !row.period_closed || !row.report_delivered).length;
  const pendingReconciliationCompanies = rows.filter(row => row.reconciliation_pending > 0).length;
  const updatedToday = rows.filter(row => row.data_updated_through === new Date().toISOString().slice(0, 10)).length;
  const displayName = profile?.email?.split('@')[0] || 'Equipe';

  const openSchool = (id: string) => {
    const school = schoolById.get(id);
    if (school) onSelect(school);
  };

  const changeResponsible = (schoolId: string, value: string) => {
    setResponsible.mutate(
      { schoolId, userId: value === '__none' ? null : value },
      {
        onSuccess: () => toast.success('Responsável atualizada.'),
        onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a responsável.'),
      },
    );
  };

  const navigation = [
    { key: 'portfolio' as const, label: 'Carteira de Clientes', icon: Building2 },
    { key: 'closing' as const, label: 'Fechamentos', icon: FileCheck2 },
    { key: 'pending' as const, label: 'Pendências', icon: AlertCircle },
    { key: 'responsible' as const, label: 'Por Responsável', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background lg:flex">
      {isSuperAdmin && (
        <aside className="app-sidebar hidden w-64 shrink-0 flex-col lg:flex">
          <div className="flex h-20 items-center gap-3 px-6">
            <img src={contaMuitoLogo} alt="" className="h-9 w-9 object-contain brightness-0 invert" />
            <span className="text-lg font-bold text-primary-foreground">Conta Muito</span>
          </div>
          <nav className="flex-1 space-y-1 px-3 pt-2" aria-label="Central de Clientes">
            {navigation.map(item => (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                onClick={() => setView(item.key)}
                className={`app-sidebar-item h-11 w-full justify-start gap-3 px-4 ${view === item.key ? 'app-sidebar-item-active font-semibold' : ''}`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Button>
            ))}
          </nav>
          <div className="app-sidebar-divider border-t p-3">
            <Button variant="ghost" size="icon" aria-label="Configurações" className="app-sidebar-item"><Settings2 className="h-5 w-5" /></Button>
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        <header className="h-20 border-b border-border bg-card">
          <div className="mx-auto flex h-full max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-7">
            <div className="flex items-center gap-3 lg:hidden">
              <img src={contaMuitoLogo} alt="Conta Muito" className="h-9 w-9 object-contain" />
              <span className="font-semibold">Conta Muito</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Notificações"><Bell className="h-4 w-4" /></Button>
              <ThemeToggle />
              <div className="hidden border-l border-border pl-4 sm:block">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">{isSuperAdmin ? 'Conta Muito' : 'Carteira de Clientes'}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1540px] px-4 py-7 sm:px-7 sm:py-9">
          <div className="mb-7">
            <h1 className="text-3xl font-bold sm:text-4xl">Central de Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe o status das empresas e mantenha tudo em dia.</p>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Empresas ativas', value: rows.length, icon: Building2, tone: 'bg-success/10 text-success' },
              { label: 'Atualizadas hoje', value: updatedToday, icon: CalendarDays, tone: 'bg-info/10 text-info' },
              { label: 'Conciliação pendente', value: pendingReconciliationCompanies, icon: Clock3, tone: 'bg-warning/10 text-warning' },
              { label: 'Fechamento pendente', value: pendingClosing, icon: FileCheck2, tone: 'bg-destructive/10 text-destructive' },
              { label: 'Fechamentos concluídos', value: finalized, icon: CheckCircle2, tone: 'bg-success/10 text-success' },
            ].map(card => (
              <div key={card.label} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-md ${card.tone}`}><card.icon className="h-5 w-5" /></div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-3xl font-bold">{isLoading ? '—' : card.value}</p>
              </div>
            ))}
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por empresa ou responsável..." className="bg-card pl-9" />
            </div>
            <Input aria-label="Período" type="month" value={month} onChange={event => setMonth(event.target.value)} className="bg-card" />
            <Select value={situation} onValueChange={value => setSituation(value as Situation)}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="finalizado">Finalizadas</SelectItem>
                <SelectItem value="bloqueado">Aguardando cliente</SelectItem>
                <SelectItem value="atrasado">Atrasadas</SelectItem>
                <SelectItem value="atencao">Atenção</SelectItem>
                <SelectItem value="em_dia">Em dia</SelectItem>
                <SelectItem value="sem_etapas">Sem etapas cadastradas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {view === 'responsible' ? (
            <section className="space-y-4" aria-label="Resumo por responsável">
              {!isLoading && responsibleGroups.length === 0 && (
                <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">Nenhuma responsável encontrada.</div>
              )}
              {responsibleGroups.map(group => {
                const isOpen = expanded.has(group.key);
                return (
                  <div key={group.key} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/20"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {group.key === '__none' ? <UserX className="h-5 w-5" /> : group.label.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{group.label}</p>
                          <p className="text-xs text-muted-foreground">{group.rows.length} {group.rows.length === 1 ? 'empresa' : 'empresas'}</p>
                        </div>
                      </div>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Conciliação</span><span>{group.reconciliationPercent == null ? 'Indisponível' : `${group.reconciliationPercent}%`}</span></div>
                        <Progress value={group.reconciliationPercent ?? 0} className="h-1.5 bg-muted [&>div]:bg-success" />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Fechamento</span><span>{group.closingPercent == null ? 'Indisponível' : `${group.closingPercent}%`}</span></div>
                        <Progress value={group.closingPercent ?? 0} className="h-1.5 bg-muted [&>div]:bg-warning" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4 text-xs font-semibold">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${group.statusCounts.finalizado > 0 ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> {group.statusCounts.finalizado} finalizadas
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${group.statusCounts.atrasado > 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                        <Clock3 className="h-3.5 w-3.5" /> {group.statusCounts.atrasado} atrasadas
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${group.statusCounts.bloqueado > 0 ? 'bg-info/15 text-info' : 'bg-muted text-muted-foreground'}`}>
                        <AlertCircle className="h-3.5 w-3.5" /> {group.statusCounts.bloqueado} aguardando cliente
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${group.pending > 0 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}>
                        {group.pending} pendências
                      </span>
                    </div>
                    {isOpen && (
                      <div className="divide-y divide-border border-t border-border">
                        {group.rows.map(row => {
                          const status = statusOf(row, month);
                          return (
                            <div key={row.school_id} className="flex items-center justify-between gap-3 px-5 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{row.school_name}</p>
                                <span className={`mt-1 inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</span>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => openSchool(row.school_id)}>Acessar <ChevronRight className="ml-1 h-4 w-4" /></Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ) : (
          <section className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
            {isError ? (
              <p className="p-8 text-center text-sm text-destructive">Não foi possível carregar a carteira.</p>
            ) : (
              <>
                <div className="hidden grid-cols-[1.35fr_1fr_.72fr_.9fr_1fr_1fr_.6fr_1fr_.75fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground xl:grid">
                  <span>Empresa</span><span>Responsável</span><span>Período</span><span>Atualizado até</span><span>Conciliação</span><span>Fechamento</span><span>Pendências</span><span>Situação</span><span>Ações</span>
                </div>
                <div className="divide-y divide-border">
                  {!isLoading && filtered.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>}
                  {filtered.map(row => {
                    const status = statusOf(row, month);
                    const pending = row.reconciliation_pending + row.checklist_pending;
                    return (
                      <div key={row.school_id} className="grid gap-4 p-5 transition-colors hover:bg-muted/20 xl:grid-cols-[1.35fr_1fr_.72fr_.9fr_1fr_1fr_.6fr_1fr_.75fr] xl:items-center">
                        <div className="min-w-0"><p className="truncate font-semibold">{row.school_name}</p></div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground xl:hidden">Responsável</p>
                          {isSuperAdmin && (candidatesBySchool.get(row.school_id)?.length ?? 0) > 1 ? (
                            <Select
                              value={row.responsible_user_id ?? '__none'}
                              onValueChange={value => changeResponsible(row.school_id, value)}
                              disabled={setResponsible.isPending}
                            >
                              <SelectTrigger className="h-8 min-w-0 bg-background text-xs" aria-label={`Responsável por ${row.school_name}`}>
                                <SelectValue placeholder="Definir responsável" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">Definir responsável</SelectItem>
                                {(candidatesBySchool.get(row.school_id) ?? []).map(candidate => (
                                  <SelectItem key={candidate.user_id} value={candidate.user_id}>{candidate.email}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="truncate text-sm">{row.responsible_email ?? 'Não definida'}</p>
                          )}
                        </div>
                        <div><p className="text-xs text-muted-foreground xl:hidden">Período</p><p className="text-sm">{formatPeriod(month)}</p></div>
                        <div><p className="text-xs text-muted-foreground xl:hidden">Atualizado até</p><p className="text-sm">{row.data_updated_through ? new Date(`${row.data_updated_through}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'}</p></div>
                        <div>
                          <div className="mb-1 flex justify-between text-xs"><span className="xl:sr-only">Conciliação</span><span>{row.reconciliation_percent == null ? 'Indisponível' : `${row.reconciliation_percent}%`}</span></div>
                          <Progress value={row.reconciliation_percent ?? 0} className="h-1.5 bg-muted [&>div]:bg-success" />
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-xs"><span className="xl:sr-only">Fechamento</span><span>{row.closing_percent == null ? 'Indisponível' : `${row.closing_percent}%`}</span></div>
                          <Progress value={row.closing_percent ?? 0} className="h-1.5 bg-muted [&>div]:bg-warning" />
                        </div>
                        <div><p className="text-xs text-muted-foreground xl:hidden">Pendências</p><p className={`text-sm font-semibold ${pending > 0 ? 'text-warning' : 'text-success'}`}>{pending}</p></div>
                        <div><span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</span></div>
                        <div><Button variant="outline" size="sm" onClick={() => openSchool(row.school_id)}>Acessar <ChevronRight className="ml-1 h-4 w-4" /></Button></div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground">Mostrando {filtered.length} de {rows.length} empresas em {viewLabels[view].toLocaleLowerCase('pt-BR')}</div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}