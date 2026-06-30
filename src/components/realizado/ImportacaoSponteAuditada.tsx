/**
 * Sponte Import Wizard — Auditoria Inteligente.
 *
 * 5 steps:
 *   1. Upload
 *   2. Conferência por método (arquivo × sistema)
 *   3. Simulação de delay (antes × depois)
 *   4. Simulação de substituição (remover × inserir, saldo esperado)
 *   5. Gravação + auditoria pós-importação + análise IA
 */

import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAddUpload, useAddAuditLog, usePaymentDelayRules, useEntriesFromBaseDate, useSchool } from '@/hooks/useFinancialData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Sparkles, Shield, X, Wand2, ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveMethodKey, PAYMENT_METHOD_ORDER, methodLabel, type PaymentMethodKey } from '@/lib/import/methodMapping';
import {
  buildConferenceReport,
  buildFileSummary,
  buildDelayVisualization,
  simulateDelays,
  simulateReplacement,
  buildInsertableEntries,
  type ParsedRow,
  type ConferenceReport,
  type FileSummary,
  type DelaySimulationResult,
  type DelayVisualization,
  type ReplacementSimulation,
} from '@/lib/import/sponteAuditEngine';
import type { FinancialEntry } from '@/types/financial';


type Step = 1 | 2 | 3 | 4 | 5;

interface Props {
  schoolId: string;
  onClose: () => void;
  onImported: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ManualColPicker({
  label, value, onChange, cols, allowEmpty,
}: { label: string; value: string; onChange: (v: string) => void; cols: string[]; allowEmpty?: boolean }) {
  return (
    <label className="text-xs space-y-1 block">
      <span className="font-medium text-foreground/80">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
      >
        <option value="">{allowEmpty ? '— nenhuma —' : '— selecione —'}</option>
        {cols.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );
}

function parseDateCell(raw: any): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    const y = raw.getFullYear(), m = String(raw.getMonth() + 1).padStart(2, '0'), d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  let s = String(raw).trim();
  s = s.replace(/[T\s]\d{1,2}:\d{2}(:\d{2})?.*$/, '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400000);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

function parseValueCell(raw: any): number | null {
  if (typeof raw === 'number') return raw;
  if (!raw) return null;
  const s = String(raw).replace(/[R$\s]/g, '').trim();
  if (!s) return null;
  let c = /\d\.\d{3}/.test(s) && s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.');
  c = c.replace(/[^\d.\-]/g, '');
  const n = parseFloat(c);
  return isNaN(n) ? null : n;
}

function pickColumn(cols: string[], aliases: string[]): string | undefined {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '_');
  for (const a of aliases) {
    const found = cols.find(c => norm(c) === norm(a));
    if (found) return found;
  }
  for (const a of aliases) {
    const found = cols.find(c => norm(c).includes(norm(a)));
    if (found) return found;
  }
  return undefined;
}

export function ImportacaoSponteAuditada({ schoolId, onClose, onImported }: Props) {
  const qc = useQueryClient();
  const { data: school } = useSchool(schoolId);
  const { data: rules = [] } = usePaymentDelayRules(schoolId);
  const { data: allEntries = [] } = useEntriesFromBaseDate(schoolId, school?.saldoInicialData);
  const addUploadMut = useAddUpload();
  const addAuditMut = useAddAuditLog();

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileSummary, setFileSummary] = useState<FileSummary | null>(null);
  const [delaySim, setDelaySim] = useState<DelaySimulationResult | null>(null);
  const [delayViz, setDelayViz] = useState<DelayVisualization | null>(null);
  const [replaceSim, setReplaceSim] = useState<ReplacementSimulation | null>(null);
  const [importing, setImporting] = useState(false);
  const [postAudit, setPostAudit] = useState<ConferenceReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [forceOverride, setForceOverride] = useState(false);

  // Classificação IA (etapa 2).
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifySuggestions, setClassifySuggestions] = useState<Array<{
    metodoRaw: string; atual: string | null; sugerida: string; qtd: number; motivo: string;
  }> | null>(null);
  const [classifyResumo, setClassifyResumo] = useState<string>('');


  // Estado para mapeamento manual de colunas quando o auto-detect falha.
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [rawCols, setRawCols] = useState<string[]>([]);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [mapData, setMapData] = useState<string>('');
  const [mapValor, setMapValor] = useState<string>('');
  const [mapMetodo, setMapMetodo] = useState<string>('');
  const [mapNome, setMapNome] = useState<string>('');

  // Conversão das linhas brutas em ParsedRow[] usando os nomes de coluna escolhidos.
  const parseRowsWithMapping = useCallback((
    rows: Record<string, any>[],
    colData: string,
    colValor: string,
    colMetodo: string,
    colNome?: string,
  ): { out: ParsedRow[]; errs: string[] } => {
    const errs: string[] = [];
    const out: ParsedRow[] = [];
    rows.forEach((r, i) => {
      const line = i + 2;
      const data = parseDateCell(r[colData]);
      const valor = parseValueCell(r[colValor]);
      const metodoRaw = String(r[colMetodo] ?? '').trim();
      if (!data) { errs.push(`Linha ${line}: data inválida`); return; }
      if (valor == null) { errs.push(`Linha ${line}: valor inválido`); return; }
      const key = resolveMethodKey(metodoRaw);
      if (!key) { errs.push(`Linha ${line}: método "${metodoRaw}" não reconhecido`); return; }
      out.push({
        lineNumber: line,
        dataVencimento: data,
        valor: valor,
        metodoRaw,
        metodoKey: key,
        nomeAluno: colNome ? String(r[colNome] ?? '').trim() : undefined,
      });
    });
    return { out, errs };
  }, []);

  // ── Step 1: file
  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParseErrors([]);
    setNeedsMapping(false);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (rows.length === 0) { toast.error('Arquivo vazio'); return; }
      const cols = Object.keys(rows[0]);
      const colData = pickColumn(cols, ['data_vencimento', 'dt_vencimento', 'vencimento']);
      const colValor = pickColumn(cols, ['valor_com_desconto', 'valor', 'vlr', 'total']);
      const colMetodo = pickColumn(cols, ['forma_de_cobranca', 'forma_cobranca', 'tipo_pagamento', 'metodo']);
      const colNome = pickColumn(cols, ['sacado', 'nome_aluno', 'aluno', 'nome']);

      // Auto-detect falhou em pelo menos uma coluna obrigatória — pedir mapeamento manual.
      if (!colData || !colValor || !colMetodo) {
        setRawRows(rows);
        setRawCols(cols);
        setMapData(colData ?? '');
        setMapValor(colValor ?? '');
        setMapMetodo(colMetodo ?? '');
        setMapNome(colNome ?? '');
        setNeedsMapping(true);
        toast.info('Selecione manualmente as colunas de vencimento, valor e forma de cobrança.');
        return;
      }

      const { out, errs } = parseRowsWithMapping(rows, colData, colValor, colMetodo, colNome);
      setParsed(out);
      setParseErrors(errs);
      if (out.length === 0) { toast.error('Nenhuma linha válida.'); return; }
      goToConference(out);
    } catch (e: any) {
      toast.error(`Erro ao ler arquivo: ${e?.message}`);
    }
  }, [allEntries, parseRowsWithMapping]);

  // Confirma o mapeamento manual escolhido pelo usuário.
  const confirmManualMapping = useCallback(() => {
    if (!mapData || !mapValor || !mapMetodo) {
      toast.error('Selecione vencimento, valor e forma de cobrança.');
      return;
    }
    const { out, errs } = parseRowsWithMapping(rawRows, mapData, mapValor, mapMetodo, mapNome || undefined);
    setParsed(out);
    setParseErrors(errs);
    if (out.length === 0) { toast.error('Nenhuma linha válida com as colunas escolhidas.'); return; }
    setNeedsMapping(false);
    goToConference(out);
  }, [rawRows, mapData, mapValor, mapMetodo, mapNome, parseRowsWithMapping]);

  // Step 2: apenas leitura do arquivo (sem comparar com sistema).
  const goToConference = (rows: ParsedRow[]) => {
    setFileSummary(buildFileSummary(rows));
    setClassifySuggestions(null);
    setClassifyResumo('');
    setStep(2);
  };

  // Verificação IA da classificação (chamado manualmente na etapa 2).
  const verifyClassification = async () => {
    setClassifyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-sponte-classification', {
        body: {
          rows: parsed.map(p => ({
            lineNumber: p.lineNumber,
            metodoRaw: p.metodoRaw,
            metodoKey: p.metodoKey,
            valor: p.valor,
            descricao: p.nomeAluno,
          })),
          allowedKeys: PAYMENT_METHOD_ORDER,
        },
      });
      if (error) throw error;
      setClassifySuggestions(Array.isArray(data?.sugestoes) ? data.sugestoes : []);
      setClassifyResumo(typeof data?.resumo === 'string' ? data.resumo : '');
    } catch (e: any) {
      toast.error(`IA: ${e?.message ?? 'falha ao verificar'}`);
    } finally {
      setClassifyLoading(false);
    }
  };

  // Aplica uma sugestão da IA reclassificando todas as linhas com aquele metodoRaw.
  const applySuggestion = (metodoRaw: string, sugerida: PaymentMethodKey) => {
    setParsed(prev => prev.map(p => p.metodoRaw === metodoRaw ? { ...p, metodoKey: sugerida } : p));
    setClassifySuggestions(prev => (prev ?? []).filter(s => s.metodoRaw !== metodoRaw));
    // Recalcular resumo após reclassificação.
    setFileSummary(buildFileSummary(parsed.map(p => p.metodoRaw === metodoRaw ? { ...p, metodoKey: sugerida } : p)));
    toast.success(`Reclassificado "${metodoRaw}" → ${methodLabel(sugerida)}`);
  };

  // ── Step 3: delay simulation
  const goToDelay = () => {
    const sim = simulateDelays(parsed, rules);
    setDelaySim(sim);
    setDelayViz(buildDelayVisualization(sim));
    setStep(3);
  };


  // ── Step 4: replacement simulation
  const goToReplace = () => {
    const minDate = parsed.reduce((m, r) => (r.dataVencimento < m ? r.dataVencimento : m), parsed[0].dataVencimento);
    const sistemaCandidatos = (allEntries as FinancialEntry[]).filter(e => e.origem === 'sponte');
    const sim = simulateReplacement(sistemaCandidatos, parsed, { origem: 'sponte', desde: minDate });
    setReplaceSim(sim);
    setStep(4);
  };

  // ── Step 5: persist
  const doImport = async () => {
    if (!replaceSim) return;
    setImporting(true);
    try {
      const uploadId = crypto.randomUUID();
      // 1) record upload
      await addUploadMut.mutateAsync({
        id: uploadId,
        school_id: schoolId,
        fileName,
        tipo: 'sponte',
        uploadedAt: new Date().toISOString(),
        recordCount: parsed.length,
      });

      // 2) delete the candidate set
      if (replaceSim.remover.ids.length > 0) {
        const { error: delErr } = await supabase.from('financial_entries').delete().in('id', replaceSim.remover.ids);
        if (delErr) throw delErr;
      }

      // 3) insert new entries with full traceability
      const entries = buildInsertableEntries(parsed, { schoolId, uploadId, fileName, rules });
      const dbRows = entries.map(e => ({
        id: e.id, school_id: e.school_id, data: e.data, descricao: e.descricao,
        valor: e.valor, tipo: e.tipo, categoria: e.categoria, origem: e.origem,
        origem_upload_id: e.origem_upload_id,
        tipo_registro: e.tipoRegistro,
        editado_manualmente: e.editadoManualmente,
        source_kind: 'import',
        source_file: e.source_file,
        imported_at: e.imported_at,
        data_original: e.data_original,
        delay_rule_applied: e.delay_rule_applied,
        payment_method_key: e.payment_method_key,
      }));
      // batched insert
      const CHUNK = 500;
      for (let i = 0; i < dbRows.length; i += CHUNK) {
        const { error } = await supabase.from('financial_entries').insert(dbRows.slice(i, i + CHUNK) as any);
        if (error) throw error;
      }

      // 4) post-import audit
      const { data: freshEntries } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('school_id', schoolId)
        .eq('origem', 'sponte')
        .eq('origem_upload_id', uploadId);
      const sistemaApos: FinancialEntry[] = (freshEntries || []).map((r: any) => ({
        id: r.id, school_id: r.school_id, data: r.data, descricao: r.descricao,
        valor: Number(r.valor), tipo: r.tipo, categoria: r.categoria, origem: r.origem,
        tipoRegistro: r.tipo_registro, editadoManualmente: r.editado_manualmente,
      }));
      const post = buildConferenceReport(parsed, sistemaApos);
      setPostAudit(post);

      // 5) save audit + AI analysis
      await supabase.from('import_audits').insert({
        school_id: schoolId,
        upload_id: uploadId,
        file_name: fileName,
        summary: {
          fileSummary, delaySim, delayViz, replaceSim, post,
        } as any,

        approved: true,
      });

      await addAuditMut.mutateAsync({
        school_id: schoolId,
        action: 'upload',
        description: `[Auditado] Upload "${fileName}" Sponte — ${parsed.length} registros, ${replaceSim.remover.count} removidos, saldo ${fmt(replaceSim.saldoEsperado)}`,
      });

      qc.invalidateQueries({ queryKey: ['entries-from-base'] });

      // AI analysis if diff
      if (Math.abs(post.diferencaTotal) > 0.01) {
        runAi(post, sistemaApos);
      }

      toast.success('Importação concluída com auditoria.');
      onImported();
      setStep(5);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? 'desconhecido'}`);
    } finally {
      setImporting(false);
    }
  };

  const runAi = async (post: ConferenceReport, sample: FinancialEntry[]) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-import-differences', {
        body: {
          schoolId,
          totalDiff: post.diferencaTotal,
          perMethod: post.perMethod,
          sampleSistemaRows: sample.slice(0, 30).map(e => ({
            data: e.data, valor: e.valor, categoria: e.categoria, descricao: e.descricao,
          })),
          context: `Arquivo: ${fileName}. Registros arquivo: ${parsed.length}.`,
        },
      });
      if (error) throw error;
      setAiAnalysis(data);
    } catch (e: any) {
      toast.error(`IA: ${e?.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const stepNames = ['Upload', 'Conferência', 'Delay', 'Substituição', 'Auditoria'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Importação Sponte — Auditoria Inteligente</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {stepNames.map((name, i) => {
          const n = (i + 1) as Step;
          const active = step === n, done = step > n;
          return (
            <div key={name} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold ${
                done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/20 text-primary border border-primary' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              <span className={active ? 'font-medium' : 'text-muted-foreground'}>{name}</span>
              {i < stepNames.length - 1 && <span className="text-muted-foreground">›</span>}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <label className="glass-card rounded-xl p-8 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-primary" />
              <span className="text-sm">Selecione o arquivo Sponte (Recebimentos)</span>
              <span className="text-xs text-muted-foreground">XLSX / CSV</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
            {needsMapping && (
              <div className="mt-3 glass-card rounded-xl p-4 border-amber-500/40 bg-amber-500/5 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-700">Direcionamento manual de colunas</p>
                    <p className="text-amber-700/80">Não foi possível detectar automaticamente todas as colunas. Escolha qual coluna do arquivo corresponde a cada campo.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ManualColPicker label="Vencimento *" value={mapData} onChange={setMapData} cols={rawCols} />
                  <ManualColPicker label="Valor *" value={mapValor} onChange={setMapValor} cols={rawCols} />
                  <ManualColPicker label="Forma de cobrança *" value={mapMetodo} onChange={setMapMetodo} cols={rawCols} />
                  <ManualColPicker label="Nome do aluno (opcional)" value={mapNome} onChange={setMapNome} cols={rawCols} allowEmpty />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setNeedsMapping(false); setFileName(''); }}>Cancelar</Button>
                  <Button size="sm" onClick={confirmManualMapping} disabled={!mapData || !mapValor || !mapMetodo}>
                    Confirmar mapeamento <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            {parseErrors.length > 0 && (
              <div className="mt-3 glass-card rounded-xl p-3 bg-destructive/5 border-destructive/30">
                <p className="text-xs font-medium text-destructive mb-1">{parseErrors.length} linhas com erro:</p>
                <div className="max-h-24 overflow-y-auto text-xs text-destructive/80 space-y-0.5">
                  {parseErrors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 2 && fileSummary && (
          <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Conferência do que foi <strong>lido do arquivo</strong> <span className="text-foreground">{fileName}</span>.
              Esta etapa valida apenas a leitura — sem comparar com o sistema.
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-card rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">Total do arquivo</p>
                <p className="text-lg font-semibold">{fmt(fileSummary.total)}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">Registros</p>
                <p className="text-lg font-semibold">{fileSummary.totalRegistros}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">Primeiro vencimento</p>
                <p className="text-sm font-semibold">{fileSummary.dataMin || '—'}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">Último vencimento</p>
                <p className="text-sm font-semibold">{fileSummary.dataMax || '—'}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor lido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fileSummary.perMethod.map(l => (
                  <TableRow key={l.method}>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-right">{l.qtd}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(l.valor)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{fileSummary.totalRegistros}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(fileSummary.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Verificação IA de classificação */}
            <div className="glass-card rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <strong className="text-sm">Verificação de classificação por IA</strong>
                </div>
                <Button size="sm" variant="outline" onClick={verifyClassification} disabled={classifyLoading}>
                  {classifyLoading
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Analisando…</>
                    : <><Wand2 className="w-3 h-3 mr-1" />{classifySuggestions ? 'Reanalisar' : 'Analisar classificação'}</>}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A IA identifica erros como "Dinheiro lido como Boleto", "Débito como Crédito" ou "PIX como Sponte Pay" e sugere a correção.
              </p>

              {classifySuggestions && classifySuggestions.length === 0 && (
                <div className="flex items-center gap-2 text-success text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{classifyResumo || 'Nenhuma classificação suspeita encontrada.'}</span>
                </div>
              )}

              {classifySuggestions && classifySuggestions.length > 0 && (
                <div className="space-y-2">
                  {classifyResumo && <p className="text-xs italic text-muted-foreground">{classifyResumo}</p>}
                  {classifySuggestions.map((s, i) => {
                    const valid = (PAYMENT_METHOD_ORDER as readonly string[]).includes(s.sugerida);
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/30">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-xs">
                          <p className="font-medium">"{s.metodoRaw}" ({s.qtd} {s.qtd === 1 ? 'linha' : 'linhas'})</p>
                          <p className="text-muted-foreground">
                            Atual: <Badge variant="outline" className="ml-1">{s.atual ? methodLabel(s.atual as PaymentMethodKey) : 'não reconhecido'}</Badge>
                            <ArrowRight className="w-3 h-3 inline mx-1" />
                            Sugerido: <Badge className="ml-1">{valid ? methodLabel(s.sugerida as PaymentMethodKey) : s.sugerida}</Badge>
                          </p>
                          <p className="text-muted-foreground italic mt-0.5">{s.motivo}</p>
                        </div>
                        {valid && (
                          <Button size="sm" variant="outline" onClick={() => applySuggestion(s.metodoRaw, s.sugerida as PaymentMethodKey)}>
                            Aplicar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button size="sm" onClick={goToDelay}>Aprovar leitura <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </motion.div>
        )}

        {step === 3 && delaySim && delayViz && (
          <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Aplicação dos prazos configurados (e ajuste de finais de semana para o próximo dia útil).
              Veja para qual mês cada valor foi movido.
            </div>

            {delaySim.errors.length > 0 && (
              <div className="rounded-lg p-3 bg-destructive/5 border border-destructive/30">
                <div className="flex items-center gap-2 text-destructive mb-2"><AlertTriangle className="w-4 h-4" /><strong className="text-xs">Erros</strong></div>
                <ul className="text-xs space-y-0.5 text-destructive/80">{delaySim.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}

            {/* Resumo de fluxo entre meses */}
            <div className="glass-card rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightCircle className="w-4 h-4 text-primary" />
                  <strong className="text-sm">Valores deslocados entre meses</strong>
                </div>
                <span className="text-xs text-muted-foreground">
                  {delayViz.totalRegistrosMovidos} {delayViz.totalRegistrosMovidos === 1 ? 'registro' : 'registros'} · {fmt(delayViz.totalMovido)}
                </span>
              </div>
              {delayViz.flows.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum valor mudou de mês após o delay.</p>
              ) : (
                <div className="space-y-1">
                  {delayViz.flows.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0 border-border/40">
                      <Badge variant="outline" className="font-mono">{f.fromMonth}</Badge>
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <Badge className="font-mono">{f.toMonth}</Badge>
                      <span className="flex-1 text-muted-foreground">{f.label}</span>
                      <span className="text-muted-foreground">{f.qtd}×</span>
                      <span className="font-semibold tabular-nums">{fmt(f.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comparação por mês — antes × depois */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Totais por mês — antes × depois</h4>
              {delayViz.months.map(mb => (
                <div key={mb.month} className="glass-card rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 border-b">
                    <span className="font-mono text-sm font-semibold">{mb.month}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Antes: <span className="font-semibold text-foreground tabular-nums">{fmt(mb.antesTotal)}</span></span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="text-muted-foreground">Depois: <span className="font-semibold text-foreground tabular-nums">{fmt(mb.depoisTotal)}</span></span>
                      <Badge variant={Math.abs(mb.delta) < 0.01 ? 'outline' : mb.delta > 0 ? 'default' : 'secondary'} className="tabular-nums">
                        {mb.delta > 0 ? '+' : ''}{fmt(mb.delta)}
                      </Badge>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Antes</TableHead>
                        <TableHead className="text-right">Depois</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mb.perMethod.map(m => (
                        <TableRow key={m.method}>
                          <TableCell>{m.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(m.antes)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{fmt(m.depois)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${Math.abs(m.delta) < 0.01 ? 'text-muted-foreground' : m.delta > 0 ? 'text-success' : 'text-amber-600'}`}>
                            {m.delta > 0 ? '+' : ''}{fmt(m.delta)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button size="sm" onClick={goToReplace} disabled={delaySim.errors.length > 0}>Aprovar delay <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </motion.div>
        )}



        {step === 4 && replaceSim && (
          <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Prévia determinística da substituição. Saldo esperado deve ser <strong>R$ 0,00</strong>.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Remover</p>
                <p className="text-lg font-semibold">{replaceSim.remover.count}</p>
                <p className="text-xs">{fmt(replaceSim.remover.valor)}</p>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Inserir</p>
                <p className="text-lg font-semibold">{replaceSim.inserir.count}</p>
                <p className="text-xs">{fmt(replaceSim.inserir.valor)}</p>
              </div>
              <div className={`glass-card rounded-xl p-3 ${replaceSim.bloqueia ? 'border-amber-500/50' : 'border-success/50'}`}>
                <p className="text-xs text-muted-foreground">Saldo esperado</p>
                <p className={`text-lg font-semibold ${replaceSim.bloqueia ? 'text-amber-600' : 'text-success'}`}>{fmt(replaceSim.saldoEsperado)}</p>
                <p className="text-xs">{replaceSim.bloqueia ? 'Diferença detectada' : 'OK'}</p>
              </div>
            </div>
            {replaceSim.bloqueia && (
              <div className="rounded-lg p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300/50">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertTriangle className="w-4 h-4" /><strong className="text-xs">Saldo diferente de zero</strong>
                </div>
                <p className="text-xs text-amber-700/80 mb-2">A diferença pode ser causada por: novos lançamentos no arquivo, fim-de-semana, ou substituição parcial. Você pode prosseguir com override.</p>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={forceOverride} onChange={e => setForceOverride(e.target.checked)} />
                  Eu entendo e quero prosseguir mesmo assim.
                </label>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button size="sm" onClick={doImport} disabled={importing || (replaceSim.bloqueia && !forceOverride)}>
                {importing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Gravando…</> : <>Confirmar gravação <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 5 && postAudit && (
          <motion.div key="s5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" /><strong>Importação gravada com rastreabilidade completa.</strong>
            </div>
            <div className="text-xs text-muted-foreground">
              Auditoria pós-importação comparando o que foi gravado com o arquivo original.
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Arquivo</TableHead>
                  <TableHead className="text-right">Sistema</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postAudit.perMethod.map(l => (
                  <TableRow key={l.method}>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-right">{fmt(l.arquivoValor)}</TableCell>
                    <TableCell className="text-right">{fmt(l.sistemaValor)}</TableCell>
                    <TableCell className={`text-right ${Math.abs(l.diferencaValor) < 0.01 ? 'text-success' : 'text-amber-600'}`}>{fmt(l.diferencaValor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {Math.abs(postAudit.diferencaTotal) > 0.01 && (
              <div className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <strong className="text-sm">Análise IA das diferenças</strong>
                </div>
                {aiLoading && <p className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1" />Analisando…</p>}
                {aiAnalysis && (
                  <div className="text-xs space-y-2">
                    {aiAnalysis.resumo && <p className="italic">{aiAnalysis.resumo}</p>}
                    {Array.isArray(aiAnalysis.causas) && aiAnalysis.causas.map((c: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                        <Badge variant="outline" className="shrink-0">{c.tipo}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">{c.valor_estimado != null ? fmt(c.valor_estimado) : ''}</p>
                          <p className="text-muted-foreground">{c.explicacao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={onClose}>Concluir</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
