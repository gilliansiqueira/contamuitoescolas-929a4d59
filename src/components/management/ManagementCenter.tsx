import { useMemo, useState } from 'react';
import type { School } from '@/types/financial';
import { useAuth } from '@/hooks/useAuth';
import { useManagementPortfolio, type PortfolioRow } from '@/hooks/useManagementPortfolio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import contaMuitoLogo from '@/assets/logo-conta-muito.png';
import { AlertTriangle, Building2, CheckCircle2, ChevronRight, CircleGauge, Clock3, FileCheck2, LayoutDashboard, LogOut, Search, Settings2, Users } from 'lucide-react';

interface Props {
  schools: School[];
  onSelect: (school: School) => void;
  onSignOut: () => void;
}

type Situation = 'all' | 'finalizado' | 'bloqueado' | 'atrasado' | 'atencao' | 'em_dia' | 'sem_acompanhamento';
type ManagementView = 'overview' | 'closing' | 'responsible' | 'alerts';
type RowStatus = Exclude<Situation, 'all'>;

function statusOf(row: PortfolioRow, month: string): RowStatus {
  if (row.period_closed && row.report_delivered && row.checklist_pending === 0) return 'finalizado';
  if (row.waiting_for_client) return 'bloqueado';
  if (row.data_updated_through == null && row.reconciliation_percent == null && row.closing_percent == null && !row.report_delivered && !row.period_closed) return 'sem_acompanhamento';
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (month < currentMonth && (!row.period_closed || !row.report_delivered)) return 'atrasado';
  if (row.reconciliation_pending > 0 || row.checklist_pending > 0) return 'atencao';
  return 'em_dia';
}

const statusLabels = { finalizado: 'Finalizado', bloqueado: 'Aguardando cliente', atrasado: 'Atrasada', atencao: 'Atenção', em_dia: 'Em dia', sem_acompanhamento: 'Sem acompanhamento' };
const statusStyles = { finalizado: 'bg-success/10 text-success', bloqueado: 'bg-info/10 text-info', atrasado: 'bg-destructive/10 text-destructive', atencao: 'bg-warning/10 text-warning', em_dia: 'bg-secondary/15 text-secondary', sem_acompanhamento: 'bg-muted text-muted-foreground' };
const viewLabels: Record<ManagementView, string> = { overview: 'Central de Gestão', closing: 'Fechamento Mensal', responsible: 'Por Responsável', alerts: 'Alertas e Pendências' };

export function ManagementCenter({ schools, onSelect, onSignOut }: Props) {
  const { isSuperAdmin, profile } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [situation, setSituation] = useState<Situation>('all');
  const [view, setView] = useState<ManagementView>('overview');
  const { data: rows = [], isLoading, isError } = useManagementPortfolio(month, true);
  const schoolById = useMemo(() => new Map(schools.map(s => [s.id, s])), [schools]);
  const filtered = useMemo(() => rows.filter(row => {
    const matchesSearch = row.school_name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
    const status = statusOf(row, month);
    const matchesView = view === 'overview'
      || (view === 'closing' && (!row.period_closed || !row.report_delivered))
      || (view === 'responsible' && !!row.responsible_user_id)
      || (view === 'alerts' && ['atrasado', 'atencao', 'bloqueado'].includes(status));
    return matchesSearch && matchesView && (situation === 'all' || status === situation);
  }), [rows, search, situation, month, view]);
  const finalized = rows.filter(r => statusOf(r, month) === 'finalizado').length;
  const attention = rows.filter(r => ['atrasado', 'atencao', 'bloqueado'].includes(statusOf(r, month))).length;
  const pendingRecon = rows.reduce((sum, r) => sum + r.reconciliation_pending, 0);
  const updatedToday = rows.filter(r => r.data_updated_through === new Date().toISOString().slice(0, 10)).length;
  const firstName = profile?.email?.split('@')[0] || 'equipe';

  const openSchool = (id: string) => {
    const school = schoolById.get(id);
    if (school) onSelect(school);
  };

  return (
    <div className="min-h-screen bg-background lg:flex">
      {isSuperAdmin && <aside className="app-sidebar hidden w-60 shrink-0 flex-col lg:flex">
        <div className="flex items-center gap-3 p-5"><img src={contaMuitoLogo} alt="Conta Muito" className="h-9 w-auto object-contain brightness-0 invert" /></div>
        <nav className="flex-1 space-y-1 px-3 pt-4">
          {[
            { key: 'overview' as const, label: 'Visão Geral', icon: LayoutDashboard },
            { key: 'closing' as const, label: 'Fechamento Mensal', icon: FileCheck2 },
            { key: 'responsible' as const, label: 'Por Responsável', icon: Users },
            { key: 'alerts' as const, label: 'Alertas e Pendências', icon: AlertTriangle },
          ].map(item => <button key={item.key} onClick={() => setView(item.key)} className={`app-sidebar-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${view === item.key ? 'app-sidebar-item-active font-semibold' : ''}`}><item.icon className="h-5 w-5" /><span>{item.label}</span></button>)}
          <div className="app-sidebar-divider mt-4 border-t pt-4"><div className="flex items-center gap-3 px-3 py-2 text-sm text-primary-foreground/60"><CircleGauge className="h-5 w-5" /><span>Caixa Crítico</span></div></div>
        </nav>
        <div className="app-sidebar-divider border-t p-3"><div className="flex items-center gap-3 px-3 py-2 text-sm text-primary-foreground/70"><Settings2 className="h-5 w-5" /><span>Configurações</span></div></div>
      </aside>}
      <div className="min-w-0 flex-1">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <img src={contaMuitoLogo} alt="Conta Muito" className="h-7 w-7 object-contain brightness-0 invert" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Conta Muito</p>
              <p className="text-xs text-muted-foreground">{isSuperAdmin ? viewLabels[view] : 'Carteira de Clientes'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input aria-label="Período" type="month" value={month} onChange={e => setMonth(e.target.value)} className="hidden w-40 sm:block" />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-primary">{isSuperAdmin ? (view === 'overview' ? 'Visão geral da operação' : view === 'closing' ? 'Fechamento mensal' : view === 'responsible' ? 'Empresas com responsável' : 'Prioridades da equipe') : 'Carteira atribuída'}</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Bom dia, {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe o período e acesse rapidamente o que precisa de atenção.</p>
          </div>
          <Input aria-label="Período mobile" type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full sm:hidden" />
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Empresas ativas', value: rows.length, icon: Building2, hint: isSuperAdmin ? 'Carteira completa' : 'Na sua carteira' },
            { label: 'Atualizadas hoje', value: updatedToday, icon: CheckCircle2, hint: 'Pela data dos dados' },
            { label: 'Conciliações pendentes', value: pendingRecon, icon: Clock3, hint: `${attention} empresas em atenção` },
            { label: 'Fechamentos concluídos', value: finalized, icon: FileCheck2, hint: `No período ${month}` },
          ].map(card => <div key={card.label} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between"><span className="text-sm text-muted-foreground">{card.label}</span><card.icon className="h-5 w-5 text-primary" /></div>
            <p className="text-3xl font-bold">{isLoading ? '—' : card.value}</p><p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </div>)}
        </div>

        {isSuperAdmin && <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Dados concluídos</p><p className="mt-2 text-lg font-semibold">{rows.some(r => r.closing_percent != null) ? `${Math.round(rows.reduce((s, r) => s + (r.closing_percent ?? 0), 0) / Math.max(1, rows.filter(r => r.closing_percent != null).length))}%` : 'Sem checklist'}</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Relatórios entregues</p><p className="mt-2 text-lg font-semibold">{rows.length ? `${Math.round((rows.filter(r => r.report_delivered).length / rows.length) * 100)}%` : '—'}</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Fechamento finalizado</p><p className="mt-2 text-lg font-semibold">{rows.length ? `${Math.round((finalized / rows.length) * 100)}%` : '—'}</p></div>
        </div>}

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[minmax(220px,1fr)_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa..." className="pl-9" /></div>
            <Select value={situation} onValueChange={value => setSituation(value as Situation)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem><SelectItem value="finalizado">Finalizadas</SelectItem><SelectItem value="bloqueado">Aguardando cliente</SelectItem><SelectItem value="atrasado">Atrasadas</SelectItem><SelectItem value="atencao">Atenção</SelectItem><SelectItem value="em_dia">Em dia</SelectItem><SelectItem value="sem_acompanhamento">Sem acompanhamento</SelectItem></SelectContent></Select>
          </div>
          {isError ? <p className="p-8 text-center text-sm text-destructive">Não foi possível carregar a carteira.</p> :
          <div className="divide-y divide-border">
            {!isLoading && filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>}
            {filtered.map(row => {
              const status = statusOf(row, month);
              return <div key={row.school_id} className="grid gap-4 p-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(180px,1.2fr)_minmax(140px,.8fr)_minmax(150px,.8fr)_minmax(150px,.8fr)_auto] lg:items-center">
                <div className="min-w-0"><p className="truncate font-semibold">{row.school_name}</p><p className="mt-1 text-xs text-muted-foreground">Atualizado até {row.data_updated_through ? new Date(`${row.data_updated_through}T12:00:00`).toLocaleDateString('pt-BR') : 'sem data'}</p></div>
                <div><p className="text-xs text-muted-foreground">Responsável</p><p className="truncate text-sm">{row.responsible_email ?? 'Não definida'}</p></div>
                <div><div className="mb-1 flex justify-between text-xs"><span>Conciliação</span><span>{row.reconciliation_percent == null ? 'Sem conciliação' : `${row.reconciliation_percent}%`}</span></div><Progress value={row.reconciliation_percent ?? 0} className="h-1.5 bg-muted [&>div]:bg-secondary" /></div>
                <div><div className="mb-1 flex justify-between text-xs"><span>Fechamento</span><span>{row.closing_percent == null ? 'Sem checklist' : `${row.closing_percent}%`}</span></div><Progress value={row.closing_percent ?? 0} className="h-1.5 bg-muted" /></div>
                <div className="flex items-center justify-between gap-3 lg:justify-end"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</span><Button variant="ghost" size="sm" onClick={() => openSchool(row.school_id)}>Acessar <ChevronRight className="ml-1 h-4 w-4" /></Button></div>
              </div>;
            })}
          </div>}
        </section>
        {isSuperAdmin && <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Users className="h-4 w-4" /> Por responsável usa somente atribuições reais.</span><span className="flex items-center gap-1"><CircleGauge className="h-4 w-4" /> Percentuais sem fonte aparecem como indisponíveis.</span><span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Caixa crítico ainda não foi ativado.</span></div>}
      </main>
      </div>
    </div>
  );
}