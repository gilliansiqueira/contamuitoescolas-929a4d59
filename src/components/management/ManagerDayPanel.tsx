import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Users, Clock3, PauseCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useTeamTime } from '@/hooks/useTeamTime';
import { useMyDay } from '@/hooks/useMyDay';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export interface ManagerTeamSchool { schoolId: string; schoolName: string; late: number; tasksOpen: number; reportOpen: number; reportLate: boolean }
export interface ManagerTeamPerson { key: string; label: string; schools: ManagerTeamSchool[] }
export interface ManagerStalledSchool { schoolId: string; schoolName: string; reason: string }

interface Props {
  today: string;
  team: ManagerTeamPerson[];
  stalled: ManagerStalledSchool[];
  allSchools: { id: string; nome: string }[];
  canViewTeamTime: boolean;
  onOpenSchool: (id: string) => void;
  onOpenTeamTime: () => void;
}

type CardKey = 'team' | 'ponto' | 'stalled' | 'risks';

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function ManagerDayPanel({ today, team, stalled, allSchools, canViewTeamTime, onOpenSchool, onOpenTeamTime }: Props) {
  const [open, setOpen] = useState<CardKey | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [risksOn, setRisksOn] = useState(false);
  const ponto = useTeamTime(today.slice(0, 7), canViewTeamTime);
  const risks = useMyDay(allSchools, today, risksOn);

  const teamWithIssues = useMemo(() => team.map(p => {
    const late = p.schools.reduce((s, x) => s + (x.late > 0 ? 1 : 0), 0);
    const tasks = p.schools.reduce((s, x) => s + x.tasksOpen, 0);
    const reports = p.schools.filter(x => x.reportOpen > 0).length;
    const reportsLate = p.schools.filter(x => x.reportOpen > 0 && x.reportLate).length;
    return { ...p, late, tasks, reports, reportsLate, issues: late + tasks + reports };
  }).filter(p => p.issues > 0).sort((a, b) => b.issues - a.issues), [team]);

  const pontoItems = useMemo(() => {
    const d = ponto.data;
    if (!d) return [] as { name: string; label: string; tone: 'late' | 'warn' }[];
    const names = new Map(d.employees.map(e => [e.external_id, e.nome]));
    const items: { name: string; label: string; tone: 'late' | 'warn' }[] = [];
    for (const r of d.daily) {
      if (r.dia !== today || !names.has(r.employee_external_id)) continue;
      const name = names.get(r.employee_external_id)!;
      if (r.situacao === 'sem_marcacao' || r.situacao === 'falta') items.push({ name, label: 'Sem marcação hoje', tone: 'late' });
      else if (r.situacao === 'incompleta') items.push({ name, label: 'Marcação incompleta', tone: 'warn' });
      else if (r.situacao === 'atraso') items.push({ name, label: `Atraso (entrada ${r.primeira_marcacao ?? '—'})`, tone: 'warn' });
    }
    for (const h of d.hourBank) {
      if (names.has(h.employee_external_id) && (h.saldo_minutos ?? 0) < 0) items.push({ name: names.get(h.employee_external_id)!, label: `Banco de horas negativo (${h.saldo ?? ''})`, tone: 'warn' });
    }
    return items;
  }, [ponto.data, today]);

  const riskCount = risks.data ? risks.data.cashRisks.length + new Set(risks.data.notPaid.map(p => p.schoolId)).size : null;

  const cards: { key: CardKey; label: string; icon: typeof Users; value: string; hidden?: boolean }[] = [
    { key: 'team', label: 'Equipe hoje', icon: Users, value: String(teamWithIssues.length) },
    { key: 'ponto', label: 'Ponto do dia', icon: Clock3, value: ponto.isLoading ? '—' : String(pontoItems.length), hidden: !canViewTeamTime },
    { key: 'stalled', label: 'Empresas paradas', icon: PauseCircle, value: String(stalled.length) },
    { key: 'risks', label: 'Riscos de clientes', icon: AlertTriangle, value: riskCount == null ? '—' : String(riskCount) },
  ];

  const toggle = (k: string) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const click = (k: CardKey) => { if (k === 'risks') setRisksOn(true); setOpen(open === k ? null : k); };

  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-3 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold">Gerência — visão do dia</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.filter(c => !c.hidden).map(c => (
          <button key={c.key} type="button" onClick={() => click(c.key)} aria-pressed={open === c.key}
            className={`rounded-md border border-border p-3 text-left transition-shadow hover:shadow-md ${open === c.key ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-center justify-between text-xs font-medium text-foreground/80">{c.label}<c.icon className="h-3.5 w-3.5 text-primary" /></div>
            <p className="mt-1 text-xl font-semibold">{c.value}</p>
            {c.key === 'risks' && !risksOn && <p className="text-[10px] text-muted-foreground">Clique para calcular</p>}
          </button>
        ))}
      </div>

      {open === 'team' && <div className="mt-3 divide-y divide-border rounded-md border border-border">
        {teamWithIssues.length === 0 && <p className="p-3 text-xs text-muted-foreground">Tudo em dia na equipe.</p>}
        {teamWithIssues.map(p => {
          const parts = [
            p.late ? plural(p.late, 'conciliação atrasada', 'conciliações atrasadas') : '',
            p.tasks ? plural(p.tasks, 'tarefa aberta', 'tarefas abertas') : '',
            p.reports ? `${plural(p.reports, 'relatório aberto', 'relatórios abertos')}${p.reportsLate ? ` (${p.reportsLate} atrasado${p.reportsLate === 1 ? '' : 's'})` : ''}` : '',
          ].filter(Boolean).join(' · ');
          const isOpen = expanded.has(p.key);
          return <div key={p.key}>
            <button type="button" onClick={() => toggle(p.key)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}<strong className="font-medium">{p.label}</strong><span className="text-muted-foreground">— {parts}</span>
            </button>
            {isOpen && <div className="space-y-1 bg-muted/20 px-8 py-2">
              {p.schools.filter(s => s.late || s.tasksOpen || s.reportOpen).map(s => <div key={s.schoolId} className="flex items-center justify-between gap-2 text-xs">
                <span><span className="font-medium">{s.schoolName}</span> <span className="text-muted-foreground">{[s.late ? `${s.late} lançamento(s) atrasado(s)` : '', s.tasksOpen ? `${s.tasksOpen} tarefa(s) aberta(s)` : '', s.reportOpen ? `relatório: ${s.reportOpen} etapa(s)${s.reportLate ? ' — atrasado' : ''}` : ''].filter(Boolean).join(' · ')}</span></span>
                <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onOpenSchool(s.schoolId)}>Abrir</Button>
              </div>)}
            </div>}
          </div>;
        })}
      </div>}

      {open === 'ponto' && <div className="mt-3 rounded-md border border-border p-3 text-xs">
        {ponto.isLoading ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando…</span>
          : pontoItems.length === 0 ? <p className="text-muted-foreground">Nenhum alerta de ponto hoje (ou dados ainda não sincronizados).</p>
          : <ul className="space-y-1">{pontoItems.map((i, idx) => <li key={idx}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${i.tone === 'late' ? 'bg-destructive' : 'bg-warning'}`} /><strong className="font-medium">{i.name}</strong> — {i.label}</li>)}</ul>}
        <Button size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={onOpenTeamTime}>Abrir Ponto da Equipe</Button>
      </div>}

      {open === 'stalled' && <div className="mt-3 space-y-1 rounded-md border border-border p-3 text-xs">
        {stalled.length === 0 && <p className="text-muted-foreground">Nenhuma empresa parada.</p>}
        {stalled.map(s => <div key={s.schoolId} className="flex items-center justify-between gap-2"><span><strong className="font-medium">{s.schoolName}</strong> <span className="text-muted-foreground">— {s.reason}</span></span><Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onOpenSchool(s.schoolId)}>Abrir</Button></div>)}
      </div>}

      {open === 'risks' && <div className="mt-3 space-y-2 rounded-md border border-border p-3 text-xs">
        {risks.isLoading || !risks.data ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Calculando todas as empresas… pode levar alguns segundos.</span> : <>
          <p className="font-medium">Caixa previsto negativo em 15 dias</p>
          {risks.data.cashRisks.length === 0 ? <p className="text-muted-foreground">Nenhuma empresa.</p> : risks.data.cashRisks.map(r => <div key={r.schoolId} className="flex items-center justify-between gap-2"><span><strong className="font-medium">{r.schoolName}</strong> — negativo em {fmtDay(r.firstNegativeDate)} (menor saldo {brl(r.minBalance)})</span><Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onOpenSchool(r.schoolId)}>Abrir</Button></div>)}
          <p className="pt-2 font-medium">Contas que não saíram da conta</p>
          {(() => {
            const by = new Map<string, { name: string; n: number; v: number }>();
            risks.data.notPaid.forEach(p => { const g = by.get(p.schoolId) ?? { name: p.schoolName, n: 0, v: 0 }; g.n++; g.v += p.valor; by.set(p.schoolId, g); });
            return by.size === 0 ? <p className="text-muted-foreground">Nenhuma.</p> : [...by.entries()].map(([id, g]) => <div key={id} className="flex items-center justify-between gap-2"><span><strong className="font-medium">{g.name}</strong> — {plural(g.n, 'conta', 'contas')} · {brl(g.v)}</span><Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onOpenSchool(id)}>Abrir</Button></div>);
          })()}
        </>}
      </div>}
    </section>
  );
}
