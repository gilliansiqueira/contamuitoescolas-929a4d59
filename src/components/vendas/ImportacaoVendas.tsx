import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { SalesPaymentMethod, SalesCardBrand, SalesData } from './vendas-types';

interface Props {
  schoolId: string;
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview';

const STORAGE_KEY = 'vendas_import_mapping';

const FIELDS = [
  { key: 'month', label: 'Mês (YYYY-MM ou DD/MM/YYYY)', required: true, aliases: ['mes', 'mês', 'month', 'data', 'periodo', 'período', 'competencia', 'competência'] },
  { key: 'method', label: 'Forma de Pagamento', required: true, aliases: ['forma', 'forma de pagamento', 'metodo', 'método', 'method', 'pagamento', 'tipo'] },
  { key: 'brand', label: 'Bandeira (opcional)', required: false, aliases: ['bandeira', 'brand', 'bandeira_cartao', 'card_brand'] },
  { key: 'value', label: 'Valor', required: true, aliases: ['valor', 'value', 'total', 'vlr', 'montante', 'amount'] },
] as const;

function normalizeStr(s: string) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseMonth(raw: any): string | null {
  if (raw == null || raw === '') return null;
  let s = String(raw).trim();
  if (/^\d{5,6}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  if (/^\d{2}\/\d{4}$/.test(s)) { const [m, y] = s.split('/'); return `${y}-${m.padStart(2, '0')}`; }
  const parts = s.split(/[\/\-\.]/);
  if (parts.length >= 2) {
    if (parts[0]?.length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    if (parts[parts.length - 1]?.length === 4) {
      const y = parts[parts.length - 1];
      const m = parts[parts.length - 2];
      return `${y}-${m.padStart(2, '0')}`;
    }
  }
  return null;
}

function parseValue(raw: any): number | null {
  if (typeof raw === 'number') return raw;
  if (!raw) return null;
  const s = String(raw).replace(/[R$\s]/g, '').trim();
  if (!s) return null;
  let c = s;
  if (/\d\.\d{3}/.test(s) && s.includes(',')) c = s.replace(/\./g, '').replace(',', '.');
  else c = s.replace(',', '.');
  c = c.replace(/[^\d.\-]/g, '');
  const n = parseFloat(c);
  return isNaN(n) ? null : n;
}

function suggestColumn(aliases: readonly string[], columns: string[]): string | undefined {
  const norm = columns.map(c => ({ orig: c, norm: normalizeStr(c) }));
  for (const a of aliases) { const m = norm.find(n => n.norm === a); if (m) return m.orig; }
  for (const a of aliases) { const m = norm.find(n => n.norm.includes(a) || a.includes(n.norm)); if (m) return m.orig; }
  return undefined;
}

export function ImportacaoVendas({ schoolId, open, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const { data: methods = [] } = useQuery({
    queryKey: ['sales_payment_methods', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('sales_payment_methods').select('*').eq('school_id', schoolId);
      return (data || []) as SalesPaymentMethod[];
    },
    enabled: open,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['sales_card_brands'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_card_brands').select('*');
      return (data || []) as SalesCardBrand[];
    },
    enabled: open,
  });

  const resetAll = () => {
    setStep('upload'); setRows([]); setColumns([]); setMapping({}); setImporting(false);
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (json.length === 0) { toast.error('Planilha vazia.'); return; }
        const cols = Object.keys(json[0]);
        setColumns(cols); setRows(json);
        // Load saved mapping
        let saved: Record<string, string> = {};
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}
        const m: Record<string, string> = {};
        for (const f of FIELDS) {
          if (saved[f.key] && cols.includes(saved[f.key])) m[f.key] = saved[f.key];
          else {
            const sug = suggestColumn(f.aliases, cols);
            if (sug) m[f.key] = sug;
          }
        }
        setMapping(m);
        setStep('mapping');
      } catch (err: any) {
        toast.error(`Erro ao ler planilha: ${err?.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const methodMap = useMemo(() => {
    const map: Record<string, SalesPaymentMethod> = {};
    methods.forEach(m => {
      map[normalizeStr(m.label || m.method_key)] = m;
      map[normalizeStr(m.method_key)] = m;
    });
    return map;
  }, [methods]);

  const brandMap = useMemo(() => {
    const map: Record<string, SalesCardBrand> = {};
    brands.forEach(b => { map[normalizeStr(b.name)] = b; });
    return map;
  }, [brands]);

  const processed = useMemo(() => {
    if (step !== 'preview' && step !== 'mapping') return [];
    return rows.map((r, idx) => {
      const month = parseMonth(r[mapping.month]);
      const value = parseValue(r[mapping.value]);
      const methodRaw = normalizeStr(r[mapping.method]);
      const brandRaw = mapping.brand ? normalizeStr(r[mapping.brand]) : '';
      const method = methodMap[methodRaw];
      const brand = brandRaw ? brandMap[brandRaw] : null;
      const errors: string[] = [];
      if (!month) errors.push('Mês inválido');
      if (value == null) errors.push('Valor inválido');
      if (!method) errors.push(`Forma "${r[mapping.method]}" não cadastrada`);
      return {
        idx, month, value, method, brand,
        rawMethod: r[mapping.method], rawBrand: brandRaw, errors,
      };
    });
  }, [rows, mapping, methodMap, brandMap, step]);

  const validRows = processed.filter(p => p.errors.length === 0);
  const invalidRows = processed.filter(p => p.errors.length > 0);

  const doImport = async () => {
    if (validRows.length === 0) { toast.error('Nada para importar.'); return; }
    setImporting(true);
    try {
      // Fetch existing to upsert correctly (composite key: school+month+method+brand)
      const { data: existing } = await supabase.from('sales_data').select('*').eq('school_id', schoolId);
      const exMap = new Map<string, SalesData>();
      (existing || []).forEach((e: any) => {
        exMap.set(`${e.month}|${e.method_key}|${e.brand_id || ''}`, e);
      });

      const updates: { id: string; value: number }[] = [];
      const inserts: any[] = [];
      for (const p of validRows) {
        const key = `${p.month}|${p.method!.method_key}|${p.brand?.id || ''}`;
        const ex = exMap.get(key);
        if (ex) updates.push({ id: ex.id, value: p.value! });
        else inserts.push({
          school_id: schoolId, month: p.month!, method_key: p.method!.method_key,
          brand_id: p.brand?.id || null, value: p.value!,
        });
      }

      for (const u of updates) {
        await supabase.from('sales_data').update({ value: u.value }).eq('id', u.id);
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('sales_data').insert(inserts);
        if (error) throw error;
      }

      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping)); } catch {}
      qc.invalidateQueries({ queryKey: ['sales_data', schoolId] });
      toast.success(`${validRows.length} registro(s) importado(s)${invalidRows.length ? ` · ${invalidRows.length} ignorado(s)` : ''}.`);
      resetAll();
      onClose();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || 'desconhecido'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetAll(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Histórico de Vendas
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Envie uma planilha XLSX ou CSV</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Colunas esperadas: Mês, Forma de Pagamento, Bandeira (opcional), Valor
                </p>
                <input
                  type="file" accept=".xlsx,.xls,.csv" id="vendas-import-file"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <Button asChild>
                  <label htmlFor="vendas-import-file" className="cursor-pointer">Selecionar arquivo</label>
                </Button>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <strong>Dica:</strong> a forma de pagamento deve corresponder às cadastradas em Configurar → Vendas
                (ex: Pix, Boleto, Cartão de Crédito). A bandeira é opcional e usada para Crédito/Débito.
              </div>
            </motion.div>
          )}

          {step === 'mapping' && (
            <motion.div key="mapping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirme o mapeamento das colunas. Detectamos {rows.length} linha(s).
              </p>
              <div className="space-y-3">
                {FIELDS.map(f => (
                  <div key={f.key} className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium">
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                    </label>
                    <div className="col-span-2">
                      <Select
                        value={mapping[f.key] || '__none__'}
                        onValueChange={(v) => setMapping(m => ({ ...m, [f.key]: v === '__none__' ? '' : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nenhuma —</SelectItem>
                          {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep('preview')}
                  disabled={!mapping.month || !mapping.method || !mapping.value}
                >
                  Pré-visualizar <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {validRows.length} válidas
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" /> {invalidRows.length} com erro
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Bandeira</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processed.slice(0, 200).map((p) => (
                      <TableRow key={p.idx} className={p.errors.length ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs">{p.month || '—'}</TableCell>
                        <TableCell className="text-xs">{p.method?.label || p.rawMethod || '—'}</TableCell>
                        <TableCell className="text-xs">{p.brand?.name || (p.rawBrand || '—')}</TableCell>
                        <TableCell className="text-xs text-right">
                          {p.value != null ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.errors.length === 0 ? (
                            <span className="text-success">OK</span>
                          ) : (
                            <span className="text-destructive">{p.errors.join(', ')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {processed.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 200 de {processed.length} linhas
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Linhas com mesma combinação de mês + forma + bandeira já existentes serão <strong>substituídas</strong>.
              </p>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <Button onClick={doImport} disabled={importing || validRows.length === 0}>
                  {importing ? 'Importando...' : `Importar ${validRows.length} registro(s)`}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
