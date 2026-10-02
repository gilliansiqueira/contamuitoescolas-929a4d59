import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, CircleDollarSign, ListTodo, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcknowledgePayable, useMyDay, type MyDayPayable } from '@/hooks/useMyDay';
import { fmtBRL, fmtDate } from '@/components/fluxo-bancario/shared';
import { toast } from 'sonner';

export interface MyDayPendingItem {
  schoolId: string;
  schoolName: string;
  label: string;
  tone: 'late' | 'warn';
}

interface Props {
  /** Empresas da pessoa selecionada (responsável da carteira). */
  schools: { id: string; nome: string }[];
  today: string;
  /** Pendências já apuradas na Central (conciliação, extrato, tarefas, relatório). */
  pendingItems: MyDayPendingItem[];
  /** Seletor de pessoa (só super admin). */
  personSelector?: { value: string; options: { id: string; label: string }[]; onChange: (id: string) => void };
  personLabel: string;
  onOpenSchool: (schoolId: string) => void;
}

type CardKey = 'pay' | 'schedule' | 'pending' | 'cash' | 'notpaid';

function PayableRow({ p, onOpenSchool }: { p: MyDayPayable; onOpenSchool: (id: string) => void }) {
  const ack = useAcknowledgePayable();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={p.descricao}>{p.descricao || p.categoria}</p>
        <p className="text-[10px] text-muted-foreground">
          {p.schoolName} · vence {fmtDate(p.dueDate)}{p.antecipado ? ' (dia não útil — agendar antes)' : ''}
        </p>
      </div>
      <strong className="text-xs">{fmtBRL(p.valor)}</strong>
      <Button
        size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
        disabled={ack.isPending}
        onClick={() => ack.mutate(
          { schoolId: p.schoolId, entryId: p.entryId, dueDate: p.dueDate },
          { onError: () => toast.error('Não foi possível marcar como agendado.') },
        )}
      >
        <CheckCircle2 className="h-3 w-3" />Agendado
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onOpenSchool(p.schoolId)}>Abrir</Button>
    </div>
  );
}

/** Uma linha por empresa ("Dourados — 10 contas · R$ X"); ao clicar, abre as contas. */
function GroupedPayables({ items, unit, onOpenSchool, empty }: { items: MyDayPayable[]; unit: string; onOpenSchool: (id: string) => void; empty: string }) {
  const [openSchool, setOpenSchool] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; list: MyDayPayable[]; total: number }>();
    for (const p of items) {
      const g = m.get(p.schoolId) ?? { id: p.schoolId, nome: p.schoolName, list: [], total: 0 };
      g.list.push(p); g.total += p.valor; m.set(p.schoolId, g);
    }
    return [...m.values()].sort((a, b) => b.list.length - a.list.length || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [items]);
  if (!groups.length) return <Empty text={empty} />;
  return (
    <>
      {groups.map(g => (
        <div key={g.id} className="rounded-md border border-border bg-background">
          <button type="button" onClick={() => setOpenSchool(c => (c === g.id ? null : g.id))} aria-expanded={openSchool === g.id}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted/40">
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${openSchool === g.id ? '' : '-rotate-90'}`} />
            <span className="min-w-0 flex-1 truncate"><strong>{g.nome}</strong> — {g.list.length} {g.list.length === 1 ? 'conta' : 'contas'} {unit}</span>
            <strong>{fmtBRL(g.total)}</strong>
          </button>
          {openSchool === g.id && (
            <div className="space-y-1.5 border-t border-border p-2">
              {g.list.map(p => <PayableRow key={`${p.entryId}:${p.dueDate}`} p={p} onOpenSchool={onOpenSchool} />)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function GroupedPending({ items, onOpenSchool }: { items: MyDayPendingItem[]; onOpenSchool: (id: string) => void }) {
  const [openSchool, setOpenSchool] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; list: MyDayPendingItem[] }>();
    for (const it of items) {
      const g = m.get(it.schoolId) ?? { id: it.schoolId, nome: it.schoolName, list: [] };
      g.list.push(it); m.set(it.schoolId, g);
    }
    return [...m.values()].sort((a, b) => b.list.length - a.list.length || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [items]);
  if (!groups.length) return <Empty text="Nenhuma pendência nas suas empresas." />;
  return (
    <>
      {groups.map(g => {
        const late = g.list.some(i => i.tone === 'late');
        return (
          <div key={g.id} className="rounded-md border border-border bg-background">
            <button type="button" onClick={() => setOpenSchool(c => (c === g.id ? null : g.id))} aria-expanded={openSchool === g.id}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted/40">
              <span className={`h-2 w-2 shrink-0 rounded-full ${late ? 'bg-destructive' : 'bg-warning'}`} />
              <span className="min-w-0 flex-1 truncate"><strong>{g.nome}</strong> — {g.list.length} {g.list.length === 1 ? 'pendência' : 'pendências'}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${openSchool === g.id ? '' : '-rotate-90'}`} />
            </button>
            {openSchool === g.id && (
              <div className="space-y-1 border-t border-border p-2">
                {g.list.map((item, i) => (
                  <button key={i} type="button" onClick={() => onOpenSchool(item.schoolId)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/40">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.tone === 'late' ? 'bg-destructive' : 'bg-warning'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function MyDayPanel({ schools, today, pendingItems, personSelector, personLabel, onOpenSchool }: Props) {
  const { data, isLoading } = useMyDay(schools, today, schools.length > 0);
  const [open, setOpen] = useState<CardKey | null>(null);

  const totals = useMemo(() => ({
    pay: data?.payToday.length ?? 0,
    payValor: (data?.payToday ?? []).reduce((s, p) => s + p.valor, 0),
    schedule: data?.scheduleToday.length ?? 0,
    notPaid: data?.notPaid.length ?? 0,
    pending: pendingItems.length,
    cash: data?.cashRisks.length ?? 0,
  }), [data, pendingItems]);

  const cards: { key: CardKey; label: string; count: number; note: string; icon: typeof Wallet; tone: string; active: string }[] = [
    { key: 'pay', label: 'Pagamentos de hoje', count: totals.pay, note: fmtBRL(totals.payValor), icon: CircleDollarSign, tone: 'text-destructive', active: 'border-destructive/40 bg-destructive/[0.06]' },
    { key: 'schedule', label: 'Agendar hoje', count: totals.schedule, note: 'vencem amanhã ou em dia não útil', icon: CalendarClock, tone: 'text-warning', active: 'border-warning/40 bg-warning/[0.06]' },
    { key: 'notpaid', label: 'Não saiu da conta', count: totals.notPaid, note: 'vencidas sem saída no extrato', icon: AlertTriangle, tone: 'text-destructive', active: 'border-destructive/40 bg-destructive/[0.06]' },
    { key: 'pending', label: 'Pendências', count: totals.pending, note: 'conciliação, extrato, tarefas e relatório', icon: ListTodo, tone: 'text-warning', active: 'border-warning/40 bg-warning/[0.06]' },
    { key: 'cash', label: 'Caixa em risco', count: totals.cash, note: 'saldo negativo nos próximos 15 dias', icon: Wallet, tone: 'text-destructive', active: 'border-destructive/40 bg-destructive/[0.06]' },
  ];

  const toggle = (key: CardKey) => setOpen(current => (current === key ? null : key));

  return (
    <section aria-label="Meu dia" className="mb-4 rounded-lg border border-border bg-card p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Meu dia — {personLabel}</h2>
          <span className="text-[10px] text-muted-foreground">{fmtDate(today)}</span>
        </div>
        {personSelector && (
          <Select value={personSelector.value} onValueChange={personSelector.onChange}>
            <SelectTrigger className="h-8 w-[200px] bg-background text-xs" aria-label="Ver painel de outra pessoa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {personSelector.options.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {schools.length === 0 ? (
        <p className="rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">Nenhuma empresa sob sua responsabilidade no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {cards.map(card => (
              <button
                key={card.key} type="button" onClick={() => toggle(card.key)}
                aria-expanded={open === card.key}
                className={`rounded-lg border border-border p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${open === card.key ? card.active : 'bg-background'}`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] font-medium leading-tight text-foreground/80">{card.label}</span>
                  <card.icon className={`h-3.5 w-3.5 shrink-0 ${card.tone}`} />
                </div>
                <p className={`mt-1 text-xl font-semibold leading-none ${card.tone}`}>{isLoading ? '—' : card.count}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{card.note}</p>
              </button>
            ))}
          </div>

          {open && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-foreground/80">{cards.find(c => c.key === open)?.label}</p>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(null)} aria-label="Fechar detalhe"><ChevronDown className="h-3.5 w-3.5 rotate-180" /></Button>
              </div>

              {open === 'pay' && <GroupedPayables items={data?.payToday ?? []} unit="vencem hoje" onOpenSchool={onOpenSchool} empty="Nenhuma conta vence hoje." />}
              {open === 'schedule' && <GroupedPayables items={data?.scheduleToday ?? []} unit="a agendar" onOpenSchool={onOpenSchool} empty="Nada para agendar hoje." />}
              {open === 'notpaid' && <GroupedPayables items={data?.notPaid ?? []} unit="sem saída no extrato" onOpenSchool={onOpenSchool} empty="Todas as contas vencidas saíram da conta." />}
              {open === 'pending' && <GroupedPending items={pendingItems} onOpenSchool={onOpenSchool} />}
              {open === 'cash' && (data?.cashRisks.length ? data.cashRisks.map(r => (
                <button key={r.schoolId} type="button" onClick={() => onOpenSchool(r.schoolId)} className="flex w-full items-center gap-2 rounded-md border border-destructive/30 bg-destructive/[0.05] px-2.5 py-2 text-left text-xs hover:bg-destructive/10">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="min-w-0 flex-1"><strong>{r.schoolName}</strong> — saldo previsto negativo em {fmtDate(r.firstNegativeDate)} (menor saldo: {fmtBRL(r.minBalance)})</span>
                </button>
              )) : <Empty text="Nenhum caixa negativo previsto nos próximos 15 dias." />)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">{text}</p>;
}
