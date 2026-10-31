import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamTime, useTeamJustifications } from '@/hooks/useTeamTime';
import { classifyDay, minToHhmm, hhmmToMin } from '@/components/team/TeamTimePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PAYROLL_COLS, PayrollKey, PayrollValues, PlanItem, hoursFromDays, matchTitular, parseRel0051, planValues } from '@/lib/teamTime/payroll';

const db = supabase as unknown as { from: (t: string) => any };
interface Def { external_id: string; codigo_folha: number | null; nome_folha: string | null; vr: number | null; odonto: number | null }
interface Up { id: string; mes: string; kind: string; competencia: string | null; source_file: string; items: (PlanItem & { external_id: string })[]; ignored: string[]; imported_at: string }
type Pending = { file: string; kind: PlanItem['kind']; competencia: string | null; items: PlanItem[]; pick: Record<string, string> };

const prevMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7); };
const fmtVal = (k: PayrollKey, v: number | null | undefined) => v == null ? '' : PAYROLL_COLS.find(c => c.key === k)!.kind === 'hora' ? minToHhmm(v) : PAYROLL_COLS.find(c => c.key === k)!.kind === 'num' ? String(v) : v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const parseVal = (k: PayrollKey, s: string): number | null => {
  const t = s.trim(); if (!t) return null;
  const kind = PAYROLL_COLS.find(c => c.key === k)!.kind;
  if (kind === 'hora') return hhmmToMin(t.includes(':') ? t : `${t}:00`);
  const n = Number(t.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null;
};

export function PayrollSheetButton() {
  const { isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><FileSpreadsheet className="mr-1 h-4 w-4" />Planilha da contabilidade</Button></DialogTrigger>
      <DialogContent className="max-w-[95vw]">{open && <PayrollSheet canEdit={isSuperAdmin} />}</DialogContent>
    </Dialog>
  );
}

function PayrollSheet({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mes, setMes] = useState(prevMonth());
  const [pending, setPending] = useState<Pending | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tt = useTeamTime(mes, true);
  const just = useTeamJustifications(mes, true);
  const store = useQuery({
    queryKey: ['payroll', mes],
    queryFn: async () => {
      const [d, u, m] = await Promise.all([
        db.from('team_payroll_defaults').select('*').order('nome_folha'),
        db.from('team_payroll_uploads').select('*').eq('mes', mes).order('imported_at'),
        db.from('team_payroll_month').select('external_id,overrides').eq('mes', mes),
      ]);
      const err = [d, u, m].find(x => x.error)?.error; if (err) throw err;
      return { defs: d.data as Def[], ups: u.data as Up[], ovr: Object.fromEntries((m.data ?? []).map((x: any) => [x.external_id, x.overrides])) as Record<string, PayrollValues> };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['payroll', mes] });

  const rows = useMemo(() => {
    if (!store.data || !tt.data) return [];
    const { defs, ups, ovr } = store.data;
    const emp = new Map(tt.data.employees.map(e => [e.external_id, e]));
    const aceitas = new Set((just.data ?? []).filter(j => j.status === 'aceita').map(j => `${j.employee_external_id}|${j.dia}`));
    // Upload mais recente de cada tipo vale para o mês.
    const latest = new Map<string, Up>(); ups.forEach(u => latest.set(u.kind, u));
    const items = [...latest.values()].flatMap(u => u.items);
    return defs.filter(d => emp.has(d.external_id)).map(d => {
      const e = emp.get(d.external_id)!;
      const days = tt.data!.daily.filter(x => x.employee_external_id === d.external_id).map(x => {
        const c = classifyDay(x, e.horario_previsto) as ReturnType<typeof classifyDay> & { atestado?: boolean };
        return { dia: x.dia, faltaDia: c.faltaDia, faltaMin: c.faltaMin, extraMin: c.extraMin, justificada: aceitas.has(`${d.external_id}|${x.dia}`), atestado: c.atestado };
      });
      const auto: PayrollValues = { ...hoursFromDays(days), vr: d.vr, odonto: d.odonto, ...planValues(items, d.external_id) };
      const o = ovr[d.external_id] ?? {};
      return { d, auto, o, v: { ...auto, ...o } as PayrollValues };
    });
  }, [store.data, tt.data, just.data]);

  const saveCell = async (id: string, k: PayrollKey, raw: string) => {
    const r = rows.find(x => x.d.external_id === id)!; const val = parseVal(k, raw);
    if (val === (r.v[k] ?? null)) return;
    if (k === 'vr' || k === 'odonto') {
      const { error } = await db.from('team_payroll_defaults').update({ [k]: val, updated_at: new Date().toISOString() }).eq('external_id', id);
      if (error) return toast.error('Não foi possível salvar.');
      toast.success('Valor fixo atualizado — vale para os próximos meses.');
    } else {
      const o = { ...r.o }; if (val === (r.auto[k] ?? null)) delete o[k]; else o[k] = val;
      const { error } = await db.from('team_payroll_month').upsert({ mes, external_id: id, overrides: o, updated_by: user?.id, updated_at: new Date().toISOString() });
      if (error) return toast.error('Não foi possível salvar.');
    }
    refresh();
  };

  const onFile = async (f: File) => {
    try {
      const html = new TextDecoder('latin1').decode(await f.arrayBuffer());
      const r = parseRel0051(html);
      const people = (store.data?.defs ?? []).map(d => ({ external_id: d.external_id, nomes: [d.nome_folha ?? '', tt.data?.employees.find(e => e.external_id === d.external_id)?.nome ?? ''].filter(Boolean) }));
      const pick: Record<string, string> = {};
      for (const t of new Set(r.items.map(i => i.titular))) { const m = matchTitular(t, people); pick[t] = m.exact ?? m.suggestion ?? ''; }
      setPending({ file: f.name, ...r, pick });
    } catch (e) { toast.error((e as Error).message); }
  };
  const confirmUpload = async () => {
    if (!pending) return;
    const items = pending.items.filter(i => pending.pick[i.titular]).map(i => ({ ...i, external_id: pending.pick[i.titular] }));
    const ignored = [...new Set(pending.items.filter(i => !pending.pick[i.titular]).map(i => i.titular))];
    const { error } = await db.from('team_payroll_uploads').insert({ mes, kind: pending.kind, competencia: pending.competencia, source_file: pending.file, items, ignored, imported_by: user?.id });
    if (error) return toast.error('Não foi possível salvar o relatório.');
    toast.success('Relatório do plano aplicado.'); setPending(null); refresh();
  };
  const delUpload = async (id: string) => { await db.from('team_payroll_uploads').delete().eq('id', id); refresh(); };

  const exportXlsx = async () => {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('PLANILHA');
    const [y, m] = mes.split('-').map(Number);
    ws.getCell('A1').value = 'RELAÇÃO DE VALORES PARA FOLHA DE PAGAMENTO'; ws.getCell('A1').font = { bold: true, size: 12 };
    ws.getCell('A3').value = 'Codigo Empresa:'; ws.getCell('C3').value = 134;
    ws.getCell('A4').value = 'Razão Social:'; ws.getCell('C4').value = 'CONTA MUITO SERVICOS LTDA';
    ws.getCell('A5').value = 'Inscrição Cnpj:'; ws.getCell('C5').value = 38165079000183;
    ws.getCell('A6').value = 'Competencia:'; ws.getCell('C6').value = new Date(Date.UTC(y, m - 1, 1)); ws.getCell('C6').numFmt = 'mm/yyyy';
    ws.getRow(9).values = ['Tipo de', 'Código', 'Nome dos', ...PAYROLL_COLS.map(c => c.label)];
    ws.getRow(10).values = ['Calculo', 'Folha', 'Colaboradores', ...PAYROLL_COLS.map(c => c.code ?? null)];
    [9, 10].forEach(r => { ws.getRow(r).font = { bold: true }; ws.getRow(r).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }; });
    const sorted = [...rows].sort((a, b) => (a.d.nome_folha ?? '').localeCompare(b.d.nome_folha ?? ''));
    sorted.forEach((r, i) => {
      const row = ws.getRow(11 + i);
      row.values = [11, r.d.codigo_folha, r.d.nome_folha, ...PAYROLL_COLS.map(c => { const v = r.v[c.key]; return v == null ? null : c.kind === 'hora' ? v / 1440 : v; })];
      PAYROLL_COLS.forEach((c, j) => { row.getCell(4 + j).numFmt = c.kind === 'hora' ? '[h]:mm' : c.kind === 'valor' ? '#,##0.00' : '0'; });
    });
    const tr = ws.getRow(12 + sorted.length); tr.values = ['TOTAL', sorted.length, 'Colaboradores']; tr.font = { bold: true };
    ws.getColumn(3).width = 38; for (let c = 4; c <= 16; c++) ws.getColumn(c).width = 14; ws.getRow(9).height = 45;
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = `Planilha Folha - CONTA MUITO ${String(m).padStart(2, '0')}-${y}.xlsx`; a.click();
  };

  const people = store.data?.defs ?? [];
  const missingVr = rows.filter(r => r.v.vr == null).map(r => r.d.nome_folha);
  return (
    <div className="space-y-3">
      <DialogHeader><DialogTitle>Planilha da contabilidade</DialogTitle></DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} className="w-40" />
        {canEdit && <><input ref={fileRef} type="file" accept=".xls,.html,.htm" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Enviar relatório do plano</Button></>}
        <Button size="sm" onClick={exportXlsx} disabled={!rows.length}><Download className="mr-1 h-4 w-4" />Baixar planilha</Button>
      </div>

      {(store.data?.ups ?? []).length > 0 && <ul className="space-y-1 text-xs">{store.data!.ups.map(u => (
        <li key={u.id} className="flex items-center gap-2 rounded border border-border px-2 py-1">
          <span className="font-medium">{u.kind === 'mensalidade' ? 'Mensalidade' : 'Coparticipação'}</span>
          <span>competência {u.competencia ?? '—'}</span><span className="text-muted-foreground">{u.source_file}</span>
          {u.ignored.length > 0 && <span className="text-muted-foreground">· fora da folha: {u.ignored.join(', ')}</span>}
          {canEdit && <button className="ml-auto text-destructive" title="Excluir" onClick={() => delUpload(u.id)}><Trash2 className="h-3.5 w-3.5" /></button>}
        </li>))}</ul>}

      {pending && <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
        <p className="font-medium">{pending.kind === 'mensalidade' ? 'Mensalidade' : 'Coparticipação'} · competência {pending.competencia} · confira o vínculo de cada titular</p>
        {Object.keys(pending.pick).map(t => {
          const tot = pending.items.filter(i => i.titular === t).reduce((s, i) => s + i.func, 0);
          const exact = matchTitular(t, people.map(d => ({ external_id: d.external_id, nomes: [d.nome_folha ?? ''] }))).exact;
          return <div key={t} className="flex items-center gap-2">
            <span className="w-64 truncate">{t}</span><span className="w-24 text-right">R$ {tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <select className="rounded border border-input bg-background px-1 py-0.5" value={pending.pick[t]} onChange={e => setPending({ ...pending, pick: { ...pending.pick, [t]: e.target.value } })}>
              <option value="">Fora da folha (ignorar)</option>{people.map(p => <option key={p.external_id} value={p.external_id}>{p.nome_folha}</option>)}
            </select>
            {!exact && pending.pick[t] && <span className="text-warning">nome parecido — confirme</span>}
          </div>;
        })}
        <div className="flex gap-2"><Button size="sm" onClick={confirmUpload}>Aplicar</Button><Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button></div>
      </div>}

      {missingVr.length > 0 && <p className="text-xs text-warning">Sem VR cadastrado: {missingVr.join(', ')}.</p>}
      <p className="text-xs text-muted-foreground">VR e Odontológico são valores fixos: ao alterar, valem para os próximos meses. Os demais ajustes valem só para este mês. DSR, Adiantamento e Outros são preenchidos à mão.</p>
      <div className="max-h-[60vh] overflow-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted"><tr><th className="px-2 py-1 text-left">Cód.</th><th className="px-2 py-1 text-left">Nome</th>{PAYROLL_COLS.map(c => <th key={c.key} className="px-1 py-1 font-medium">{c.label}{c.code ? <div className="text-[10px] text-muted-foreground">{c.code}</div> : null}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.d.external_id} className="border-t border-border">
            <td className="px-2">{r.d.codigo_folha}</td><td className="whitespace-nowrap px-2">{r.d.nome_folha}</td>
            {PAYROLL_COLS.map(c => <td key={c.key} className="px-0.5 py-0.5">
              <input key={`${mes}-${fmtVal(c.key, r.v[c.key])}`} disabled={!canEdit} defaultValue={fmtVal(c.key, r.v[c.key])} onBlur={e => saveCell(r.d.external_id, c.key, e.target.value)}
                className={`w-20 rounded border px-1 py-0.5 text-right ${c.key in r.o ? 'border-warning bg-warning/10' : 'border-transparent bg-transparent'}`} />
            </td>)}
          </tr>)}</tbody>
        </table>
        {(store.isLoading || tt.isLoading) && <p className="p-3 text-xs text-muted-foreground">Carregando…</p>}
      </div>
    </div>
  );
}
