import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, Minus, ReceiptText, TrendingUp, Users, MapPinned } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DetailGroup } from '@/hooks/useExpenseDetail';
import type { ExpenseDetailTrip } from '@/hooks/useExpenseDetailTrips';

interface Props {
  trips: ExpenseDetailTrip[];
  groups: DetailGroup[];
  months: string[];
}

interface Summary {
  trips: number;
  people: number;
  revenue: number;
  ticket: number | null;
  averagePeople: number | null;
}

interface AnnualData {
  years: string[];
  throughMonth: number;
  chartRows: Array<Record<string, string | number | null>>;
  summaries: Array<Summary & { year: string }>;
}

type AnnualMetric = 'ticket' | 'people';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const YEAR_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

function currency(value: number | null) {
  return value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function summarize(rows: ExpenseDetailTrip[]): Summary {
  const people = rows.reduce((sum, row) => sum + row.paying_people, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const revenueTrips = rows.filter(row => row.revenue > 0).length;
  return {
    trips: revenueTrips,
    people,
    revenue,
    ticket: people > 0 ? revenue / people : null,
    averagePeople: revenueTrips > 0 ? people / revenueTrips : null,
  };
}

function variation(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return current / previous - 1;
}

function buildAnnualData(source: ExpenseDetailTrip[]): AnnualData {
  const years = Array.from(new Set(source.map(row => row.trip_date.slice(0, 4)))).sort();
  const latestYear = years.at(-1);
  const latestMonths = latestYear
    ? source.filter(row => row.trip_date.startsWith(latestYear)).map(row => Number(row.trip_date.slice(5, 7)))
    : [];
  const throughMonth = latestMonths.length ? Math.max(...latestMonths) : 12;

  const chartRows = MONTHS.map((month, index) => {
    const monthNumber = index + 1;
    const row: Record<string, string | number | null> = { month };
    years.forEach(year => {
      const monthly = source.filter(item => item.trip_date.startsWith(`${year}-${String(monthNumber).padStart(2, '0')}`));
      const data = summarize(monthly);
      row[`${year}-ticket`] = monthly.length ? data.ticket : null;
      row[`${year}-people`] = monthly.length ? data.people : null;
    });
    return row;
  });

  const summaries = years.map(year => {
    const rows = source.filter(row => row.trip_date.startsWith(year) && Number(row.trip_date.slice(5, 7)) <= throughMonth);
    return { year, ...summarize(rows) };
  });

  return { years, throughMonth, chartRows, summaries };
}

export function TicketCentroCusto({ trips, groups, months }: Props) {
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [sort, setSort] = useState<'ticket-desc' | 'ticket-asc' | 'name'>('ticket-desc');
  const monthSet = useMemo(() => new Set(months), [months]);
  const visible = useMemo(() => trips.filter(row => monthSet.has(row.trip_date.slice(0, 7))), [trips, monthSet]);
  const summary = useMemo(() => summarize(visible), [visible]);

  const byGroup = useMemo(() => {
    const rows = groups.map(group => ({ group, summary: summarize(visible.filter(row => row.group_id === group.id)) }))
      .filter(row => row.summary.trips > 0 || row.summary.people > 0 || row.summary.revenue > 0);
    return rows.sort((a, b) => {
      if (sort === 'name') return a.group.name.localeCompare(b.group.name, 'pt-BR', { sensitivity: 'base' });
      const av = a.summary.ticket ?? -1;
      const bv = b.summary.ticket ?? -1;
      return sort === 'ticket-desc' ? bv - av : av - bv;
    });
  }, [groups, visible, sort]);

  const annual = useMemo(() => {
    const source = selectedGroup === 'all' ? trips : trips.filter(row => row.group_id === selectedGroup);
    return buildAnnualData(source);
  }, [trips, selectedGroup]);

  const selectChartGroup = (entry?: { id?: string; payload?: { id?: string } }) => {
    const id = entry?.id ?? entry?.payload?.id;
    if (id) setSelectedGroup(String(id));
  };

  if (!trips.length) return null;
  const hasData = visible.length > 0;
  const lastMonth = trips.reduce((m, r) => r.trip_date.slice(0, 7) > m ? r.trip_date.slice(0, 7) : m, '');
  const lastLabel = lastMonth ? `${MONTHS[Number(lastMonth.slice(5, 7)) - 1].toLowerCase()}/${lastMonth.slice(0, 4)}` : '';

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 className="text-base font-semibold">Público e ticket médio</h3><p className="text-sm text-muted-foreground">Indicadores dos passeios no período selecionado.</p></div>
        <Select value={sort} onValueChange={value => setSort(value as typeof sort)}><SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ticket-desc">Maior ticket</SelectItem><SelectItem value="ticket-asc">Menor ticket</SelectItem><SelectItem value="name">A a Z</SelectItem></SelectContent></Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ReceiptText} label="Ticket médio" value={currency(summary.ticket)} />
        <Stat icon={Users} label="Pessoas pagantes" value={hasData ? summary.people.toLocaleString('pt-BR') : '—'} />
        <Stat icon={MapPinned} label="Passeios realizados" value={hasData ? summary.trips.toLocaleString('pt-BR') : '—'} />
        <Stat icon={TrendingUp} label="Pessoas por passeio" value={summary.averagePeople?.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '—'} />
      </div>

      <Card><CardContent className="p-5"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-semibold">Ticket por centro</h4><p className="text-xs text-muted-foreground">Receita por pessoa pagante · clique em uma barra ou nome para ver a evolução</p></div><Select value={selectedGroup} onValueChange={setSelectedGroup}><SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Todos os centros" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os centros</SelectItem>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select></div>{!hasData ? <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground px-4">Sem dados de passeios neste período. Os últimos dados são de {lastLabel}.</div> : <ResponsiveContainer width="100%" height={Math.max(240, byGroup.length * 42)}><BarChart data={byGroup.map(row => ({ id: row.group.id, name: row.group.name, ticket: row.summary.ticket }))} layout="vertical" margin={{ left: 8, right: 30 }}><XAxis type="number" tickFormatter={value => `R$ ${Math.round(value / 1000)} mil`} /><YAxis type="category" dataKey="name" width={120} tick={props => { const row = byGroup.find(item => item.group.name === props.payload?.value); return <text x={props.x} y={props.y} dy={4} textAnchor="end" fill="hsl(var(--foreground))" fontSize={11} className="cursor-pointer" role="button" tabIndex={0} onClick={() => row && setSelectedGroup(row.group.id)} onKeyDown={event => { if (row && (event.key === 'Enter' || event.key === ' ')) setSelectedGroup(row.group.id); }}>{props.payload?.value}</text>; }} /><Tooltip formatter={(value: number) => [currency(value), 'Ticket médio']} cursor={{ fill: 'hsl(var(--muted) / 0.45)' }} /><Bar dataKey="ticket" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} className="cursor-pointer" onClick={selectChartGroup}>{byGroup.map(row => <Cell key={row.group.id} fill={selectedGroup === row.group.id ? 'hsl(var(--chart-2))' : 'hsl(var(--primary))'} />)}</Bar></BarChart></ResponsiveContainer>}</CardContent></Card>

      {annual.years.length > 0 && (
        <div className="space-y-4">
          <AnnualComparisonCard
            title="Ticket médio por ano"
            subtitle={`Comparação de janeiro a ${MONTHS[annual.throughMonth - 1].toLowerCase()} em todos os anos`}
            metric="ticket"
            years={annual.years}
            chartRows={annual.chartRows}
            summaries={annual.summaries}
          />
          <AnnualComparisonCard
            title="Participantes por ano"
            subtitle={`Comparação de janeiro a ${MONTHS[annual.throughMonth - 1].toLowerCase()} em todos os anos`}
            metric="people"
            years={annual.years}
            chartRows={annual.chartRows}
            summaries={annual.summaries}
          />
        </div>
      )}
    </section>
  );
}

export function CentroCustoAnnualCharts({ trips, groupId, groupName }: { trips: ExpenseDetailTrip[]; groupId: string; groupName: string }) {
  const annual = useMemo(() => buildAnnualData(trips.filter(row => row.group_id === groupId)), [trips, groupId]);
  if (!annual.years.length) return null;

  const subtitle = `Comparação de janeiro a ${MONTHS[annual.throughMonth - 1].toLowerCase()} em ${groupName}`;
  return (
    <div className="space-y-4">
      <AnnualComparisonCard title="Ticket médio por ano" subtitle={subtitle} metric="ticket" years={annual.years} chartRows={annual.chartRows} summaries={annual.summaries} />
      <AnnualComparisonCard title="Participantes por ano" subtitle={subtitle} metric="people" years={annual.years} chartRows={annual.chartRows} summaries={annual.summaries} />
    </div>
  );
}

function AnnualComparisonCard({ title, subtitle, metric, years, chartRows, summaries }: {
  title: string;
  subtitle: string;
  metric: AnnualMetric;
  years: string[];
  chartRows: Array<Record<string, string | number | null>>;
  summaries: Array<Summary & { year: string }>;
}) {
  const format = (value: number | null) => metric === 'ticket' ? currency(value) : value?.toLocaleString('pt-BR') ?? '—';
  const axisFormat = (value: number) => metric === 'ticket'
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : value.toLocaleString('pt-BR');

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
          <div className="flex flex-col justify-center lg:border-r lg:border-border lg:pr-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">{metric === 'ticket' ? <ReceiptText className="h-5 w-5" /> : <Users className="h-5 w-5" />}</div>
              <div><h4 className="text-sm font-semibold">{title}</h4><p className="text-xs text-muted-foreground">{subtitle}</p></div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{metric === 'ticket' ? 'Ticket acumulado por ano' : 'Público acumulado por ano'}</p>
              <div className="mt-3 space-y-2.5">
                {summaries.map((item, index) => {
                  const current = metric === 'ticket' ? item.ticket : item.people;
                  const previousItem = summaries[index - 1];
                  const previous = previousItem ? (metric === 'ticket' ? previousItem.ticket : previousItem.people) : null;
                  const delta = variation(current, previous);
                  return (
                    <div key={item.year} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }} />
                      <div><span className="text-muted-foreground">{item.year}</span><p className="font-bold text-foreground">{format(current)}</p></div>
                      {delta == null ? <Minus className="h-3.5 w-3.5 text-muted-foreground" /> : <span className={`flex items-center gap-0.5 font-semibold ${delta >= 0 ? 'text-success' : 'text-destructive'}`}>{delta >= 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}{Math.abs(delta).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" />Comparação mês a mês</div>
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={chartRows} margin={{ top: 18, right: 14, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={axisFormat} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={metric === 'ticket' ? 78 : 48} />
                <Tooltip formatter={(value: number, name: string) => [format(value), name]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                {years.map((year, index) => <Line key={year} type="monotone" dataKey={`${year}-${metric}`} name={year} stroke={YEAR_COLORS[index % YEAR_COLORS.length]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: YEAR_COLORS[index % YEAR_COLORS.length] }} activeDot={{ r: 5 }} connectNulls={false} />)}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {years.map((year, index) => <div key={year} className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="h-0.5 w-3 rounded" style={{ backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }} />{year}</div>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-lg font-bold">{value}</p></div></CardContent></Card>;
}