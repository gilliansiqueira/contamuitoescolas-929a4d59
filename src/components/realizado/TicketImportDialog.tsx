import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import type { ExpenseDetailTripImport } from '@/hooks/useExpenseDetailTrips';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ExpenseDetailTripImport[]) => Promise<void>;
}

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function parseDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value);
    if (!parts) return '';
    return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return '';
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value;
  let text = String(value ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function findColumn(headers: unknown[], aliases: string[]) {
  return headers.findIndex(header => aliases.some(alias => normalize(header) === alias));
}

function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const preferred = workbook.SheetNames.find(name => normalize(name).includes('base passeio'));
  const sheet = workbook.Sheets[preferred || workbook.SheetNames[0]];
  if (!sheet) throw new Error('Não foi possível encontrar uma aba com os passeios.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headerIndex = matrix.findIndex(row => {
    const values = row.map(normalize);
    return values.some(value => value === 'data') && values.some(value => value.includes('centro')) && values.includes('pagantes');
  });
  if (headerIndex < 0) throw new Error('Não encontrei as colunas Data, Centro e Pagantes.');

  const headers = matrix[headerIndex];
  const dateIndex = findColumn(headers, ['data']);
  const groupIndex = findColumn(headers, ['centro preliminar', 'centro de custo', 'centro']);
  const activityIndex = findColumn(headers, ['atividade', 'passeio', 'descricao']);
  const peopleIndex = findColumn(headers, ['pagantes', 'pessoas']);
  const revenueIndex = findColumn(headers, ['receita', 'valor']);
  if ([dateIndex, groupIndex, peopleIndex, revenueIndex].some(index => index < 0)) {
    throw new Error('A planilha precisa ter Data, Centro de custo, Pagantes e Receita.');
  }

  const warnings: string[] = [];
  const rows: ExpenseDetailTripImport[] = [];
  matrix.slice(headerIndex + 1).forEach((row, offset) => {
    const tripDate = parseDate(row[dateIndex]);
    const groupName = String(row[groupIndex] ?? '').trim();
    const activity = activityIndex >= 0 ? String(row[activityIndex] ?? '').trim() : '';
    const payingPeople = Math.max(0, Math.round(parseNumber(row[peopleIndex])));
    const revenue = Math.max(0, parseNumber(row[revenueIndex]));
    if (!tripDate && !groupName && !activity) return;
    if (!tripDate || !groupName) {
      warnings.push(`Linha ${headerIndex + offset + 2} ignorada por falta de data ou centro.`);
      return;
    }
    const sourceRowKey = [tripDate, normalize(groupName), normalize(activity), payingPeople, revenue.toFixed(2)].join('|');
    rows.push({ groupName, tripDate, activity: activity || 'Passeio sem nome', payingPeople, revenue, sourceRowKey });
  });
  return { rows, warnings };
}

function currency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function TicketImportDialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ExpenseDetailTripImport[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFileName('');
    setRows([]);
    setWarnings([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const totals = rows.reduce((sum, row) => ({
    people: sum.people + row.payingPeople,
    revenue: sum.revenue + row.revenue,
  }), { people: 0, revenue: 0 });
  const dates = rows.map(row => row.tripDate).sort();
  const groups = new Set(rows.map(row => row.groupName));

  return (
    <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar público e ticket</DialogTitle>
          <DialogDescription>Selecione uma planilha com a base de passeios. Os dados do mesmo período serão substituídos para não duplicar.</DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const parsed = parseWorkbook(await file.arrayBuffer());
              if (!parsed.rows.length) throw new Error('Nenhum passeio válido foi encontrado.');
              setFileName(file.name);
              setRows(parsed.rows);
              setWarnings(parsed.warnings);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
              reset();
            }
          }}
        />

        {!rows.length ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 text-center transition-colors hover:bg-muted/40">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            <div><p className="font-semibold">Escolher planilha Excel</p><p className="text-sm text-muted-foreground">A aba “Base passeios” será reconhecida automaticamente.</p></div>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {fileName}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PreviewMetric label="Passeios" value={rows.length.toLocaleString('pt-BR')} />
              <PreviewMetric label="Centros" value={groups.size.toLocaleString('pt-BR')} />
              <PreviewMetric label="Pagantes" value={totals.people.toLocaleString('pt-BR')} />
              <PreviewMetric label="Receita" value={currency(totals.revenue)} />
            </div>
            <p className="text-xs text-muted-foreground">Período encontrado: {dates[0]?.split('-').reverse().join('/')} a {dates[dates.length - 1]?.split('-').reverse().join('/')}</p>
            {warnings.length > 0 && <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0 text-destructive" /><span>{warnings.length} linha(s) ignorada(s). {warnings[0]}</span></div>}
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Centro</TableHead><TableHead>Atividade</TableHead><TableHead className="text-right">Pessoas</TableHead><TableHead className="text-right">Receita</TableHead></TableRow></TableHeader>
              <TableBody>{rows.slice(0, 8).map((row, index) => <TableRow key={`${row.sourceRowKey}-${index}`}><TableCell>{row.tripDate.split('-').reverse().join('/')}</TableCell><TableCell>{row.groupName}</TableCell><TableCell className="max-w-56 truncate">{row.activity}</TableCell><TableCell className="text-right">{row.payingPeople}</TableCell><TableCell className="text-right">{currency(row.revenue)}</TableCell></TableRow>)}</TableBody>
            </Table>
            {rows.length > 8 && <p className="text-center text-xs text-muted-foreground">Prévia das 8 primeiras linhas de {rows.length}.</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {rows.length > 0 && <Button disabled={saving} onClick={async () => { setSaving(true); try { await onImport(rows); toast.success(`${rows.length} passeios importados com sucesso`); onOpenChange(false); reset(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao importar os passeios.'); } finally { setSaving(false); } }}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Importar e substituir período</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{value}</p></div>;
}