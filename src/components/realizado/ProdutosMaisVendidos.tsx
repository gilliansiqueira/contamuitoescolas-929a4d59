import { useMemo, useState } from 'react';
import { ClipboardPaste, LineChart as LineChartIcon, Trophy, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProductSales, useProductSalesMonths, useReplaceProductSalesMonth, useDeleteProductSalesMonth, ProductSaleInput, ProductRanking } from '@/hooks/useProductSales';
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
        <p className="text-sm text-muted-foreground">Lista não enviada neste mês.</p>
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

const NUM_TOKEN = /-?R?\$?\s?[\d.]+,\d{1,2}|-?[\d.]+/g;

function parsePasted(text: string): ProductSaleInput[] {
  const out: ProductSaleInput[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // 1) separa por tab ou ponto-e-vírgula (nunca por vírgula — é decimal BR)
    let parts = line.split(/\t|;/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      // 2) fallback: números no fim da linha (valor e, opcional, quantidade)
      const tokens = line.match(NUM_TOKEN) ?? [];
      if (tokens.length < 1) continue;
      const qtdTok = tokens.length >= 2 ? tokens[tokens.length - 1] : null;
      const valorTok = tokens.length >= 2 ? tokens[tokens.length - 2] : tokens[0];
      const produto = line
        .slice(0, qtdTok ? line.lastIndexOf(qtdTok) : line.length)
        .slice(0, line.lastIndexOf(valorTok))
        .trim();
      const valor = parseBRNumber(valorTok);
      const quantidade = qtdTok ? parseBRNumber(qtdTok) : 0;
      if (!produto || Number.isNaN(valor)) continue;
      out.push({ produto, valor, quantidade: Number.isNaN(quantidade) ? 0 : quantidade });
      continue;
    }
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
  const [pasteRanking, setPasteRanking] = useState<ProductRanking>('valor');
  const [showDelete, setShowDelete] = useState(false);
  const [delMonth, setDelMonth] = useState('');
  const [delWhich, setDelWhich] = useState<'valor' | 'quantidade' | 'ambas'>('ambas');
  const [confirmDel, setConfirmDel] = useState(false);
  const deleteMonth = useDeleteProductSalesMonth(schoolId);

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
  const pick = (m: string, rk: ProductRanking) => aggregate(filtered.filter(r => r.month === m && r.ranking === rk));
  const curValor = useMemo(() => pick(compareMonth, 'valor'), [filtered, compareMonth]);
  const prevValor = useMemo(() => pick(comparePrev, 'valor'), [filtered, comparePrev]);
  const curQtd = useMemo(() => pick(compareMonth, 'quantidade'), [filtered, compareMonth]);
  const prevQtd = useMemo(() => pick(comparePrev, 'quantidade'), [filtered, comparePrev]);

  // Gráfico de linha: evolução mês a mês (valor e quantidade)
  const chartData = useMemo(() => {
    const byMonth = new Map<string, { month: string; valor: number; quantidade: number }>();
    for (const r of filtered) {
      const cur = byMonth.get(r.month) ?? { month: r.month, valor: 0, quantidade: 0 };
      if (r.ranking === 'valor') cur.valor += Number(r.valor);
      else cur.quantidade += Number(r.quantidade);
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
      await replaceMonth.mutateAsync({ month: pasteMonth, items: parsed, ranking: pasteRanking });
      toast({ title: 'Produtos salvos', description: `${parsed.length} produtos gravados em ${monthLabel(pasteMonth)} (${pasteRanking === 'valor' ? 'Por valor' : 'Por quantidade'}).` });
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
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setDelMonth(effectiveTo); setShowDelete(true); }} className="rounded-xl" disabled={!(months ?? []).length}>
              <Trash2 className="w-4 h-4 mr-1" /> Apagar mês
            </Button>
            <Button size="sm" onClick={() => setShowPaste(true)} className="rounded-xl">
              <ClipboardPaste className="w-4 h-4 mr-1" /> Colar vendas do mês
            </Button>
          </div>
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
                <RankingTable title={`Por valor — ${monthLabel(compareMonth)}`} rows={curValor} mode="valor" />
                <RankingTable title={`Por valor — ${monthLabel(comparePrev)}`} rows={prevValor} mode="valor" />
                <RankingTable title={`Por quantidade — ${monthLabel(compareMonth)}`} rows={curQtd} mode="quantidade" />
                <RankingTable title={`Por quantidade — ${monthLabel(comparePrev)}`} rows={prevQtd} mode="quantidade" />
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
            <Tabs value={pasteRanking} onValueChange={v => { setPasteRanking(v as ProductRanking); setParsed(null); setPasteText(''); }}>
              <TabsList>
                <TabsTrigger value="valor">Por valor</TabsTrigger>
                <TabsTrigger value="quantidade">Por quantidade</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              Esta lista alimenta só o ranking <strong>{pasteRanking === 'valor' ? 'por valor' : 'por quantidade'}</strong>. A outra lista não é alterada.
            </p>
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
                    Ao confirmar, a lista {pasteRanking === 'valor' ? 'Por valor' : 'Por quantidade'} de {monthLabel(pasteMonth)} é substituída (nunca duplicada).
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

      {/* Apagar mês */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apagar dados do mês</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Mês</label>
              <Select value={delMonth} onValueChange={setDelMonth}>
                <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {(months ?? []).map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">O que apagar</label>
              <Select value={delWhich} onValueChange={v => setDelWhich(v as any)}>
                <SelectTrigger className="w-56 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambas">As duas listas</SelectItem>
                  <SelectItem value="valor">Só Por valor</SelectItem>
                  <SelectItem value="quantidade">Só Por quantidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDelete(false)} className="rounded-xl">Cancelar</Button>
              <Button variant="destructive" disabled={!delMonth} onClick={() => setConfirmDel(true)} className="rounded-xl">Apagar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              {delMonth && `${delWhich === 'ambas' ? 'As duas listas' : delWhich === 'valor' ? 'A lista Por valor' : 'A lista Por quantidade'} de ${monthLabel(delMonth)} serão apagadas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMonth.isPending}
              onClick={async () => {
                try {
                  const rankings: ProductRanking[] = delWhich === 'ambas' ? ['valor', 'quantidade'] : [delWhich];
                  await deleteMonth.mutateAsync({ month: delMonth, rankings });
                  toast({ title: 'Dados apagados', description: `${monthLabel(delMonth)} atualizado.` });
                  setShowDelete(false);
                } catch (e: any) {
                  toast({ title: 'Erro ao apagar', description: e.message, variant: 'destructive' });
                }
              }}
            >Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
