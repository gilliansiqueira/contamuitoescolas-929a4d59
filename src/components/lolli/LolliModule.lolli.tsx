import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronLeft, ChevronRight, Search, Package, ShoppingBag, Receipt, Landmark, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalPeriod } from '@/contexts/GlobalPeriodContext';
import { fetchAllRows } from '@/lib/fetchAll';
import { isLolli, lolliDatasets, lolliMatchesPeriod, type LolliColumn } from '@/lib/lolli';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DataRow = Record<string, unknown> & { id: string };
const money = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function cell(value: unknown, col: LolliColumn): string {
  if (value === null || value === undefined || value === '') return '—';
  if (col.money) return money(value);
  if (col.date && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10).split('-').reverse().join('/');
  return String(value);
}
const PAGE_SIZE = 40;

export function LolliModule({ schoolId }: { schoolId: string }) {
  const { isAdmin } = useAuth();
  if (!isLolli(schoolId) || !isAdmin) return <p className="text-muted-foreground">Acesso restrito à equipe autorizada.</p>;
  return <LolliRecords key={schoolId} schoolId={schoolId} />;
}

function LolliRecords({ schoolId }: { schoolId: string }) {
  const { months } = useGlobalPeriod();
  const [datasetKey, setDatasetKey] = useState('sales');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const dataset = lolliDatasets.find(d => d.key === datasetKey) ?? lolliDatasets[0];
  const { data: batches = [] } = useQuery({
    queryKey: ['lolli-batches', schoolId],
    queryFn: () => fetchAllRows<DataRow>('lolli_import_batches', q => q.eq('school_id', schoolId)),
  });
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const batch of batches) {
      const manifest = batch.manifest as Record<string, { rows?: number }> | undefined;
      for (const [key, entry] of Object.entries(manifest ?? {})) out[key] = (out[key] ?? 0) + Number(entry.rows ?? 0);
    }
    return out;
  }, [batches]);
  const { data: records = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['lolli-records', schoolId, dataset.key],
    queryFn: () => fetchAllRows<DataRow>(`lolli_${dataset.key}`, q => q.eq('school_id', schoolId), 1000,
      ['id', ...dataset.columns.map(c => c.key), 'source_file'].join(',')),
  });
  const inPeriod = useMemo(() => records.filter(r => !dataset.date || lolliMatchesPeriod(r[dataset.date], months)), [records, dataset, months]);
  const statuses = useMemo(() => [...new Set(inPeriod.map(r => r.status).filter((s): s is string => typeof s === 'string' && s !== ''))].sort(), [inPeriod]);
  const filtered = useMemo(() => {
    const term = search.toLocaleLowerCase('pt-BR');
    return inPeriod.filter(r => (status === 'all' || r.status === status) && (!term || dataset.columns.some(c => String(r[c.key] ?? '').toLocaleLowerCase('pt-BR').includes(term))))
      .sort((a, b) => dataset.date ? String(b[dataset.date] ?? '').localeCompare(String(a[dataset.date] ?? '')) || a.id.localeCompare(b.id) : a.id.localeCompare(b.id));
  }, [inPeriod, search, status, dataset]);
  const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  function exportRows() {
    const columns = [...dataset.columns, { key: 'source_file', label: 'Arquivo de origem' }];
    const quote = (value: unknown) => {
      const text = String(value ?? '');
      const safe = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [columns.map(c => quote(c.label)).join(';'), ...filtered.map(r => columns.map(c => quote(r[c.key])).join(';'))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `srta-lolli-${dataset.key}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-display font-semibold">Srta Lolli</h1><p className="mt-1 text-sm text-muted-foreground">Histórico importado · 26/11/2026</p></div>
      <Button variant="outline" size="icon" aria-label="Atualizar dados da Lolli" title="Atualizar" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={isFetching ? 'animate-spin' : ''} /></Button>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ['Itens de venda', counts.sales, ShoppingBag], ['Despesas', counts.expenses, Receipt],
        ['Produtos', counts.products, Package], ['Movimentos bancários', 599, Landmark],
      ].map(([label, count, Icon]) => {
        const StatIcon = Icon as typeof Package;
        return <div key={String(label)} className="rounded-md border border-border bg-card p-4"><StatIcon className="mb-3 h-4 w-4 text-primary" /><p className="text-xl font-semibold tabular-nums">{Number(count ?? 0).toLocaleString('pt-BR')}</p><p className="mt-1 text-xs text-muted-foreground">{String(label)}</p></div>;
      })}
    </div>
    <section aria-label="Dados da Srta Lolli" className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={datasetKey} onValueChange={value => { setDatasetKey(value); setStatus('all'); setSearch(''); setPage(0); }}>
          <SelectTrigger aria-label="Relatório da Lolli" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{lolliDatasets.map(d => <SelectItem value={d.key} key={d.key}>{d.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-40"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar nos registros da Lolli" placeholder="Buscar" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
        {statuses.length > 0 && <Select value={status} onValueChange={value => { setStatus(value); setPage(0); }}><SelectTrigger className="w-full sm:w-44" aria-label="Situação dos registros"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
        <Button variant="outline" size="icon" aria-label="Baixar registros filtrados da Lolli" title="Baixar CSV" disabled={!filtered.length} onClick={exportRows}><Download /></Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{dataset.label}</h2><span className="text-xs text-muted-foreground">{filtered.length.toLocaleString('pt-BR')} registros{dataset.date && months.length ? ` · ${months.map(m => m.split('-').reverse().join('/')).join(', ')}` : ''}</span></div>
      {error ? <div role="alert" className="border border-destructive rounded-md p-4"><p>Não foi possível carregar os registros.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div> :
        isLoading ? <div className="py-12 text-center text-muted-foreground">Carregando registros…</div> :
        !filtered.length ? <div className="py-12 text-center text-muted-foreground">Nenhum registro neste período.</div> :
        <div className="overflow-x-auto border-y border-border"><table className="w-full text-sm"><thead className="bg-muted"><tr>{dataset.columns.map(c => <th key={c.key} className={`px-3 py-3 whitespace-nowrap font-medium ${c.money ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.id} className="border-t border-border hover:bg-muted/40">{dataset.columns.map(c => <td key={c.key} className={`px-3 py-3 ${c.money ? 'text-right tabular-nums whitespace-nowrap' : 'text-left'}`}><span className="block min-w-24 max-w-80 break-words">{cell(r[c.key], c)}</span></td>)}</tr>)}</tbody></table></div>}
      <div className="flex justify-end items-center gap-2"><span className="text-xs text-muted-foreground">Página {currentPage + 1} de {maxPage + 1}</span><Button variant="outline" size="icon" aria-label="Página anterior de registros" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Próxima página de registros" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></div>
    </section>
  </div>;
}