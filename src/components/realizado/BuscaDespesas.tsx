import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, X, ListFilter, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { YoYLineChart } from './YoYLineChart.quintal';
import { toast } from 'sonner';
import { extractPersonName, attributeUnnamedProLabore } from '@/lib/expenseInsights';

interface Entry {
  id: string;
  data: string;
  descricao: string;
  conta_nome: string;
  valor: number;
  [key: string]: any;
}

interface Props {
  entries: Entry[];
  contaGrupoMap: Record<string, string>;
  closedMonths: Set<string>;
  onEditEntry?: (entry: Entry) => void;
  onDeleteEntries?: (params: { ids?: string[]; month?: string; grupoName?: string }) => Promise<void>;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo) - 1] || ''}/${y?.slice(2) || ''}`;
}
function formatDate(d: string) {
  if (!d || d.length < 10) return d || '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function norm(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function BuscaDespesas({ entries, contaGrupoMap, closedMonths, onEditEntry, onDeleteEntries }: Props) {
  const [search, setSearch] = useState('');
  const [grupo, setGrupo] = useState('all');
  const [conta, setConta] = useState('all');
  const [showEntries, setShowEntries] = useState(false);
  const [monthFocus, setMonthFocus] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState('all');
  const [ordem, setOrdem] = useState<'data' | 'valor'>('data');

  const grupos = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => set.add(contaGrupoMap[norm(e.conta_nome || '')] || 'Outros'));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [entries, contaGrupoMap]);

  const contasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      const g = contaGrupoMap[norm(e.conta_nome || '')] || 'Outros';
      if (grupo !== 'all' && g !== grupo) return;
      if (e.conta_nome) set.add(e.conta_nome);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [entries, contaGrupoMap, grupo]);

  const attributed = useMemo(() => attributeUnnamedProLabore(entries), [entries]);
  const personOf = (e: Entry) => extractPersonName(e.descricao) || attributed[e.id] || null;

  const pessoas = useMemo(() => {
    const m: Record<string, number> = {};
    entries.forEach(e => { const n = personOf(e); if (n) m[n] = (m[n] || 0) + Number(e.valor || 0); });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [entries, attributed]);
  const semNome = useMemo(() => {
    const rows = entries.filter(e => /pro.?labore|salario|folha/.test(norm(`${e.conta_nome} ${e.descricao}`)) && !personOf(e));
    return { count: rows.length, total: rows.reduce((s, e) => s + Number(e.valor || 0), 0) };
  }, [entries, attributed]);

  const hasFilter = search.trim().length > 0 || grupo !== 'all' || conta !== 'all' || pessoa !== 'all';

  const filtered = useMemo(() => {
    if (!hasFilter) return [] as Entry[];
    const q = norm(search);
    return entries.filter(e => {
      const g = contaGrupoMap[norm(e.conta_nome || '')] || 'Outros';
      if (grupo !== 'all' && g !== grupo) return false;
      if (conta !== 'all' && e.conta_nome !== conta) return false;
      if (pessoa !== 'all' && personOf(e) !== pessoa) return false;
      if (q) {
        const hay = `${norm(e.descricao)} ${norm(e.conta_nome)}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, contaGrupoMap, grupo, conta, pessoa, search, hasFilter, attributed]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const byMonth: Record<string, number> = {};
    let total = 0;
    filtered.forEach(e => {
      const ym = e.data?.slice(0, 7);
      const v = Number(e.valor || 0);
      total += v;
      if (ym && ym.length === 7) byMonth[ym] = (byMonth[ym] || 0) + v;
    });
    const months = Object.keys(byMonth).sort();
    const top = months.reduce<{ m: string; v: number } | null>((acc, m) => {
      if (!acc || byMonth[m] > acc.v) return { m, v: byMonth[m] };
      return acc;
    }, null);
    return {
      total,
      count: filtered.length,
      media: months.length ? total / months.length : 0,
      months,
      lastMonth: months[months.length - 1],
      top,
    };
  }, [filtered]);

  const listEntries = useMemo(() => {
    const base = monthFocus ? filtered.filter(e => e.data?.startsWith(monthFocus)) : filtered;
    const arr = [...base];
    if (ordem === 'valor') arr.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    else arr.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    return arr;
  }, [filtered, monthFocus, ordem]);

  const clear = () => {
    setSearch(''); setGrupo('all'); setConta('all'); setPessoa('all'); setMonthFocus(null); setShowEntries(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Buscar despesa</h3>
            <span className="text-xs text-muted-foreground">histórico completo, independente do mês filtrado</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="rounded-xl pl-9"
                placeholder="Buscar por descrição ou categoria..."
                value={search}
                onChange={e => { setSearch(e.target.value); setMonthFocus(null); }}
              />
            </div>

            <Select value={grupo} onValueChange={(v) => { setGrupo(v); setConta('all'); setMonthFocus(null); }}>
              <SelectTrigger className="rounded-xl w-[200px]">
                <SelectValue placeholder="Categoria-mãe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias-mãe</SelectItem>
                {grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={conta} onValueChange={(v) => { setConta(v); setMonthFocus(null); }}>
              <SelectTrigger className="rounded-xl w-[220px]">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas as contas</SelectItem>
                {contasDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={pessoa} onValueChange={(v) => { setPessoa(v); setMonthFocus(null); }}>
              <SelectTrigger className="rounded-xl w-[240px]">
                <SelectValue placeholder="Pessoa" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas as pessoas</SelectItem>
                {pessoas.map(([n, v]) => <SelectItem key={n} value={n}>{n} · {formatCurrency(v)}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasFilter && (
              <Button size="sm" variant="ghost" className="rounded-xl gap-1.5" onClick={clear}>
                <X className="w-4 h-4" /> Limpar
              </Button>
            )}
          </div>

          {!hasFilter && (
            <p className="text-xs text-muted-foreground">
              Busque ou selecione uma categoria para ver o histórico mês a mês e os lançamentos.
            </p>
          )}

          {hasFilter && !stats && (
            <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado para esse filtro.</p>
          )}

          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total no histórico</p>
                  <p className="text-sm font-bold">{formatCurrency(stats.total)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Média mensal</p>
                  <p className="text-sm font-bold">{formatCurrency(stats.media)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Maior mês</p>
                  <p className="text-sm font-bold">
                    {stats.top ? `${formatMonth(stats.top.m)} · ${formatCurrency(stats.top.v)}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Lançamentos</p>
                  <p className="text-sm font-bold">{stats.count}</p>
                </div>
              </div>

              {pessoa !== 'all' && (
                <div className="rounded-xl border border-border/60 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Acumulado pago a {pessoa}, por conta</p>
                  {Object.entries(filtered.reduce<Record<string, number>>((m, e) => { m[e.conta_nome || '—'] = (m[e.conta_nome || '—'] || 0) + Number(e.valor || 0); return m; }, {}))
                    .sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                      <div key={c} className="flex justify-between text-sm"><span>{c}</span><span className="font-semibold">{formatCurrency(v)}</span></div>
                    ))}
                  {semNome.count > 0 && (
                    <p className="text-xs text-muted-foreground pt-1">Atenção: {semNome.count} lançamento(s) de pró-labore/salário sem nome identificado na descrição ({formatCurrency(semNome.total)}) não entram nesse filtro.</p>
                  )}
                </div>
              )}

              <div className="pt-2">
                <YoYLineChart
                  title="Histórico da despesa filtrada"
                  activeMonth={stats.lastMonth}
                  entries={filtered.map(e => ({ data: e.data || '', valor: Number(e.valor || 0) }))}
                  invertColors
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => setShowEntries(v => !v)}
                >
                  {showEntries ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showEntries ? 'Ocultar lançamentos' : 'Ver lançamentos'}
                </Button>

                {showEntries && (
                  <>
                    <Select value={ordem} onValueChange={(v) => setOrdem(v as 'data' | 'valor')}>
                      <SelectTrigger className="rounded-xl w-[180px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="data">Mais recentes primeiro</SelectItem>
                        <SelectItem value="valor">Maior valor primeiro</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={monthFocus || 'all'} onValueChange={(v) => setMonthFocus(v === 'all' ? null : v)}>
                      <SelectTrigger className="rounded-xl w-[170px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="all">Todos os meses</SelectItem>
                        {[...stats.months].reverse().map(m => (
                          <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              {showEntries && (
                <div className="rounded-xl border border-border/60 divide-y divide-border/60 max-h-[420px] overflow-y-auto">
                  {listEntries.map(e => {
                    const ym = e.data?.slice(0, 7) || '';
                    const locked = closedMonths.has(ym);
                    return (
                      <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{formatDate(e.data)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{e.descricao || e.conta_nome || '—'}</p>
                          <p className="text-xs text-muted-foreground truncate">{e.conta_nome}{attributed[e.id] && !extractPersonName(e.descricao) ? ` · atribuído automaticamente a ${attributed[e.id]}` : ''}</p>
                        </div>
                        <span className="font-semibold whitespace-nowrap">{formatCurrency(Number(e.valor || 0))}</span>
                        {onEditEntry && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                            title="Editar"
                            onClick={() => onEditEntry(e)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteEntries && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                            title="Excluir"
                            onClick={async () => {
                              if (locked) { toast.error('Mês fechado. Edição bloqueada.'); return; }
                              if (confirm('Excluir este lançamento?')) {
                                await onDeleteEntries({ ids: [e.id] });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {listEntries.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum lançamento nesse mês.</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
