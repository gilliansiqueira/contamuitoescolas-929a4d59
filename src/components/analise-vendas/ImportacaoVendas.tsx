import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useSAChannels, useSAPaymentMethods, useSAProducts } from './useAnaliseVendasData';

interface Props { schoolId: string; }

const FIELDS = [
  { key: 'data', label: 'Data', required: true, aliases: ['data', 'date', 'data do pedido', 'order date'] },
  { key: 'produto', label: 'Produto', required: true, aliases: ['produto', 'item', 'product', 'descricao'] },
  { key: 'quantidade', label: 'Quantidade', required: false, aliases: ['quantidade', 'qtd', 'qty', 'quantity'] },
  { key: 'valor_unit', label: 'Valor unitário', required: false, aliases: ['valor unitario', 'valor unit', 'preco', 'price', 'unit price'] },
  { key: 'valor_total', label: 'Valor total', required: false, aliases: ['valor total', 'total', 'valor', 'gross', 'amount'] },
  { key: 'custo_unit', label: 'Custo unitário', required: false, aliases: ['custo unitario', 'custo', 'cost', 'unit cost'] },
  { key: 'taxas', label: 'Taxas', required: false, aliases: ['taxas', 'taxa', 'fees', 'fee'] },
  { key: 'frete', label: 'Frete', required: false, aliases: ['frete', 'shipping'] },
  { key: 'canal', label: 'Canal', required: false, aliases: ['canal', 'channel', 'origem'] },
  { key: 'forma', label: 'Forma de pagamento', required: false, aliases: ['forma', 'forma pagamento', 'pagamento', 'payment'] },
  { key: 'cliente', label: 'Cliente', required: false, aliases: ['cliente', 'customer', 'nome'] },
  { key: 'status', label: 'Status', required: false, aliases: ['status', 'situacao'] },
] as const;

type FieldKey = typeof FIELDS[number]['key'];

function normalize(s: string) {
  return s.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function suggestColumn(field: typeof FIELDS[number], cols: string[]): string {
  const norm = cols.map(c => ({ orig: c, n: normalize(c) }));
  for (const a of field.aliases) {
    const found = norm.find(c => c.n === normalize(a));
    if (found) return found.orig;
  }
  for (const a of field.aliases) {
    const found = norm.find(c => c.n.includes(normalize(a)));
    if (found) return found.orig;
  }
  return '';
}

function parseDate(raw: any): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = raw.toString().trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    const yy = y.length === 2 ? '20' + y : y;
    return `${yy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Excel serial
  const num = Number(s);
  if (!isNaN(num) && num > 25000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseNum(raw: any): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const s = raw.toString().trim().replace(/R\$/g, '').replace(/\s/g, '');
  // Brazilian: "1.234,56" or "1234,56"
  if (s.includes(',')) {
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseStatus(raw: any): 'concluido' | 'cancelado' | 'pendente' {
  if (!raw) return 'concluido';
  const s = normalize(raw.toString());
  if (s.includes('cancel')) return 'cancelado';
  if (s.includes('pend') || s.includes('aberto')) return 'pendente';
  return 'concluido';
}

interface ParsedRow {
  data: string;
  produto: string;
  quantidade: number;
  valor_unit: number;
  valor_total: number;
  custo_unit: number;
  taxas: number;
  frete: number;
  canal: string;
  forma: string;
  cliente: string;
  status: 'concluido' | 'cancelado' | 'pendente';
  _errors: string[];
}

export function ImportacaoVendas({ schoolId }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: products = [] } = useSAProducts(schoolId);
  const { data: channels = [] } = useSAChannels(schoolId);
  const { data: methods = [] } = useSAPaymentMethods(schoolId);

  const [step, setStep] = useState<'idle' | 'mapping' | 'preview'>('idle');
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);

  function reset() {
    setStep('idle');
    setFileName('');
    setRawRows([]);
    setColumns([]);
    setMapping({} as Record<FieldKey, string>);
    setParsed([]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (rows.length === 0) {
        toast.error('Planilha vazia.');
        return;
      }
      const cols = Object.keys(rows[0]);
      const initial = {} as Record<FieldKey, string>;
      FIELDS.forEach(f => { initial[f.key] = suggestColumn(f, cols); });
      setRawRows(rows);
      setColumns(cols);
      setMapping(initial);
      setStep('mapping');
    } catch (err: any) {
      toast.error('Erro ao ler arquivo: ' + (err.message || ''));
    }
  }

  function processMapping() {
    if (!mapping.data || !mapping.produto) {
      toast.error('Mapeie ao menos Data e Produto.');
      return;
    }
    const out: ParsedRow[] = rawRows.map(row => {
      const errors: string[] = [];
      const data = parseDate(row[mapping.data]);
      if (!data) errors.push('Data inválida');
      const produto = (row[mapping.produto] || '').toString().trim();
      if (!produto) errors.push('Produto vazio');
      const qtd = mapping.quantidade ? parseNum(row[mapping.quantidade]) : 1;
      const vUnit = mapping.valor_unit ? parseNum(row[mapping.valor_unit]) : 0;
      const vTotal = mapping.valor_total ? parseNum(row[mapping.valor_total]) : (vUnit * qtd);
      const cUnit = mapping.custo_unit ? parseNum(row[mapping.custo_unit]) : 0;
      const taxas = mapping.taxas ? parseNum(row[mapping.taxas]) : 0;
      const frete = mapping.frete ? parseNum(row[mapping.frete]) : 0;
      return {
        data: data || '',
        produto,
        quantidade: qtd || 1,
        valor_unit: vUnit || (qtd > 0 ? vTotal / qtd : 0),
        valor_total: vTotal,
        custo_unit: cUnit,
        taxas,
        frete,
        canal: mapping.canal ? (row[mapping.canal] || '').toString().trim() : '',
        forma: mapping.forma ? (row[mapping.forma] || '').toString().trim() : '',
        cliente: mapping.cliente ? (row[mapping.cliente] || '').toString().trim() : '',
        status: mapping.status ? parseStatus(row[mapping.status]) : 'concluido',
        _errors: errors,
      };
    });
    setParsed(out);
    setStep('preview');
  }

  async function ensureLookup<T extends { id: string; name: string }>(
    list: T[],
    name: string,
    table: 'sales_analysis_channels' | 'sales_analysis_payment_methods' | 'sales_analysis_products',
    extra: Record<string, any> = {},
  ): Promise<string | null> {
    if (!name) return null;
    const existing = list.find(x => normalize(x.name) === normalize(name));
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from(table)
      .insert({ school_id: schoolId, name, ...extra })
      .select('id, name')
      .single();
    if (error || !data) return null;
    list.push(data as T);
    return data.id;
  }

  async function confirmImport() {
    const valid = parsed.filter(r => r._errors.length === 0);
    if (valid.length === 0) {
      toast.error('Nenhuma linha válida.');
      return;
    }
    setImporting(true);
    try {
      const productList = [...products];
      const channelList = [...channels];
      const methodList = [...methods];
      let ok = 0;
      let fail = 0;

      for (const row of valid) {
        try {
          const channelId = await ensureLookup(channelList, row.canal, 'sales_analysis_channels');
          const methodId = await ensureLookup(methodList, row.forma, 'sales_analysis_payment_methods');
          const productId = await ensureLookup(
            productList,
            row.produto,
            'sales_analysis_products',
            { default_cost: row.custo_unit },
          );

          const grossValue = row.valor_total;
          const costTotal = row.custo_unit * row.quantidade;

          const { data: order, error: orderErr } = await supabase
            .from('sales_analysis_orders')
            .insert({
              school_id: schoolId,
              order_date: row.data,
              customer_name: row.cliente,
              channel_id: channelId,
              payment_method_id: methodId,
              status: row.status,
              gross_value: grossValue,
              cost_total: costTotal,
              fees: row.taxas,
              shipping: row.frete,
              shipping_paid_by_customer: row.frete === 0,
            })
            .select('id')
            .single();
          if (orderErr || !order) throw orderErr;

          const { error: itemErr } = await supabase.from('sales_analysis_order_items').insert({
            order_id: order.id,
            product_id: productId,
            product_name: row.produto,
            quantity: row.quantidade,
            unit_price: row.valor_unit,
            unit_cost: row.custo_unit,
          });
          if (itemErr) throw itemErr;
          ok++;
        } catch {
          fail++;
        }
      }

      qc.invalidateQueries({ queryKey: ['sa_orders', schoolId] });
      qc.invalidateQueries({ queryKey: ['sa_order_items', schoolId] });
      qc.invalidateQueries({ queryKey: ['sa_products', schoolId] });
      qc.invalidateQueries({ queryKey: ['sa_channels', schoolId] });
      qc.invalidateQueries({ queryKey: ['sa_payment_methods', schoolId] });

      if (ok > 0) toast.success(`${ok} pedidos importados${fail > 0 ? ` (${fail} falharam)` : ''}.`);
      else toast.error('Falha ao importar pedidos.');
      reset();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || ''));
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Data', 'Produto', 'Quantidade', 'Valor unitário', 'Valor total', 'Custo unitário', 'Taxas', 'Frete', 'Canal', 'Forma de pagamento', 'Cliente', 'Status'],
      ['01/01/2025', 'Camiseta', 2, 50, 100, 20, 5, 0, 'Instagram', 'PIX', 'Maria', 'concluido'],
      ['02/01/2025', 'Caneca', 1, 35, 35, 12, 0, 8, 'Site', 'Cartão', 'João', 'concluido'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    XLSX.writeFile(wb, 'modelo-importacao-vendas.xlsx');
  }

  const validCount = parsed.filter(r => r._errors.length === 0).length;
  const errorCount = parsed.length - validCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" /> Importação de pedidos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Envie uma planilha (.xlsx ou .csv) com seus pedidos. Produtos, canais e formas serão criados automaticamente se não existirem.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'idle' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Escolher planilha
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-1" /> Baixar modelo
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </div>
            <p className="text-xs text-muted-foreground">
              Colunas mínimas: <strong>Data</strong> e <strong>Produto</strong>. Outras colunas (quantidade, valores, custo, taxas, frete, canal, forma, cliente, status) são opcionais.
            </p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <strong>{fileName}</strong> — {rawRows.length} linhas detectadas
              </p>
              <Button size="sm" variant="ghost" onClick={reset}>Trocar arquivo</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <Label className="text-xs">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapping[f.key] || '__none__'}
                    onValueChange={v => setMapping({ ...mapping, [f.key]: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="(ignorar)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(ignorar)</SelectItem>
                      {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={processMapping}>Pré-visualizar</Button>
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> {validCount} válidos
              </span>
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive" /> {errorCount} com erro
                </span>
              )}
            </div>
            <div className="border rounded-lg max-h-96 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Produto</th>
                    <th className="text-right p-2">Qtd</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Custo</th>
                    <th className="text-left p-2">Canal</th>
                    <th className="text-left p-2">Forma</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 100).map((r, i) => (
                    <tr key={i} className={`border-t ${r._errors.length ? 'bg-destructive/10' : ''}`}>
                      <td className="p-2">{r.data || '—'}</td>
                      <td className="p-2">{r.produto || '—'}</td>
                      <td className="p-2 text-right">{r.quantidade}</td>
                      <td className="p-2 text-right">{r.valor_total.toFixed(2)}</td>
                      <td className="p-2 text-right">{(r.custo_unit * r.quantidade).toFixed(2)}</td>
                      <td className="p-2">{r.canal || '—'}</td>
                      <td className="p-2">{r.forma || '—'}</td>
                      <td className="p-2">{r.status}{r._errors.length > 0 && <span className="text-destructive ml-1">⚠ {r._errors.join(', ')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 100 && (
                <p className="text-center text-xs text-muted-foreground py-2">+ {parsed.length - 100} linhas...</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmImport} disabled={importing || validCount === 0}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Importar {validCount} pedidos
              </Button>
              <Button variant="ghost" onClick={() => setStep('mapping')}>Voltar ao mapeamento</Button>
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
