import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

export interface FiltroEntry {
  id?: string;
  data: string;
  valor: number;
  descricao?: string;
  complemento?: string;
  conta_nome?: string;
}

interface Props {
  /** Nome da categoria/subcategoria filtrada (apenas exibição). */
  label: string;
  entries: FiltroEntry[];
  /** Mês em foco (YYYY-MM) — inicia expandido. */
  activeMonth?: string;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonthLong(m: string) {
  const [y, mo] = m.split('-');
  return `${MESES[parseInt(mo) - 1]}/${y}`;
}

function formatDate(d: string) {
  const [y, m, dd] = (d || '').split('-');
  return dd ? `${dd}/${m}` : d;
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function FiltroLancamentos({ label, entries, activeMonth }: Props) {
  const [search, setSearch] = useState('');
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(
    activeMonth ? { [activeMonth]: true } : {}
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = normalize(search.trim());
    return entries.filter(e =>
      normalize(`${e.descricao || ''} ${e.complemento || ''} ${e.conta_nome || ''}`).includes(q)
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map: Record<string, FiltroEntry[]> = {};
    filtered.forEach(e => {
      const ym = (e.data || '').slice(0, 7);
      if (!ym) return;
      (map[ym] ||= []).push(e);
    });
    return Object.entries(map)
      .map(([month, items]) => ({
        month,
        items: items.slice().sort((a, b) => (a.data < b.data ? 1 : -1)),
        total: items.reduce((s, i) => s + Number(i.valor || 0), 0),
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [filtered]);

  const totalGeral = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.valor || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-foreground">Lançamentos de {label}</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} lançamento{filtered.length === 1 ? '' : 's'} · {formatCurrency(totalGeral)}
        </span>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por descrição..."
          className="w-full text-xs rounded-lg border border-border bg-background pl-8 pr-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map(g => {
            const open = !!openMonths[g.month];
            return (
              <div key={g.month} className="rounded-xl border border-border/60 overflow-hidden">
                <button
                  onClick={() => setOpenMonths(prev => ({ ...prev, [g.month]: !prev[g.month] }))}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {formatMonthLong(g.month)}
                    <span className="text-muted-foreground font-normal">({g.items.length})</span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatCurrency(g.total)}
                  </span>
                </button>
                {open && (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-1.5 px-2 font-medium w-16">Data</th>
                          <th className="text-left py-1.5 px-2 font-medium">Descrição</th>
                          <th className="text-left py-1.5 px-2 font-medium hidden sm:table-cell">Categoria</th>
                          <th className="text-right py-1.5 px-2 font-medium w-28">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((e, i) => (
                          <tr key={e.id || `${e.data}-${i}`} className="border-b border-border/20 hover:bg-muted/30">
                            <td className="py-1.5 px-2 text-muted-foreground tabular-nums">{formatDate(e.data)}</td>
                            <td className="py-1.5 px-2 text-foreground">
                              {e.descricao || e.complemento || '—'}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground hidden sm:table-cell">{e.conta_nome || '—'}</td>
                            <td className="py-1.5 px-2 text-right font-medium tabular-nums text-foreground">
                              {formatCurrency(Number(e.valor || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
