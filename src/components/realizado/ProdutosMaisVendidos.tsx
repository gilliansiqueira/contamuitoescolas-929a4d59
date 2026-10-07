import { useMemo, useState } from 'react';
import { ClipboardPaste, LineChart as LineChartIcon, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProductSales, useProductSalesMonths, useReplaceProductSalesMonth, ProductSaleInput } from '@/hooks/useProductSales';
import { parseBRNumber } from '@/lib/bankStatements/parsers';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v: number) => v.toLocaleString('pt-BR');
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[Number(mm) - 1]}/${y}`;
};
const prevMonth = (m: string) => {
  let [y, mm] = m.split('-').map(Number);
  mm -= 1;
  if (mm === 0) { mm = 12; y -= 1; }
  return `${y}-${String(mm).padStart(2, '0')}`;
};

interface AggRow { produto: string; valor: number; quantidade: number; }

function aggregate(rows: { produto: string; valor: number; quantidade: number }[]): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const r of rows) {
    const cur = map.get(r.produto) ?? { produto: r.produto, valor: 0, quantidade: 0 };
    cur.valor += Number(r.valor);
    cur.quantidade += Number(r.quantidade);
    map.set(r.produto, cur);
  }
  return [...map.values()];
}

function RankingTable({ title, rows, mode }: { title: string; rows: AggRow[]; mode: 'valor' | 'quantidade' }) {
  const sorted = [...rows].sort((a, b) => (mode === 'valor' ? b.valor - a.valor : b.quantidade - a.quantidade));
  const total = sorted.reduce((s, r) => s + (mode === 'valor' ? r.valor : r.quantidade), 0);
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h4 className="text-sm font-semibold mb-3">{title}</h4>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados neste mês.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right w-16">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => (
              <TableRow key={r.produto}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.produto}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.valor)}</TableCell>
                <TableCell className="text-right">{fmtQtd(r.quantidade)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {total > 0 ? `${(((mode === 'valor' ? r.valor : r.quantidade) / total) * 100).toFixed(1)}%` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function parsePasted(text: string): ProductSaleInput[] {
  const out: ProductSaleInput[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\t|;|,(?=\s*[\dR$])/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const produto = parts[0];
    const valor = parseBRNumber(parts[1]);
    const quantidade = parts.length >= 3 ? parseBRNumber(parts[2]) : 0;
    if (!produto || Number.isNaN(valor)) continue;
    out.push({ produto, valor, quantidade: Number.isNaN(quantidade) ? 0 : quantidade });
  }
  return out;
}

export function ProdutosMaisVendidos({ schoolId }: { schoolId: string }) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: months } = useProductSalesMonths(schoolId);
  const replaceMonth = useReplaceProductSalesMonth(schoolId);

  const [monthFrom, setMonthFrom] = useState<string>('');
  const [monthTo, setMonthTo] = useState<string>('');
  const [produtoFilter, setProdutoFilter] = useState<string>('todos');
  const [showPaste, setShowPaste] = useState(false);
  const [pasteMonth, setPasteMonth] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ProductSaleInput[] | null>(null);

  const effectiveFrom = monthFrom || (months?.[0] ?? '');
  const effectiveTo = monthTo || (months?.[months.length - 1] ?? '');
  const { data: rows, isLoading } = useProductSales(schoolId, effectiveFrom || undefined, effectiveTo || undefined);

  const produtos = useMemo(() => [...new Set((rows ?? []).map(r => r.produto))].sort(), [rows]);

  const filtered = useMemo(
    () => (rows ?? []).filter(r => produtoFilter === 'todos' || r.produto === produtoFilter),
    [rows, produtoFilter],
  );

  // Comparação: mês final do filtro vs mês anterior a ele
  const compareMonth = effectiveTo;
  const comparePrev = compareMonth ? prevMonth(compareMonth) : '';
  const curRows = useMemo(() => aggregate(filtered.filter(r => r.month === compareMonth)), [filtered, compareMonth]);
  const prevRows = useMemo(() => aggregate(filtered.filter(r => r.month === comparePrev)), [filtered, comparePrev]);

  // Gráfico de linha: evolução mês a mês (valor e quantidade)
  const chartData = useMemo(() => {
    const byMonth = new Map<string, { month: string; valor: number; quantidade: number }>();
    for (const r of filtered) {
      const cur = byMonth.get(r.month) ?? { month: r.month, valor: 0, quantidade: 0 };
      cur.valor += Number(r.valor);
      cur.quantidade += Number(r.quantidade);
      byMonth.set(r.month, cur);
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const handleParse = () => {
    const items = parsePasted(pasteText);
    if (items.length === 0) {
      toast({ title: 'Nada para importar', description: 'Cole linhas no formato: Produto | Valor | Quantidade', variant: 'destructive' });
      return;
    }
    setParsed(items);
  };

  const handleConfirm = async () => {
    if (!parsed || !pasteMonth) return;
    try {
      await replaceMonth.mutateAsync({ month: pasteMonth, items: parsed });
      toast({ title: 'Produtos salvos', description: `${parsed.length} produtos gravados em ${monthLabel(pasteMonth)}.` });
      setShowPaste(false);
      setPasteText('');
      setParsed(null);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  const parsedTotalValor = parsed?.reduce((s, i) => s + i.valor, 0) ?? 0;
  const parsedTotalQtd = parsed?.reduce((s, i) => s + i.quantidade, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-display font-bold">Produtos mais vendidos</h3>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowPaste(true)} className="rounded-xl">
            <ClipboardPaste className="w-4 h-4 mr-1" /> Colar vendas do mês
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground">De</label>
          <Select value={effectiveFrom} onValueChange={setMonthFrom}>
            <SelectTrigger className="w-32 rounded-xl"><SelectValue placeholder="Início" /></SelectTrigger>
            <SelectContent>
              {(months ?? []).map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Até</label>
          <Select value={effectiveTo} onValueChange={setMonthTo}>
            <SelectTrigger className="w-32 rounded-xl"><SelectValue placeholder="Fim" /></SelectTrigger>
            <SelectContent>
              {(months ?? []).map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Produto</label>
          <Select value={produtoFilter} onValueChange={setProdutoFilter}>
            <SelectTrigger className="w-56 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {produtos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (rows ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum dado de produtos ainda. {isAdmin ? 'Use "Colar vendas do mês" para começar.' : 'Aguarde a equipe lançar os dados.'}
        </div>
      ) : (
        <>
          {/* Comparação mês atual vs anterior */}
          {compareMonth && (
            <div>
              <h4 className="text-sm font-semibold mb-2">
                {monthLabel(compareMonth)} vs {monthLabel(comparePrev)}
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <RankingTable title={`Por valor — ${monthLabel(compareMonth)}`} rows={curRows} mode="valor" />
                <RankingTable title={`Por valor — ${monthLabel(comparePrev)}`} rows={prevRows} mode="valor" />
                <RankingTable title={`Por quantidade — ${monthLabel(compareMonth)}`} rows={curRows} mode="quantidade" />
                <RankingTable title={`Por quantidade — ${monthLabel(comparePrev)}`} rows={prevRows} mode="quantidade" />
              </div>
            </div>
          )}

          {/* Evolução */}
          {chartData.length > 1 && (
            <div className="rounded-2xl border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <LineChartIcon className="w-4 h-4" />
                Evolução {produtoFilter !== 'todos' ? `— ${produtoFilter}` : '(todos os produtos)'}
              </h4>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tickFormatter={monthLabel} className="text-xs" />
                    <YAxis yAxisId="valor" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <YAxis yAxisId="qtd" orientation="right" className="text-xs" />
                    <Tooltip
                      labelFormatter={l => monthLabel(String(l))}
                      formatter={(v: any, name: any) => (name === 'Valor' ? fmtBRL(Number(v)) : fmtQtd(Number(v)))}
                    />
                    <Legend />
                    <Line yAxisId="valor" type="monotone" dataKey="valor" name="Valor" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                    <Line yAxisId="qtd" type="monotone" dataKey="quantidade" name="Quantidade" stroke="hsl(var(--accent-foreground))" strokeWidth={2} strokeDasharray="5 5" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* Colar vendas */}
      <Dialog open={showPaste} onOpenChange={setShowPaste}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Colar vendas do mês</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Mês de referência</label>
              <Input
                type="month"
                value={pasteMonth}
                onChange={e => { setPasteMonth(e.target.value); setParsed(null); }}
                className="w-44 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Cole as linhas no formato: Produto [tab] Valor [tab] Quantidade
              </label>
              <textarea
                className="w-full h-44 rounded-xl border bg-background p-3 text-sm font-mono"
                placeholder={'Tiranossauro\t22.841,70\t603\nTriceratops\t6.695,80\t189'}
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setParsed(null); }}
              />
            </div>
            {!parsed ? (
              <Button onClick={handleParse} disabled={!pasteMonth || !pasteText.trim()} className="rounded-xl">
                Conferir leitura
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                  <p><strong>{parsed.length}</strong> produtos lidos</p>
                  <p>Total em valor: <strong>{fmtBRL(parsedTotalValor)}</strong></p>
                  <p>Total em quantidade: <strong>{fmtQtd(parsedTotalQtd)}</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao confirmar, os dados de {monthLabel(pasteMonth)} são substituídos (nunca duplicados).
                  </p>
                </div>
                <div className="max-h-48 overflow-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>{p.produto}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                          <TableCell className="text-right">{fmtQtd(p.quantidade)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setParsed(null)} className="rounded-xl">Voltar</Button>
                  <Button onClick={handleConfirm} disabled={replaceMonth.isPending} className="rounded-xl">
                    {replaceMonth.isPending ? 'Salvando…' : 'Confirmar e gravar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
