import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, CreditCard, ShoppingCart, AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CARD_FIELDS, detectHeader, parseCardSheet, suspectLines, type ColumnMap, type CardSheetResult } from '@/lib/cardSheetParse';
import { fmtBRL, fmtDate } from './shared';

const db = supabase as any;
type Kind = 'recebimento' | 'venda';
const ADQ = ['Stone', 'Cielo', 'Getnet', 'Rede', 'PagSeguro', 'Mercado Pago', 'SafraPay', 'Sicredi', 'Asaas', 'Sponte', 'Omni', 'Outra'];

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function Uploader({ schoolId, kind, onDone }: { schoolId: string; kind: Kind; onDone: () => void }) {
  const { user } = useAuth() as any;
  const [adq, setAdq] = useState('');
  const [file, setFile] = useState<{ name: string; hash: string; rows: unknown[][] } | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ColumnMap>({});
  const [saving, setSaving] = useState(false);

  const pick = async (f: File) => {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const det = detectHeader(rows);
    let m = det.map;
    if (adq) {
      const { data } = await db.from('card_sheet_imports').select('column_map').eq('school_id', schoolId).eq('kind', kind).eq('adquirente', adq).order('imported_at', { ascending: false }).limit(1);
      const saved = data?.[0]?.column_map as ColumnMap | undefined;
      if (saved && Object.keys(saved).length >= Object.keys(m).length) m = saved;
    }
    setFile({ name: f.name, hash: await sha256(buf), rows }); setHeaderRow(det.headerRow); setMap(m);
  };

  const res: CardSheetResult | null = file ? parseCardSheet(file.rows, headerRow, map, kind) : null;
  const useBruto = map.bruto !== undefined;
  const blocked = !res || !adq || res.rows.length === 0 || Math.abs(res.diff) >= 0.01 || (map.bruto === undefined && map.liquido === undefined);
  const header = file ? (file.rows[headerRow] ?? []).map(c => String(c ?? '')) : [];

  const save = async () => {
    if (!res || !file || blocked) return;
    setSaving(true);
    try {
      // Reenvio do mesmo período/adquirente substitui só os envios anteriores contidos nesse período.
      const { data: old } = await db.from('card_sheet_imports').select('id,period_from,period_to').eq('school_id', schoolId).eq('kind', kind).eq('adquirente', adq);
      const replace = (old ?? []).filter((o: any) => o.period_from && o.period_from >= res.from! && o.period_to <= res.to!).map((o: any) => o.id);
      if (replace.length) await db.from('card_sheet_imports').delete().in('id', replace);
      const { data: imp, error } = await db.from('card_sheet_imports').insert({
        school_id: schoolId, kind, adquirente: adq, source_file: file.name, file_hash: file.hash,
        period_from: res.from, period_to: res.to, rows_count: res.rows.length,
        total_bruto: res.totalBruto, total_liquido: res.totalLiquido, column_map: map, uploaded_by: user?.id ?? null,
      }).select('id,imported_at').single();
      if (error) throw new Error(error.code === '23505' ? 'Este arquivo já foi enviado.' : error.message);
      const payload = res.rows.map(r => ({
        school_id: schoolId, origem_upload_id: imp.id, source_kind: kind, source_file: file.name, imported_at: imp.imported_at,
        adquirente: adq, data_venda: r.data_venda, data_pagamento: r.data_pagamento, bruto: r.bruto, taxa: r.taxa, liquido: r.liquido,
        bandeira: r.bandeira, forma: r.forma, parcela: r.parcela, nsu: r.nsu, row_key: r.row_key, raw: r.raw,
      }));
      let novas = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const { data, error: e } = await db.from('card_sheet_rows').upsert(payload.slice(i, i + 500), { onConflict: 'school_id,source_kind,adquirente,row_key', ignoreDuplicates: true }).select('id');
        if (e) { await db.from('card_sheet_imports').delete().eq('id', imp.id); throw new Error(e.message); }
        novas += data?.length ?? 0;
      }
      await db.from('card_sheet_imports').update({ rows_count: novas }).eq('id', imp.id);
      toast.success(`${novas} linhas gravadas${novas < payload.length ? ` (${payload.length - novas} já existiam)` : ''}.`);
      setFile(null); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={adq} onValueChange={setAdq}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder={kind === 'venda' ? 'Origem das vendas' : 'Adquirente'} /></SelectTrigger>
          <SelectContent>{ADQ.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <Button asChild variant="outline" size="sm" disabled={!adq}>
          <label className={adq ? 'cursor-pointer' : 'pointer-events-none opacity-50'}>
            <Upload className="mr-1 h-4 w-4" /> Enviar planilha
            <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
          </label>
        </Button>
        {!adq && <span className="text-xs text-muted-foreground">Escolha primeiro de onde é a planilha.</span>}
      </div>

      {file && res && (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium text-foreground">Conferência — {file.name}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat l="Linhas" v={String(res.rows.length)} />
            <Stat l="Total bruto" v={fmtBRL(res.totalBruto)} />
            <Stat l="Total líquido" v={fmtBRL(res.totalLiquido)} />
            <Stat l="Período" v={res.from ? `${fmtDate(res.from)} a ${fmtDate(res.to!)}` : '—'} />
          </div>
          {res.fileTotal !== null && Math.abs(res.diff) >= 0.01 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
              <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" /> O total do arquivo ({fmtBRL(res.fileTotal)}, linha {res.fileTotalLine}) não bate com a soma das linhas — diferença {fmtBRL(res.diff)}. Importação bloqueada.</p>
              {suspectLines(res, useBruto).length > 0 && <p className="mt-1 text-xs">Linhas que explicam a diferença: {suspectLines(res, useBruto).map(r => r.line).join(', ')}</p>}
            </div>
          )}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary"><ChevronDown className="h-3 w-3" /> Colunas reconhecidas</CollapsibleTrigger>
            <CollapsibleContent className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CARD_FIELDS.map(f => (
                <label key={f.key} className="text-xs text-muted-foreground">{f.label}
                  <Select value={map[f.key] === undefined ? 'none' : String(map[f.key])} onValueChange={v => setMap(m => { const n = { ...m }; if (v === 'none') delete n[f.key]; else n[f.key] = Number(v); return n; })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">— não usar —</SelectItem>{header.map((h, i) => h && <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              ))}
            </CollapsibleContent>
          </Collapsible>
          <Breakdown title="Por forma / bandeira" data={res.porForma} />
          <Breakdown title={kind === 'recebimento' ? 'Por dia de pagamento' : 'Por dia da venda'} data={res.porDia} date />
          {res.skipped.length > 0 && <Collapsible><CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground"><ChevronDown className="h-3 w-3" /> {res.skipped.length} linhas fora da importação</CollapsibleTrigger>
            <CollapsibleContent className="mt-1 text-xs text-muted-foreground">{res.skipped.map(s => <div key={s.line}>Linha {s.line}: {s.motivo}</div>)}</CollapsibleContent></Collapsible>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={blocked || saving}>{saving ? 'Gravando…' : 'Confirmar e gravar'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ l, v }: { l: string; v: string }) => <div className="rounded-md bg-card p-2"><p className="text-[10px] uppercase text-muted-foreground">{l}</p><p className="font-semibold text-foreground">{v}</p></div>;

function Breakdown({ title, data, date }: { title: string; data: CardSheetResult['porForma']; date?: boolean }) {
  const keys = Object.keys(data).sort();
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary"><ChevronDown className="h-3 w-3" /> {title} ({keys.length})</CollapsibleTrigger>
      <CollapsibleContent className="mt-1 max-h-60 overflow-auto">
        <table className="w-full text-xs"><tbody>{keys.map(k => <tr key={k} className="border-b border-border/50"><td className="py-1">{date ? fmtDate(k) : k}</td><td className="text-right">{data[k].qtd}</td><td className="text-right">{fmtBRL(data[k].bruto)}</td><td className="text-right">{fmtBRL(data[k].liquido)}</td></tr>)}</tbody></table>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Section({ schoolId, kind, title, icon: Icon, hint }: { schoolId: string; kind: Kind; title: string; icon: any; hint: string }) {
  const qc = useQueryClient();
  const key = ['card_sheet_imports', schoolId, kind];
  const { data: imports = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await db.from('card_sheet_imports').select('*').eq('school_id', schoolId).eq('kind', kind).order('imported_at', { ascending: false }).limit(30)).data ?? [],
  });
  const del = async (id: string) => {
    if (!confirm('Excluir este envio e todas as linhas dele?')) return;
    const { error } = await db.from('card_sheet_imports').delete().eq('id', id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: key });
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle><p className="text-xs text-muted-foreground">{hint}</p></CardHeader>
      <CardContent className="space-y-3">
        <Uploader schoolId={schoolId} kind={kind} onDone={() => qc.invalidateQueries({ queryKey: key })} />
        {imports.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-left">Arquivo</th><th className="text-left">Origem</th><th className="text-left">Período</th><th className="text-right">Linhas</th><th className="text-right">Bruto</th><th /></tr></thead>
            <tbody>{imports.map((i: any) => (
              <tr key={i.id} className="border-t border-border/50">
                <td className="max-w-[200px] truncate py-1" title={i.source_file}>{i.source_file}</td><td>{i.adquirente}</td>
                <td>{fmtDate(i.period_from)} a {fmtDate(i.period_to)}</td><td className="text-right">{i.rows_count}</td><td className="text-right">{fmtBRL(Number(i.total_bruto))}</td>
                <td className="text-right"><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
              </tr>))}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

/** Aba "Cartões": planilhas das adquirentes e de vendas, só para conferência (não entram em receita, despesa nem saldo). */
export function CardSheetsPanel({ schoolId }: { schoolId: string }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Material de conferência dos cartões. Nada aqui altera receitas, despesas ou saldo — o valor oficial continua vindo do extrato.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section schoolId={schoolId} kind="recebimento" title="Recebimentos das adquirentes" icon={CreditCard} hint="Planilha de recebimentos/agenda da maquininha (Stone, Cielo, Getnet…)." />
        <Section schoolId={schoolId} kind="venda" title="Vendas" icon={ShoppingCart} hint="Relatório de vendas da maquininha ou do Sponte/Omni." />
      </div>
    </div>
  );
}
