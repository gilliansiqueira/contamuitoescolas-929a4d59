import { useMemo, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { GraduationCap, Upload, FileSpreadsheet, Send, Download, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useAllRenewalSheets, useRenewalSheets, useRenewalTemplates, useRenewalSettings, useRenewalSources, useRenewalRows,
  useSheetChildren, useInvalidateRenewal, renewalDb as db, type RenewalSheet, type RenewalTemplate,
} from '@/hooks/useRenewal';
import { parseTemplate } from '@/lib/renewal/templateParser';
import { parseSponteFile, type ParsedSource } from '@/lib/renewal/sponteParser';
import { defaultMinDue } from '@/lib/renewal/mergeEngine';
import { defaultColumns } from '@/lib/renewal/fields';
import { buildWorkbook, computeSummary } from '@/lib/renewal/exportXlsx';
import { SHEET_STATUS, type RenewalColumn, type RenewalRow, type TemplateStructure } from '@/lib/renewal/types';
import { saveImport, rebuildSheet, applyEdit, saveRows, registerDelivery, downloadVersion, downloadBuffer } from '@/lib/renewal/persist';
import { RenewalGrid, type CellEdit } from './RenewalGrid';

const statusLabel = (k: string) => SHEET_STATUS.find(s => s.key === k)?.label ?? k;
const fmtDT = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const KIND_LABEL: Record<string, string> = { imported: 'Importada', calculated: 'Calculada', manual: 'Manual' };
const ISSUE_LABEL: Record<string, string> = {
  sem_financeiro: 'Sem parcelas do módulo', nome_ambiguo: 'Nome ambíguo', nome_semelhante: 'Nome parecido', sem_correspondencia: 'Sem correspondência nas turmas',
  varios_contratos: 'Vários contratos', varias_turmas: 'Aluno em mais de uma turma', sem_matricula: 'Sem matrícula', fora_da_base: 'Saiu da base',
};

export function RenovacaoModule({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [tab, setTab] = useState('escola');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Renovação escolar</h2>
        <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Piloto</span>
        <span className="ml-auto text-xs text-muted-foreground">Visível apenas para a equipe.</span>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="escola">{schoolName}</TabsTrigger><TabsTrigger value="geral">Visão geral</TabsTrigger></TabsList>
        <TabsContent value="escola"><SchoolRenewal schoolId={schoolId} /></TabsContent>
        <TabsContent value="geral"><Overview /></TabsContent>
      </Tabs>
    </div>
  );
}

function Overview() {
  const { data = [], isLoading } = useAllRenewalSheets();
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma planilha de renovação criada ainda.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Escola</th><th>Período</th><th>Status</th><th>Versão</th><th>Última atualização</th></tr></thead>
          <tbody>{data.map(s => (
            <tr key={s.id} className="border-t border-border">
              <td className="py-2 font-medium">{s.schools?.nome}</td><td>{s.period}</td>
              <td><Badge variant="outline">{statusLabel(s.status)}</Badge></td>
              <td>{s.current_version ? `v${s.current_version}` : '—'}{s.dirty && <span className="ml-2 text-xs text-warning">revisão não enviada</span>}</td>
              <td>{fmtDT(s.updated_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

function SchoolRenewal({ schoolId }: { schoolId: string }) {
  const { data: sheets = [] } = useRenewalSheets(schoolId);
  const { data: templates = [] } = useRenewalTemplates(schoolId);
  const [sheetId, setSheetId] = useState<string>('');
  const [newPeriod, setNewPeriod] = useState('');
  const invalidate = useInvalidateRenewal();
  const sheet = sheets.find(s => s.id === sheetId) ?? sheets[0];
  const approved = templates.find(t => t.approved);
  const [step, setStep] = useState('modelo');

  const createSheet = async () => {
    const period = newPeriod.trim();
    if (!/^\d{4}\/[12]$/.test(period)) { toast.error('Informe o período como 2027/1 ou 2026/2.'); return; }
    const { data, error } = await db.from('renewal_sheets').insert({ school_id: schoolId, period, template_id: approved?.id ?? null, columns: approved?.structure.columns ?? defaultColumns(), params: { minDue: defaultMinDue(period) } }).select().single();
    if (error) { toast.error(error.message.includes('duplicate') ? 'Já existe planilha para esse período.' : error.message); return; }
    setSheetId(data.id); setNewPeriod(''); invalidate(schoolId); setStep('relatorios');
    toast.success(approved ? `Planilha ${period} criada a partir do modelo v${approved.version}.` : `Planilha ${period} criada com colunas padrão (sem modelo aprovado).`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="space-y-1"><Label className="text-xs">Planilha</Label>
          <Select value={sheet?.id ?? ''} onValueChange={setSheetId}>
            <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Nenhuma planilha" /></SelectTrigger>
            <SelectContent>{sheets.map(s => <SelectItem key={s.id} value={s.id}>{s.period} · {statusLabel(s.status)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Nova renovação (período)</Label>
          <div className="flex gap-2"><Input className="h-9 w-32" placeholder="2027/1" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} /><Button size="sm" onClick={createSheet}>Criar planilha do período</Button></div>
        </div>
        {sheet && <SheetHeader sheet={sheet} onChanged={() => invalidate(schoolId, sheet.id)} />}
      </div>
      <NextStepBanner sheet={sheet} onGo={setStep} />
      <Tabs value={step} onValueChange={setStep}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="modelo">1. Modelo</TabsTrigger>
          <TabsTrigger value="relatorios" disabled={!sheet} title={!sheet ? 'Crie a planilha do período para liberar esta etapa.' : undefined}>2. Relatórios</TabsTrigger>
          <TabsTrigger value="conferencia" disabled={!sheet} title={!sheet ? 'Crie a planilha do período para liberar esta etapa.' : undefined}>3. Conferência</TabsTrigger>
          <TabsTrigger value="planilha" disabled={!sheet} title={!sheet ? 'Crie a planilha do período para liberar esta etapa.' : undefined}>4. Planilha</TabsTrigger>
          <TabsTrigger value="envios" disabled={!sheet} title={!sheet ? 'Crie a planilha do período para liberar esta etapa.' : undefined}>5. Envios</TabsTrigger>
        </TabsList>
        {!sheet && <p className="mt-2 text-xs text-muted-foreground">Crie a planilha do período no campo acima para liberar as próximas etapas.</p>}
        <TabsContent value="modelo"><TemplatePanel schoolId={schoolId} templates={templates} /></TabsContent>
        {sheet && <>
          <TabsContent value="relatorios"><ReportsPanel sheet={sheet} /></TabsContent>
          <TabsContent value="conferencia"><IssuesPanel sheet={sheet} /></TabsContent>
          <TabsContent value="planilha"><SheetPanel sheet={sheet} templates={templates} /></TabsContent>
          <TabsContent value="envios"><DeliveriesPanel sheet={sheet} templates={templates} /></TabsContent>
        </>}
      </Tabs>
    </div>
  );
}

function NextStepBanner({ sheet, onGo }: { sheet: RenewalSheet | undefined; onGo: (step: string) => void }) {
  const { data: imports = [] } = useSheetChildren<any>('renewal_imports', sheet?.id ?? '');
  const { data: issues = [] } = useSheetChildren<any>('renewal_issues', sheet?.id ?? '');
  const { data: rows = [] } = useRenewalRows(sheet?.id ?? '');
  const { data: deliveries = [] } = useSheetChildren<any>('renewal_deliveries', sheet?.id ?? '');

  let text: string; let go: string | null = null; let goLabel = '';
  if (!sheet) text = 'Para começar: digite o período (ex.: 2027/1) no campo "Nova renovação" e clique em Criar planilha do período.';
  else if (imports.length === 0) { text = 'Etapa 2: envie os relatórios do Sponte — primeiro Turmas Existentes, depois Contas a Receber.'; go = 'relatorios'; goLabel = 'Ir para Relatórios'; }
  else if (rows.length === 0) { text = 'Etapa 2: falta o relatório de Turmas Existentes para montar a base de alunos.'; go = 'relatorios'; goLabel = 'Ir para Relatórios'; }
  else if (issues.some(i => !i.resolved)) { text = `Etapa 3: confira ${issues.filter(i => !i.resolved).length} item(ns) antes de usar a planilha.`; go = 'conferencia'; goLabel = 'Ir para Conferência'; }
  else if (deliveries.length === 0) { text = 'Etapa 4: a planilha está montada — ajuste o que precisar e baixe o Excel. Depois registre o envio na etapa 5.'; go = 'planilha'; goLabel = 'Ir para Planilha'; }
  else if (sheet.dirty) { text = 'A planilha mudou depois do último envio. Registre um novo envio para guardar a versão atualizada.'; go = 'envios'; goLabel = 'Ir para Envios'; }
  else { text = 'Tudo em dia: planilha montada, conferida e enviada.'; go = 'planilha'; goLabel = 'Abrir Planilha'; }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
      <p className="text-sm"><span className="font-semibold">Próximo passo: </span>{text}</p>
      {go && <Button size="sm" variant="outline" onClick={() => onGo(go)}>{goLabel}</Button>}
    </div>
  );
}

function SheetHeader({ sheet, onChanged }: { sheet: RenewalSheet; onChanged: () => void }) {
  const setStatus = async (status: string) => { await db.from('renewal_sheets').update({ status, updated_at: new Date().toISOString() }).eq('id', sheet.id); onChanged(); };
  return (
    <div className="ml-auto flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label className="text-xs">Status</Label>
        <Select value={sheet.status} onValueChange={setStatus}><SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{SHEET_STATUS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>Versão enviada: {sheet.sent_version ? `v${sheet.sent_version}` : 'nenhuma'}</p>
        {sheet.dirty && <p className="font-medium text-warning">Há revisão ainda não enviada</p>}
        <p>Atualizada {fmtDT(sheet.updated_at)}</p>
      </div>
    </div>
  );
}

function TemplatePanel({ schoolId, templates }: { schoolId: string; templates: RenewalTemplate[] }) {
  const { user } = useAuth();
  const invalidate = useInvalidateRenewal();
  const [preview, setPreview] = useState<{ structure: TemplateStructure; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: settings, save } = useRenewalSettings(schoolId);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setPreview({ structure: await parseTemplate(await f.arrayBuffer()), file: f }); }
    catch (e: any) { toast.error(e.message ?? 'Não consegui ler o arquivo.'); }
  };
  const useAsTemplate = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const version = (templates[0]?.version ?? 0) + 1;
      const path = `${schoolId}/modelos/v${version}-${Date.now()}.xlsx`;
      await (db.storage as any).from('renewal-files').upload(path, preview.file);
      await db.from('renewal_templates').update({ approved: false }).eq('school_id', schoolId);
      const { error } = await db.from('renewal_templates').insert({ school_id: schoolId, version, name: preview.file.name, approved: true, structure: preview.structure, source_file: path, created_by: user?.id });
      if (error) throw error;
      toast.success(`Modelo v${version} salvo e aprovado para uso.`); setPreview(null); invalidate(schoolId);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const approve = async (t: RenewalTemplate) => {
    await db.from('renewal_templates').update({ approved: false }).eq('school_id', schoolId);
    await db.from('renewal_templates').update({ approved: true }).eq('id', t.id); invalidate(schoolId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold">Enviar a última planilha aprovada pelo cliente</h3>
          <p className="mb-3 text-xs text-muted-foreground">O sistema lê abas, colunas, listas, fórmulas e quadro de resumo. Os alunos do arquivo não são copiados para a nova renovação.</p>
          <Input type="file" accept=".xlsx" onChange={e => onFile(e.target.files?.[0])} />
        </div>
        {preview && (
          <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Prévia: {preview.file.name}</h3><Button onClick={useAsTemplate} disabled={busy}>Usar este arquivo como modelo</Button></div>
            <p className="text-xs text-muted-foreground">Abas: {preview.structure.sheets.join(', ')} · aba principal: {preview.structure.mainSheet}</p>
            <p className="text-xs">Quadro de resumo: {[preview.structure.summary.byProfessor && 'por professor', preview.structure.summary.byStatus && 'por status da renovação', preview.structure.summary.bySituacao && 'por situação do contrato'].filter(Boolean).join(' · ') || 'não encontrado'}</p>
            <ColumnsTable columns={preview.structure.columns.filter(c => !c.hidden)} />
            {preview.structure.summary.formulas.length > 0 && <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Fórmulas encontradas ({preview.structure.summary.formulas.length})</summary><ul className="mt-1 space-y-0.5 font-mono">{preview.structure.summary.formulas.map(f => <li key={f}>{f}</li>)}</ul></details>}
            {preview.structure.notes.map(n => <p key={n} className="text-xs text-muted-foreground">• {n}</p>)}
            <p className="text-xs text-muted-foreground">Campos conhecidos que não estão no modelo (matrícula, curso, contrato…) entram ocultos e podem ser exibidos na planilha.</p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Versões do modelo</h3>
          {templates.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum modelo ainda.</p> : (
            <table className="w-full text-sm"><tbody>{templates.map(t => (
              <tr key={t.id} className="border-t border-border"><td className="py-2">v{t.version}</td><td>{t.name}</td><td className="text-xs text-muted-foreground">{fmtDT(t.created_at)}</td>
                <td className="text-right">{t.approved ? <Badge className="bg-success text-success-foreground">Aprovado para uso</Badge> : <Button size="sm" variant="outline" onClick={() => approve(t)}>Aprovar</Button>}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
      <div className="h-fit space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Regras desta escola</h3>
        {settings && <>
          <label className="flex items-center justify-between gap-2 text-sm">Considerar material didático na última parcela
            <Switch checked={settings.include_material} onCheckedChange={v => save.mutate({ ...settings, include_material: v })} /></label>
          <div className="space-y-1"><Label className="text-xs">Categorias que são parcela do módulo (separe por ;)</Label>
            <Input defaultValue={settings.module_categories.join('; ')} onBlur={e => save.mutate({ ...settings, module_categories: e.target.value.split(';').map(s => s.trim()).filter(Boolean) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Modalidades em aba separada (separe por ;)</Label>
            <Input defaultValue={settings.separate_modalities.join('; ')} onBlur={e => save.mutate({ ...settings, separate_modalities: e.target.value.split(';').map(s => s.trim()).filter(Boolean) })} /></div>
          <p className="text-[11px] text-muted-foreground">Matrícula, reposição, taxa e outros serviços nunca entram na última parcela. Parcelas canceladas também ficam de fora.</p>
        </>}
      </div>
    </div>
  );
}

function ColumnsTable({ columns }: { columns: RenewalColumn[] }) {
  return (
    <table className="w-full text-xs">
      <thead><tr className="text-left text-muted-foreground"><th className="py-1">#</th><th>Coluna</th><th>Preenchimento</th><th>Fonte</th><th>Tipo</th></tr></thead>
      <tbody>{columns.map((c, i) => (
        <tr key={c.id} className="border-t border-border">
          <td className="py-1">{i + 1}</td><td className="font-medium">{c.title}</td>
          <td><Badge variant="outline">{KIND_LABEL[c.kind]}</Badge>{c.doubt && <span className="ml-1 text-warning" title={c.doubt}><AlertTriangle className="inline h-3 w-3" /> dúvida</span>}</td>
          <td>{c.source === 'turmas_existentes' ? 'Turmas Existentes' : c.source === 'contas_receber' ? 'Contas a Receber' : '—'}</td>
          <td>{c.type === 'list' ? `lista (${c.options?.join(' / ')})` : c.type === 'date' ? 'data' : c.type === 'number' ? 'número' : 'texto'}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function ReportsPanel({ sheet }: { sheet: RenewalSheet }) {
  const { user } = useAuth();
  const { data: sources = [] } = useRenewalSources();
  const { data: imports = [] } = useSheetChildren<any>('renewal_imports', sheet.id);
  const { data: rows = [] } = useRenewalRows(sheet.id);
  const { data: settings } = useRenewalSettings(sheet.school_id);
  const invalidate = useInvalidateRenewal();
  const [parsed, setParsed] = useState<{ p: ParsedSource; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [minDue, setMinDue] = useState(sheet.params?.minDue ?? defaultMinDue(sheet.period));

  const needed = new Set(sheet.columns.filter(c => !c.hidden && c.source).map(c => c.source!));
  needed.add('turmas_existentes');
  const onFile = async (f?: File) => { if (!f) return; try { setParsed({ p: await parseSponteFile(f), name: f.name }); } catch (e: any) { toast.error(e.message); } };
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e: any) { toast.error(e.message ?? String(e)); } finally { setBusy(false); invalidate(sheet.school_id, sheet.id); } };
  const confirm = () => run(async () => {
    await saveImport(sheet, parsed!.p, parsed!.name, user?.id);
    const r = await rebuildSheet(sheet, settings!, rows);
    setParsed(null);
    toast.success(r.stats ? `Importado. ${r.stats.added} novas linhas, ${r.stats.kept} com edições preservadas, ${r.stats.conflicts} conflito(s), ${r.issues} item(ns) para conferência.` : 'Importado. Falta o relatório de Turmas Existentes para montar a base.');
  });
  const recalc = () => run(async () => {
    await db.from('renewal_sheets').update({ params: { ...sheet.params, minDue } }).eq('id', sheet.id);
    const r = await rebuildSheet({ ...sheet, params: { ...sheet.params, minDue } }, settings!, rows);
    toast.success(r.stats ? `Recalculado: ${r.issues} item(ns) para conferência.` : 'Envie primeiro Turmas Existentes.');
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {sources.filter(s => needed.has(s.key) || s.key === 'parcelamento_cartao').map(s => {
          const last = imports.find((i: any) => i.source_key === s.key);
          const fills = sheet.columns.filter(c => c.source === s.key && !c.hidden).map(c => c.title);
          const isNeeded = needed.has(s.key);
          return (
            <div key={s.key} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="text-sm font-semibold">{s.name}</h3><p className="text-xs text-muted-foreground">{s.purpose}</p></div>
                {last ? <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Recebido</Badge>
                  : isNeeded ? <Badge variant="outline" className="border-warning text-warning"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>
                  : <Badge variant="outline">Opcional · regra não validada</Badge>}
              </div>
              <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-[110px_1fr]">
                <dt className="text-muted-foreground">Onde exportar</dt><dd>{s.sponte_path ?? 'Caminho ainda não cadastrado'}</dd>
                <dt className="text-muted-foreground">Filtros</dt><dd>{s.filters}{s.key === 'contas_receber' ? ` — neste período, a partir de ${minDue.split('-').reverse().join('/')}` : ''}</dd>
                <dt className="text-muted-foreground">Preenche</dt><dd>{fills.length ? fills.join(', ') : s.key === 'turmas_existentes' ? 'Base de alunos (matrícula, turma…)' : s.key === 'parcelamento_cartao' ? 'Término do pagamento no cartão (hoje fica "A confirmar")' : '—'}</dd>
                {last && <><dt className="text-muted-foreground">Último envio</dt><dd>{last.file_name} · {last.row_count} linhas · {fmtDT(last.created_at)}</dd></>}
              </dl>
            </div>
          );
        })}
        {sheet.columns.some(c => c.doubt && !c.hidden) && (
          <div className="rounded-xl border border-warning/50 bg-warning/5 p-3 text-xs">
            <p className="mb-1 font-semibold text-warning">Campos sem regra validada</p>
            {sheet.columns.filter(c => c.doubt && !c.hidden).map(c => <p key={c.id}>• <b>{c.title}</b>: {c.doubt}</p>)}
          </div>
        )}
      </div>
      <div className="h-fit space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Enviar relatório do Sponte</h3>
        {imports.length === 0 && <p className="rounded-md bg-primary/10 p-2 text-xs font-medium">Comece pelo relatório de Turmas Existentes; depois envie o de Contas a Receber.</p>}
        <p className="text-xs text-muted-foreground">Excel (.xls/.xlsx) ou CSV. O sistema reconhece qual relatório é.</p>
        <Input type="file" accept=".xls,.xlsx,.csv" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        {parsed && (
          <div className="space-y-2 rounded-lg border border-primary/40 p-3 text-xs">
            <p><b>{parsed.p.source === 'turmas_existentes' ? 'Turmas Existentes' : 'Contas a Receber'}</b> · {parsed.p.rows.length} registros · {parsed.p.discarded} linhas de título/total descartadas</p>
            <div className="max-h-40 overflow-auto"><table className="w-full">{parsed.p.rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-border"><td className="py-0.5">{parsed.p.source === 'turmas_existentes' ? `${r.Aluno} · ${r.NumeroMatricula} · ${r.Nome}` : `${r.Sacado} · ${r.Categoria} · ${String(r.DataVencimento ?? '').slice(0, 10)}`}</td></tr>)}</table></div>
            <Button size="sm" onClick={confirm} disabled={busy || !settings}>Confirmar importação</Button>
          </div>
        )}
        <div className="space-y-1 border-t border-border pt-3"><Label className="text-xs">Parcelas a partir de (vencimento)</Label>
          <div className="flex gap-2"><Input type="date" className="h-9" value={minDue} onChange={e => setMinDue(e.target.value)} /><Button size="sm" variant="outline" onClick={recalc} disabled={busy}><RefreshCw className="h-4 w-4" /></Button></div>
          <p className="text-[11px] text-muted-foreground">Evita contratos antigos. Recalcular preserva tudo o que a equipe já editou.</p>
        </div>
      </div>
    </div>
  );
}

function IssuesPanel({ sheet }: { sheet: RenewalSheet }) {
  const { data: issues = [] } = useSheetChildren<any>('renewal_issues', sheet.id);
  const { data: rows = [] } = useRenewalRows(sheet.id);
  const invalidate = useInvalidateRenewal();
  const [kind, setKind] = useState('');
  const open = issues.filter(i => !i.resolved);
  const kinds = [...new Set(open.map(i => i.kind))];
  const conflicts = rows.filter(r => Object.keys(r.conflicts ?? {}).length).length;
  const toggle = async (id: string, resolved: boolean) => { await db.from('renewal_issues').update({ resolved }).eq('id', id); invalidate(sheet.school_id, sheet.id); };
  const list = (kind ? issues.filter(i => i.kind === kind) : issues).slice(0, 500);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setKind('')} className={`rounded-lg border px-3 py-1.5 text-xs ${!kind ? 'border-primary bg-primary/10' : 'border-border'}`}>Todas ({open.length})</button>
        {kinds.map(k => <button key={k} onClick={() => setKind(k)} className={`rounded-lg border px-3 py-1.5 text-xs ${kind === k ? 'border-primary bg-primary/10' : 'border-border'}`}>{ISSUE_LABEL[k] ?? k} ({open.filter(i => i.kind === k).length})</button>)}
        {conflicts > 0 && <span className="rounded-lg border border-destructive px-3 py-1.5 text-xs text-destructive">{conflicts} linha(s) com conflito de importação — resolva na planilha</span>}
      </div>
      <div className="rounded-xl border border-border bg-card">
        {list.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nada para conferir.</p> : list.map(i => (
          <label key={i.id} className={`flex items-start gap-2 border-b border-border px-3 py-2 text-sm last:border-0 ${i.resolved ? 'opacity-50' : ''}`}>
            <input type="checkbox" className="mt-1" checked={i.resolved} onChange={e => toggle(i.id, e.target.checked)} />
            <span><Badge variant="outline" className="mr-2 text-[10px]">{ISSUE_LABEL[i.kind] ?? i.kind}</Badge>{i.message}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Marque como conferido depois de ajustar na planilha. Alunos sem parcelas continuam na planilha como "Sem informação" — não significa quitado.</p>
    </div>
  );
}

function SheetPanel({ sheet, templates }: { sheet: RenewalSheet; templates: RenewalTemplate[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = useInvalidateRenewal();
  const { data: rows = [], isLoading } = useRenewalRows(sheet.id);
  const [pendingCols, setPendingCols] = useState<RenewalColumn[] | null>(null);
  const columns = pendingCols ?? sheet.columns;
  const structure = templates.find(t => t.id === sheet.template_id)?.structure ?? templates.find(t => t.approved)?.structure ?? null;
  const summary = useMemo(() => computeSummary(rows.filter(r => !r.imported?.aba), columns), [rows, columns]);

  const persist = useCallback(async (changed: RenewalRow[]) => {
    const key = ['renewal_rows', sheet.id];
    const map = new Map(changed.map(r => [r.row_key, r]));
    qc.setQueryData(key, (old: RenewalRow[] = []) => {
      const next = old.map(r => map.get(r.row_key) ?? r);
      for (const r of changed) if (!old.some(o => o.row_key === r.row_key)) next.push(r);
      return next;
    });
    try { await saveRows(sheet, changed); if (sheet.sent_version && !sheet.dirty) invalidate(sheet.school_id); }
    catch (e: any) { toast.error(`Não salvou: ${e.message}`); qc.invalidateQueries({ queryKey: key }); }
  }, [qc, sheet, invalidate]);

  const onEdits = useCallback((edits: CellEdit[]) => {
    const byRow = new Map<string, RenewalRow>();
    for (const e of edits) {
      const base = byRow.get(e.rowKey) ?? rows.find(r => r.row_key === e.rowKey); const col = columns.find(c => c.id === e.colId);
      if (base && col) byRow.set(e.rowKey, applyEdit(base, col, e.value, user?.email ?? undefined));
    }
    persist([...byRow.values()]);
  }, [rows, columns, persist, user]);

  const onAddRow = () => persist([{ row_key: `manual:${Date.now()}`, imported: {}, overrides: {}, conflicts: {}, sort_order: rows.length, manual: true }]);
  const onResolve = (rowKey: string, colId: string, keep: 'manual' | 'imported') => {
    const r = rows.find(x => x.row_key === rowKey)!; const conflicts = { ...r.conflicts }; delete conflicts[colId];
    const overrides = { ...r.overrides };
    if (keep === 'imported') delete overrides[colId];
    else { const col = columns.find(c => c.id === colId); overrides[colId] = { ...overrides[colId], original: col?.field ? r.imported[col.field] : null }; }
    persist([{ ...r, conflicts, overrides }]);
  };

  const applyColumns = async (scope: 'sheet' | 'template') => {
    if (!pendingCols) return;
    await db.from('renewal_sheets').update({ columns: pendingCols, updated_at: new Date().toISOString(), ...(sheet.sent_version ? { dirty: true } : {}) }).eq('id', sheet.id);
    if (scope === 'template') {
      const base = structure ?? { sheets: ['Renovação'], mainSheet: 'Renovação', summary: { byProfessor: true, byStatus: true, bySituacao: true, formulas: [] }, separateModalities: false, notes: [] } as any;
      const version = (templates[0]?.version ?? 0) + 1;
      const { data, error } = await db.from('renewal_templates').insert({ school_id: sheet.school_id, version, name: `Ajustado na planilha ${sheet.period}`, approved: false, structure: { ...base, columns: pendingCols }, created_by: user?.id }).select().single();
      if (error) { toast.error(error.message); return; }
      await db.from('renewal_templates').update({ approved: false }).eq('school_id', sheet.school_id);
      await db.from('renewal_templates').update({ approved: true }).eq('id', data.id);
      await db.from('renewal_sheets').update({ template_id: data.id }).eq('id', sheet.id);
      toast.success(`Formato salvo como modelo v${version} desta escola (aprovado para as próximas renovações).`);
    } else toast.success('Formato aplicado somente nesta planilha.');
    setPendingCols(null); invalidate(sheet.school_id, sheet.id);
  };

  const exportNow = async () => downloadBuffer(await buildWorkbook(rows, columns, structure), `Renovacao_${sheet.period.replace('/', '-')}_rascunho.xlsx`);

  return (
    <div className="space-y-3">
      {pendingCols && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-accent/10 p-2 text-sm">
          <span className="font-medium">Formato alterado.</span>
          <Button size="sm" onClick={() => applyColumns('sheet')}>Aplicar somente nesta planilha</Button>
          <Button size="sm" variant="outline" onClick={() => applyColumns('template')}>Salvar como novo modelo desta escola</Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingCols(null)}>Descartar</Button>
        </div>
      )}
      {summary.length > 0 && (
        <div className="overflow-auto rounded-xl border border-border bg-card p-3">
          <table className="text-xs"><thead><tr className="text-left text-muted-foreground"><th className="pr-4">Professor</th><th className="pr-4">Turmas</th><th className="pr-4">Alunos</th><th className="pr-4">Renovados</th><th>%</th></tr></thead>
            <tbody>{summary.map(s => <tr key={s.professor}><td className="pr-4 font-medium">{s.professor}</td><td className="pr-4">{s.turmas}</td><td className="pr-4">{s.alunos}</td><td className="pr-4">{s.renovados}</td><td>{s.alunos ? ((s.renovados / s.alunos) * 100).toFixed(1) : '0'}%</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={exportNow}><Download className="mr-1 h-4 w-4" />Baixar Excel (rascunho)</Button></div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Envie os relatórios na etapa 2 para montar a planilha.</p> : (
        <RenewalGrid rows={rows} columns={columns} onEdits={onEdits} onColumnsChange={setPendingCols} onAddRow={onAddRow} onResolveConflict={onResolve} />
      )}
    </div>
  );
}

function DeliveriesPanel({ sheet, templates }: { sheet: RenewalSheet; templates: RenewalTemplate[] }) {
  const { user } = useAuth();
  const invalidate = useInvalidateRenewal();
  const { data: rows = [] } = useRenewalRows(sheet.id);
  const { data: deliveries = [] } = useSheetChildren<any>('renewal_deliveries', sheet.id);
  const { data: versions = [] } = useSheetChildren<any>('renewal_versions', sheet.id, 'version');
  const { data: requests = [] } = useSheetChildren<any>('renewal_change_requests', sheet.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sent_at: new Date().toISOString().slice(0, 10), recipient: '', channel: 'WhatsApp' });
  const [req, setReq] = useState('');
  const [busy, setBusy] = useState(false);
  const structure = templates.find(t => t.id === sheet.template_id)?.structure ?? templates.find(t => t.approved)?.structure ?? null;

  const send = async () => {
    if (!form.recipient.trim()) { toast.error('Informe o destinatário.'); return; }
    setBusy(true);
    try { const v = await registerDelivery(sheet, rows, structure, form, user?.id); toast.success(`Envio registrado. Cópia fixa da v${v} guardada.`); setOpen(false); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); invalidate(sheet.school_id, sheet.id); }
  };
  const addReq = async () => {
    if (!req.trim()) return;
    await db.from('renewal_change_requests').insert({ sheet_id: sheet.id, school_id: sheet.school_id, description: req.trim(), created_by: user?.id });
    await db.from('renewal_sheets').update({ status: 'alteracao_solicitada', updated_at: new Date().toISOString() }).eq('id', sheet.id);
    setReq(''); invalidate(sheet.school_id, sheet.id);
  };
  const resolveReq = async (id: string) => {
    const resolution = prompt('Como foi resolvido?') ?? '';
    await db.from('renewal_change_requests').update({ status: 'resolvido', resolution, resolved_at: new Date().toISOString() }).eq('id', id); invalidate(sheet.school_id, sheet.id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Envios ao cliente</h3>
          <Button size="sm" onClick={() => setOpen(true)} disabled={!rows.length}><Send className="mr-1 h-4 w-4" />Registrar envio</Button>
        </div>
        {sheet.dirty && <p className="rounded-md bg-warning/10 p-2 text-xs text-warning">A planilha mudou depois do último envio (v{sheet.sent_version}). Registrar um novo envio gera a v{(sheet.current_version ?? 0) + 1} e mantém a anterior.</p>}
        {deliveries.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p> : (
          <table className="w-full text-sm"><tbody>{deliveries.map((d: any) => {
            const v = versions.find((x: any) => x.version === d.version);
            return (<tr key={d.id} className="border-t border-border"><td className="py-2">v{d.version}</td><td>{d.sent_at.split('-').reverse().join('/')}</td><td>{d.recipient}</td><td>{d.channel}</td>
              <td className="text-right">{v?.file_path && <Button size="sm" variant="ghost" onClick={() => downloadVersion(v.file_path, `Renovacao_${sheet.period.replace('/', '-')}_v${d.version}.xlsx`)}><FileSpreadsheet className="h-4 w-4" /></Button>}</td></tr>);
          })}</tbody></table>
        )}
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Pedidos de alteração do cliente</h3>
        <div className="flex gap-2"><Textarea rows={2} value={req} onChange={e => setReq(e.target.value)} placeholder="Ex.: incluir coluna de telefone do responsável" /><Button size="sm" onClick={addReq}>Registrar</Button></div>
        {requests.map((r: any) => (
          <div key={r.id} className="flex items-start justify-between gap-2 border-t border-border pt-2 text-sm">
            <div><p>{r.description}</p><p className="text-xs text-muted-foreground">{fmtDT(r.created_at)}{r.resolution ? ` · ${r.resolution}` : ''}</p></div>
            {r.status === 'resolvido' ? <Badge className="bg-success text-success-foreground">Resolvido</Badge> : <Button size="sm" variant="outline" onClick={() => resolveReq(r.id)}>Marcar resolvido</Button>}
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar envio · v{(sheet.current_version ?? 0) + 1}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={form.sent_at} onChange={e => setForm({ ...form, sent_at: e.target.value })} /></div>
            <div className="space-y-1"><Label>Destinatário</Label><Input value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} placeholder="Nome ou e-mail" /></div>
            <div className="space-y-1"><Label>Canal</Label>
              <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['WhatsApp', 'E-mail', 'Drive', 'Outro'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <p className="text-xs text-muted-foreground">Uma cópia fixa do Excel desta versão fica guardada.</p>
          </div>
          <DialogFooter><Button onClick={send} disabled={busy}>{busy ? 'Gerando…' : 'Registrar envio'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
