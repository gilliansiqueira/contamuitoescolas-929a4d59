import { useMemo, useState } from 'react';
import type { BacklogRow } from '@/hooks/useManagementPortfolio';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowRight, Building2, ChevronDown, Clock3, Wallet } from 'lucide-react';

interface SchoolInfo { school_id: string; school_name: string; responsible_user_id: string | null; responsibleLabel: string }
interface Props {
  rows: BacklogRow[];
  schools: Map<string, SchoolInfo>;
  today: string;
  search: string;
  isLoading: boolean;
  focusSchoolId: string | null;
  onOpenSchool: (id: string) => void;
}

type Age = 'all' | '1' | '2-3' | '4+';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const ageOf = (d: string, today: string) => Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${d}T12:00:00`)) / 86_400_000);

export function ReconciliationBacklog({ rows, schools, today, search, isLoading, focusSchoolId, onOpenSchool }: Props) {
  const [responsible, setResponsible] = useState('all');
  const [age, setAge] = useState<Age>('all');
  const [openSchool, setOpenSchool] = useState<string | null>(focusSchoolId);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  const responsibles = useMemo(() => {
    const m = new Map<string, string>();
    schools.forEach(s => m.set(s.responsible_user_id ?? '__none', s.responsibleLabel));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [schools]);

  const filtered = useMemo(() => {
    const term = search.toLocaleLowerCase('pt-BR');
    return rows.filter(r => {
      const s = schools.get(r.school_id);
      if (!s) return false;
      if (responsible !== 'all' && (s.responsible_user_id ?? '__none') !== responsible) return false;
      const a = ageOf(r.data, today);
      if (age === '1' && a > 1) return false;
      if (age === '2-3' && (a < 2 || a > 3)) return false;
      if (age === '4+' && a < 4) return false;
      return !term || s.school_name.toLocaleLowerCase('pt-BR').includes(term) || s.responsibleLabel.toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [rows, schools, responsible, age, today, search]);

  const groups = useMemo(() => {
    const byResp = new Map<string, { label: string; schools: Map<string, { info: SchoolInfo; days: Map<string, BacklogRow[]> }> }>();
    for (const r of filtered) {
      const info = schools.get(r.school_id)!;
      const key = info.responsible_user_id ?? '__none';
      const g = byResp.get(key) ?? { label: info.responsibleLabel, schools: new Map() };
      const sg = g.schools.get(r.school_id) ?? { info, days: new Map() };
      sg.days.set(r.data, [...(sg.days.get(r.data) ?? []), r]);
      g.schools.set(r.school_id, sg);
      byResp.set(key, g);
    }
    return [...byResp.entries()].map(([key, g]) => {
      const list = [...g.schools.values()].map(s => {
        const items = [...s.days.values()].flat();
        const oldest = [...s.days.keys()].sort()[0];
        return { ...s, total: items.length, value: items.reduce((t, i) => t + Math.abs(i.valor), 0), oldest, days: [...s.days.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
      }).sort((a, b) => b.total - a.total);
      return { key, label: g.label, schools: list, total: list.reduce((t, s) => t + s.total, 0) };
    }).sort((a, b) => b.total - a.total);
  }, [filtered, schools]);

  const totalValue = filtered.reduce((t, r) => t + Math.abs(r.valor), 0);
  const companies = new Set(filtered.map(r => r.school_id)).size;
  const oldest = filtered.reduce<string | null>((m, r) => (!m || r.data < m ? r.data : m), null);
  const toggleDay = (k: string) => setOpenDays(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const cards = [
    { label: 'Pendências acumuladas', value: filtered.length.toLocaleString('pt-BR'), note: 'Lançamentos a conciliar', icon: AlertCircle, strip: 'border-t-destructive bg-destructive/[0.07]', num: 'text-destructive', tone: 'bg-destructive text-destructive-foreground' },
    { label: 'Empresas com pendência', value: companies, note: `de ${schools.size} na carteira`, icon: Building2, strip: 'border-t-progress bg-progress/[0.09]', num: 'text-progress', tone: 'bg-progress text-progress-foreground' },
    { label: 'Pendência mais antiga', value: oldest ? `${ageOf(oldest, today)} dias` : '—', note: oldest ? `desde ${fmt(oldest)}` : 'Nenhuma pendência', icon: Clock3, strip: 'border-t-primary bg-primary/[0.07]', num: 'text-primary', tone: 'bg-primary text-primary-foreground' },
    { label: 'Valor pendente', value: brl(totalValue), note: 'Soma sem sinal', icon: Wallet, strip: 'border-t-info bg-info/[0.07]', num: 'text-info', tone: 'bg-info text-info-foreground' },
  ];

  return (
    <section aria-label="Pendências de conciliação" className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {cards.map(c => <div key={c.label} className={`rounded-lg border border-border border-t-4 p-4 shadow-sm ${c.strip}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-foreground/80">{c.label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${c.tone}`}><c.icon className="h-4 w-4" /></span></div><p className={`mt-2 text-2xl font-semibold leading-none ${c.num}`}>{isLoading ? '—' : c.value}</p><p className="mt-1.5 text-[11px] text-muted-foreground">{c.note}</p></div>)}
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 sm:flex-row">
        <Select value={responsible} onValueChange={setResponsible}><SelectTrigger className="h-9 bg-card text-xs sm:w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as responsáveis</SelectItem>{responsibles.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={age} onValueChange={v => setAge(v as Age)}><SelectTrigger className="h-9 bg-card text-xs sm:w-[200px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Qualquer idade</SelectItem><SelectItem value="1">De ontem (1 dia)</SelectItem><SelectItem value="2-3">2 a 3 dias</SelectItem><SelectItem value="4+">Mais de 3 dias</SelectItem></SelectContent></Select>
        <p className="self-center text-[11px] text-muted-foreground sm:ml-auto">Dias anteriores a hoje, desde 01/09/2026. Conciliou, sai da lista.</p>
      </div>
      {!isLoading && groups.length === 0 && <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Nenhuma pendência de conciliação. Tudo em dia!</div>}
      {groups.map(g => (
        <article key={g.key} className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5"><h2 className="text-sm font-semibold">{g.label}</h2><span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">{g.total} pendência{g.total === 1 ? '' : 's'}</span></header>
          <div className="divide-y divide-border">{g.schools.map(s => {
            const isOpen = openSchool === s.info.school_id; const a = ageOf(s.oldest, today);
            return <div key={s.info.school_id}>
              <button type="button" onClick={() => setOpenSchool(isOpen ? null : s.info.school_id)} aria-expanded={isOpen} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left text-xs hover:bg-muted/30 sm:grid-cols-[1.4fr_2fr_auto_auto]">
                <span className="truncate font-medium">{s.info.school_name}</span>
                <span className="hidden flex-wrap gap-1 sm:flex">{s.days.slice(0, 6).map(([d, items]) => <span key={d} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{fmt(d)}: <strong className="text-foreground">{items.length}</strong></span>)}{s.days.length > 6 && <span className="text-[10px] text-muted-foreground">+{s.days.length - 6} dias</span>}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a > 3 ? 'bg-destructive text-destructive-foreground' : a > 1 ? 'bg-progress text-progress-foreground' : 'bg-muted text-foreground'}`}>{a} dia{a === 1 ? '' : 's'}</span>
                <span className="flex items-center gap-1 font-semibold">{s.total}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></span>
              </button>
              {isOpen && <div className="border-t bg-muted/10 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{s.total} lançamentos · {brl(s.value)}</span><Button size="sm" className="h-7 text-xs" onClick={() => onOpenSchool(s.info.school_id)}>Ir conciliar <ArrowRight className="ml-1 h-3 w-3" /></Button></div>
                <div className="space-y-1.5">{s.days.map(([d, items]) => {
                  const k = `${s.info.school_id}|${d}`; const dayOpen = openDays.has(k) || s.days.length === 1;
                  return <div key={d} className="rounded-md border border-border bg-card">
                    <button type="button" onClick={() => toggleDay(k)} className="flex w-full items-center justify-between px-3 py-2 text-xs"><span className="font-medium capitalize">{fmt(d)} <span className="ml-1 text-muted-foreground">há {ageOf(d, today)} dia{ageOf(d, today) === 1 ? '' : 's'}</span></span><span className="flex items-center gap-1"><strong>{items.length}</strong><ChevronDown className={`h-3 w-3 transition-transform ${dayOpen ? 'rotate-180' : ''}`} /></span></button>
                    {dayOpen && <div className="divide-y divide-border border-t">{items.map(i => <div key={i.transaction_id} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 text-[11px] sm:grid-cols-[2fr_1fr_auto]"><span className="truncate" title={i.descricao}>{i.descricao}</span><span className="hidden truncate text-muted-foreground sm:block">{i.account_name ?? '—'}</span><span className={`text-right font-medium tabular-nums ${i.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>{i.tipo === 'entrada' ? '' : '-'}{brl(Math.abs(i.valor))}</span></div>)}</div>}
                  </div>;
                })}</div>
              </div>}
            </div>;
          })}</div>
        </article>
      ))}
    </section>
  );
}
