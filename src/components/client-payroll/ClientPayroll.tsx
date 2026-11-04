import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, Plus, Trash2, Upload, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useSchoolFeature } from '@/hooks/useBankPilot';
import { readPdfTokens } from '@/lib/teamTime/cartaoPontoParser';
import { computeClientPayroll, matchHolerites, parseBRL, parseHoleriteRows, parseHoleriteText, totalDifference, weekdaysInMonth, type HoleriteLine } from '@/lib/clientPayroll';

const db = supabase as unknown as { from: (t: string) => any; storage: typeof supabase.storage };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7); };
const PIX_TIPOS = ['CPF', 'E-mail', 'Telefone', 'Aleatória', 'CNPJ'];

interface Emp { id: string; nome: string; cpf: string | null; cargo: string | null; vr_diario: number; vt_diario: number; recebe_vt: boolean; pix_tipo: string | null; pix_chave: string | null; desligado_em: string | null; ativo: boolean }
interface Mon { id: string; employee_id: string; dias_trabalhados: number | null; liquido: number | null; liquido_origem_upload_id: string | null }
interface Up { id: string; source_file: string; source_kind: string; storage_path: string | null; total_liquido: number; qtd: number; imported_at: string }
interface Preview { file: File; kind: string; lines: HoleriteLine[]; printedTotal: number | null }

async function pdfPages(file: File): Promise<string[][]> {
  const toks = await readPdfTokens(await file.arrayBuffer());
  const pages = new Map<number, Map<number, { x: number; s: string }[]>>();
  for (const t of toks) {
    const p = pages.get(t.page) ?? new Map(); pages.set(t.page, p);
    const y = Math.round(t.y / 3);
    p.set(y, [...(p.get(y) ?? []), { x: t.x, s: t.s }]);
  }
  return [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) =>
    [...p.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a.x - b.x).map(t => t.s).join(' ')));
}

export function ClientPayroll({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const { data: enabled, isLoading: featLoading } = useSchoolFeature(schoolId, 'folha_beneficios');
  const [mes, setMes] = useState(prevMonth());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ['client-payroll', schoolId, mes];

  const q = useQuery({
    queryKey: key, enabled: !!enabled,
    queryFn: async () => {
      const [e, m, u] = await Promise.all([
        db.from('client_employees').select('*').eq('school_id', schoolId).order('nome'),
        db.from('client_payroll_month').select('id,employee_id,dias_trabalhados,liquido,liquido_origem_upload_id').eq('school_id', schoolId).eq('month', mes),
        db.from('client_payroll_uploads').select('*').eq('school_id', schoolId).eq('month', mes).order('imported_at', { ascending: false }),
      ]);
      if (e.error || m.error || u.error) throw e.error || m.error || u.error;
      return { emps: e.data as Emp[], mon: m.data as Mon[], ups: u.data as Up[] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const activate = async () => {
    const { error } = await db.from('school_features').upsert({ school_id: schoolId, feature_key: 'folha_beneficios', enabled: true }, { onConflict: 'school_id,feature_key' });
    if (error) { const r = await db.from('school_features').insert({ school_id: schoolId, feature_key: 'folha_beneficios', enabled: true }); if (r.error) return toast.error('Não foi possível ativar.'); }
    qc.invalidateQueries({ queryKey: ['schoolFeature', schoolId, 'folha_beneficios'] });
  };

  const uteis = weekdaysInMonth(mes);
  const emps = q.data?.emps ?? [];
  const monBy = new Map((q.data?.mon ?? []).map(m => [m.employee_id, m]));
  const activeEmps = emps.filter(e => e.ativo && (!e.desligado_em || e.desligado_em.slice(0, 7) >= mes));
  const rows = useMemo(() => activeEmps.map(e => {
    const m = monBy.get(e.id);
    const dias = m?.dias_trabalhados ?? uteis;
    return { e, m, ...computeClientPayroll({ dias, vrDiario: Number(e.vr_diario), vtDiario: Number(e.vt_diario), recebeVt: e.recebe_vt, liquido: m?.liquido != null ? Number(m.liquido) : null }) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [q.data, uteis]);
  const total = rows.reduce((s, r) => s + r.pix, 0);
  const semHolerite = rows.filter(r => r.m?.liquido == null);

  const saveEmp = async (id: string, patch: Partial<Emp>) => {
    const { error } = await db.from('client_employees').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error('Não foi possível salvar.'); refresh();
  };
  const saveMon = async (employee_id: string, patch: Partial<Mon>) => {
    const { error } = await db.from('client_payroll_month').upsert({ school_id: schoolId, month: mes, employee_id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'school_id,month,employee_id' });
    if (error) toast.error('Não foi possível salvar.'); refresh();
  };
  const addEmp = async (nome = 'Novo funcionário') => {
    const { error } = await db.from('client_employees').insert({ school_id: schoolId, nome });
    if (error) toast.error('Não foi possível adicionar.'); refresh();
  };
  const removeEmp = async (e: Emp) => {
    if (!confirm(`Remover ${e.nome} do cadastro? Para quem saiu, prefira preencher a data de saída.`)) return;
    await db.from('client_employees').delete().eq('id', e.id); refresh();
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf')) {
        const r = parseHoleriteText(await pdfPages(file), emps);
        setPreview({ file, kind: 'pdf', ...r });
      } else {
        const wb = XLSX.read(await file.arrayBuffer());
        const rowsX = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
        setPreview({ file, kind: 'planilha', lines: parseHoleriteRows(rowsX), printedTotal: null });
      }
    } catch { toast.error('Não consegui ler o arquivo. Se o PDF tiver senha, tente de novo informando a senha.'); }
    setBusy(false);
  };

  const match = preview ? matchHolerites(preview.lines, emps) : null;
  const diff = preview ? totalDifference(preview.lines, preview.printedTotal) : 0;

  const confirmImport = async (addMissing: boolean) => {
    if (!preview || !match) return;
    setBusy(true);
    try {
      const path = `${schoolId}/${mes}/${Date.now()}-${preview.file.name.replace(/[^\w.-]/g, '_')}`;
      const st = await supabase.storage.from('client-payroll-files').upload(path, preview.file);
      if (st.error) throw st.error;
      // Subir de novo no mesmo mês substitui o anterior.
      for (const u of q.data?.ups ?? []) {
        if (u.storage_path) await supabase.storage.from('client-payroll-files').remove([u.storage_path]);
        await db.from('client_payroll_uploads').delete().eq('id', u.id);
      }
      const { data: up, error } = await db.from('client_payroll_uploads').insert({
        school_id: schoolId, month: mes, source_file: preview.file.name, source_kind: preview.kind, storage_path: path,
        total_liquido: preview.lines.reduce((s, l) => s + l.liquido, 0), qtd: preview.lines.length,
      }).select('id').single();
      if (error) throw error;
      const pairs = match.matched.map(m => ({ employee_id: m.employee.id, liquido: m.line.liquido }));
      if (addMissing && match.unmatched.length) {
        const { data: novos, error: e2 } = await db.from('client_employees').insert(match.unmatched.map(l => ({ school_id: schoolId, nome: l.nome }))).select('id,nome');
        if (e2) throw e2;
        (novos as { id: string; nome: string }[]).forEach((n, i) => pairs.push({ employee_id: n.id, liquido: match.unmatched[i].liquido }));
      }
      if (pairs.length) {
        const { error: e3 } = await db.from('client_payroll_month').upsert(pairs.map(p => ({ school_id: schoolId, month: mes, ...p, liquido_origem_upload_id: up.id, updated_at: new Date().toISOString() })), { onConflict: 'school_id,month,employee_id' });
        if (e3) throw e3;
      }
      toast.success(`${pairs.length} holerite(s) gravado(s).`);
      setPreview(null); refresh();
    } catch { toast.error('Não foi possível gravar os holerites.'); }
    setBusy(false);
  };

  const deleteUpload = async (u: Up) => {
    if (!confirm('Excluir este upload? Os líquidos que vieram dele serão apagados.')) return;
    if (u.storage_path) await supabase.storage.from('client-payroll-files').remove([u.storage_path]);
    await db.from('client_payroll_uploads').delete().eq('id', u.id); refresh();
  };
  const openFile = async (u: Up) => {
    if (!u.storage_path) return;
    const { data } = await supabase.storage.from('client-payroll-files').createSignedUrl(u.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const copy = () => {
    navigator.clipboard.writeText(rows.map(r => `${r.e.nome}\t${r.e.pix_tipo ?? ''}\t${r.e.pix_chave ?? ''}\t${r.pix.toFixed(2).replace('.', ',')}`).join('\n') + `\nTOTAL\t\t\t${total.toFixed(2).replace('.', ',')}`);
    toast.success('Nome, chave PIX e valor copiados.');
  };
  const download = () => {
    const data = [['Funcionário', 'Cargo', 'Dias trabalhados', 'VR/dia', 'VR', 'VT/dia', 'VT', 'Líquido', 'PIX a pagar', 'Tipo da chave', 'Chave PIX'],
      ...rows.map(r => [r.e.nome, r.e.cargo ?? '', r.dias, Number(r.e.vr_diario), r.vr, Number(r.e.vt_diario), r.vt, r.m?.liquido ?? '', r.pix, r.e.pix_tipo ?? '', r.e.pix_chave ?? '']),
      ['TOTAL', '', '', '', '', '', '', '', total, '', '']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Folha');
    XLSX.writeFile(wb, `folha-beneficios-${mes}.xlsx`);
  };

  if (featLoading) return null;
  if (!enabled) return (
    <div className="mx-auto max-w-lg space-y-3 rounded-lg border border-border bg-card p-6 text-center">
      <h2 className="text-lg font-semibold">Folha e benefícios</h2>
      <p className="text-sm text-muted-foreground">Calcule VR, VT e o PIX de cada funcionário desta empresa a partir dos holerites e dos dias trabalhados. Só a equipe vê; nada entra no resultado ou no caixa.</p>
      <Button onClick={activate}>Ativar nesta empresa</Button>
    </div>
  );

  const th = 'px-2 py-2 font-medium';
  const lastUp = q.data?.ups[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><h2 className="text-lg font-semibold">Folha e benefícios</h2><p className="text-xs text-muted-foreground">Conferência da folha. Não entra em receita, despesa, resultado ou caixa.</p></div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input type="month" className="h-8 w-40" value={mes} onChange={e => e.target.value && setMes(e.target.value)} />
          <label className="inline-flex"><input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"><Upload className="mr-1 h-4 w-4" />{busy ? 'Lendo…' : 'Subir holerites'}</span></label>
          <Button size="sm" variant="outline" onClick={() => addEmp()}><Plus className="mr-1 h-4 w-4" />Funcionário</Button>
          <Button size="sm" variant="outline" onClick={copy} disabled={!rows.length}><Copy className="mr-1 h-4 w-4" />Copiar PIX</Button>
          <Button size="sm" variant="outline" onClick={download} disabled={!rows.length}><Download className="mr-1 h-4 w-4" />Planilha</Button>
        </div>
      </div>

      {lastUp && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <span>Holerites do mês: <button className="font-medium underline" onClick={() => openFile(lastUp)}>{lastUp.source_file}</button> · {lastUp.qtd} holerite(s) · {brl(Number(lastUp.total_liquido))} · {new Date(lastUp.imported_at).toLocaleString('pt-BR')}</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => deleteUpload(lastUp)}><Trash2 className="mr-1 h-3 w-3" />Excluir upload</Button>
        </div>
      )}
      {rows.length > 0 && semHolerite.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-accent bg-accent/10 px-3 py-2 text-xs"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
          <span>Sem líquido neste mês: {semHolerite.map(r => r.e.nome).join(', ')}.</span></div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-xs">
        <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>
          <th className={th}>Funcionário</th><th className={th}>Cargo</th><th className={th}>Dias trab.</th><th className={th}>VR/dia</th><th className={th}>VR</th><th className={th}>Recebe VT</th><th className={th}>VT/dia</th><th className={th}>VT</th><th className={th}>Líquido</th><th className={th}>PIX a pagar</th><th className={th}>Chave PIX</th><th className={th}>Saída</th><th />
        </tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.e.id} className={`border-t border-border ${r.m?.liquido == null ? 'bg-accent/5' : ''}`}>
            <td className="px-2 py-1.5"><Input key={`n-${r.e.id}-${r.e.nome}`} className="h-7 w-44 text-xs font-medium" defaultValue={r.e.nome} onBlur={ev => ev.target.value.trim() && ev.target.value !== r.e.nome && saveEmp(r.e.id, { nome: ev.target.value.trim() })} /></td>
            <td className="px-2"><Input key={`c-${r.e.id}-${r.e.cargo}`} className="h-7 w-28 text-xs" defaultValue={r.e.cargo ?? ''} onBlur={ev => ev.target.value !== (r.e.cargo ?? '') && saveEmp(r.e.id, { cargo: ev.target.value || null })} /></td>
            <td className="px-2"><Input key={`d-${mes}-${r.e.id}-${r.m?.dias_trabalhados}`} className="h-7 w-16 text-xs" placeholder={String(uteis)} defaultValue={fmt(r.m?.dias_trabalhados)} onBlur={ev => { const n = parseBRL(ev.target.value); if (n !== (r.m?.dias_trabalhados ?? null)) saveMon(r.e.id, { dias_trabalhados: n }); }} /></td>
            <td className="px-2"><Input key={`vr-${r.e.id}-${r.e.vr_diario}`} className="h-7 w-20 text-xs" defaultValue={fmt(Number(r.e.vr_diario))} onBlur={ev => { const n = parseBRL(ev.target.value) ?? 0; if (n !== Number(r.e.vr_diario)) saveEmp(r.e.id, { vr_diario: n }); }} /></td>
            <td className="px-2">{brl(r.vr)}</td>
            <td className="px-2"><Switch checked={r.e.recebe_vt} onCheckedChange={v => saveEmp(r.e.id, { recebe_vt: v })} /></td>
            <td className="px-2"><Input key={`vt-${r.e.id}-${r.e.vt_diario}`} className="h-7 w-20 text-xs" disabled={!r.e.recebe_vt} defaultValue={fmt(Number(r.e.vt_diario))} onBlur={ev => { const n = parseBRL(ev.target.value) ?? 0; if (n !== Number(r.e.vt_diario)) saveEmp(r.e.id, { vt_diario: n }); }} /></td>
            <td className="px-2">{brl(r.vt)}</td>
            <td className="px-2"><Input key={`l-${mes}-${r.e.id}-${r.m?.liquido}`} className="h-7 w-24 text-xs" defaultValue={fmt(r.m?.liquido)} onBlur={ev => { const n = parseBRL(ev.target.value); if (n !== (r.m?.liquido ?? null)) saveMon(r.e.id, { liquido: n, liquido_origem_upload_id: null }); }} /></td>
            <td className="px-2 font-semibold">{brl(r.pix)}</td>
            <td className="px-2"><div className="flex gap-1">
              <select className="h-7 rounded-md border border-input bg-background px-1 text-xs" value={r.e.pix_tipo ?? ''} onChange={ev => saveEmp(r.e.id, { pix_tipo: ev.target.value || null })}>
                <option value="">Tipo</option>{PIX_TIPOS.map(t => <option key={t}>{t}</option>)}</select>
              <Input key={`p-${r.e.id}-${r.e.pix_chave}`} className="h-7 w-40 text-xs" placeholder="Chave PIX" defaultValue={r.e.pix_chave ?? ''} onBlur={ev => ev.target.value.trim() !== (r.e.pix_chave ?? '') && saveEmp(r.e.id, { pix_chave: ev.target.value.trim() || null })} />
            </div></td>
            <td className="px-2"><Input type="date" key={`s-${r.e.id}-${r.e.desligado_em}`} className="h-7 w-32 text-xs" defaultValue={r.e.desligado_em ?? ''} onBlur={ev => ev.target.value !== (r.e.desligado_em ?? '') && saveEmp(r.e.id, { desligado_em: ev.target.value || null })} /></td>
            <td className="px-1"><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover" onClick={() => removeEmp(r.e)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={13} className="px-2 py-6 text-center text-muted-foreground">Nenhum funcionário. Suba os holerites para cadastrar automaticamente ou clique em "Funcionário".</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr className="border-t-2 border-border bg-muted/30"><td className="px-2 py-2 font-semibold" colSpan={9}>Total a fazer de PIX ({rows.length} pessoas)</td><td className="px-2 font-bold">{brl(total)}</td><td colSpan={3} /></tr></tfoot>}
      </table></div>
      <p className="text-[11px] text-muted-foreground">Dias trabalhados em branco usam os dias úteis do mês ({uteis}). VR = VR/dia × dias; VT = VT/dia × dias; PIX = líquido + VR + VT.</p>

      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-2xl flex-col">
          <DialogHeader><DialogTitle>Conferência dos holerites</DialogTitle>
            <DialogDescription>{preview?.file.name} · {preview?.lines.length ?? 0} holerite(s) · total {brl(preview?.lines.reduce((s, l) => s + l.liquido, 0) ?? 0)}{preview?.printedTotal != null && ` · total impresso ${brl(preview.printedTotal)}`}</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
            {preview && preview.lines.length === 0 && <p className="text-destructive">Não encontrei holerites neste arquivo. Envie o arquivo para a equipe técnica ajustar a leitura, ou preencha o líquido na tabela.</p>}
            {diff !== 0 && <p className="rounded-md bg-destructive/10 p-2 font-medium text-destructive">A soma dos líquidos difere do total impresso em {brl(diff)}. A gravação está bloqueada. Confira abaixo quais holerites foram lidos.</p>}
            {match && <>
              <div><p className="mb-1 font-semibold">Encontrados no cadastro ({match.matched.length})</p>
                {match.matched.map(m => <div key={m.employee.id} className="flex justify-between border-b border-border py-0.5"><span>{m.employee.nome}</span><span>{brl(m.line.liquido)}</span></div>)}</div>
              {match.unmatched.length > 0 && <div><p className="mb-1 font-semibold">Não estão no cadastro ({match.unmatched.length})</p>
                {match.unmatched.map((l, i) => <div key={i} className="flex justify-between border-b border-border py-0.5"><span>{l.nome}</span><span>{brl(l.liquido)}</span></div>)}</div>}
              {match.missing.filter(e => e.ativo).length > 0 && <p className="text-muted-foreground">Cadastrados sem holerite neste arquivo: {(match.missing as Emp[]).filter(e => e.ativo).map(e => e.nome).join(', ')}.</p>}
            </>}
            {q.data?.ups.length ? <p className="text-muted-foreground">Gravar substitui o upload anterior deste mês.</p> : null}
          </div>
          <DialogFooter className="shrink-0 gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
            {!!match?.unmatched.length && <Button variant="outline" disabled={busy || diff !== 0} onClick={() => confirmImport(false)}>Gravar só os encontrados</Button>}
            <Button disabled={busy || diff !== 0 || !preview?.lines.length} onClick={() => confirmImport(true)}>{match?.unmatched.length ? 'Gravar e cadastrar novos' : 'Gravar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
