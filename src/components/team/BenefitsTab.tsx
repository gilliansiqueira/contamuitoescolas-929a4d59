import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTeamTime } from '@/hooks/useTeamTime';
import { classifyDay } from '@/components/team/TeamTimePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { businessDays, computeBenefits } from '@/lib/teamTime/benefits';

const db = supabase as unknown as { from: (t: string) => any };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (s: string) => { const t = s.trim(); if (!t) return null; const n = Number(t.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7); };

interface Def { external_id: string; nome_folha: string | null; vr_diario: number | null; recebe_vt: boolean; vt_cartao: boolean }
interface Mon { month: string; dias_uteis: number | null; vt_diario: number; liquidos: Record<string, number> }

export function BenefitsTab() {
  const { isSuperAdmin } = useAuth();
  const canEdit = !!isSuperAdmin;
  const qc = useQueryClient();
  const [mes, setMes] = useState(prevMonth());
  const tt = useTeamTime(mes, true);
  const store = useQuery({
    queryKey: ['benefits', mes],
    queryFn: async () => {
      const [d, m] = await Promise.all([
        db.from('team_payroll_defaults').select('external_id,nome_folha,vr_diario,recebe_vt,vt_cartao'),
        db.from('team_benefit_month').select('*').eq('month', mes).maybeSingle(),
      ]);
      if (d.error || m.error) throw d.error || m.error;
      return { defs: (d.data ?? []) as Def[], mon: (m.data ?? null) as Mon | null };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['benefits', mes] });
  const saveMonth = async (patch: Partial<Mon>) => {
    const cur = store.data?.mon;
    const { error } = await db.from('team_benefit_month').upsert({ month: mes, vt_diario: cur?.vt_diario ?? 12, dias_uteis: cur?.dias_uteis ?? null, liquidos: cur?.liquidos ?? {}, ...patch, updated_at: new Date().toISOString() });
    if (error) toast.error('Não foi possível salvar.'); refresh();
  };
  const saveDef = async (external_id: string, patch: Partial<Def>) => {
    const { error } = await db.from('team_payroll_defaults').upsert({ external_id, ...patch }, { onConflict: 'external_id' });
    if (error) toast.error('Não foi possível salvar.'); refresh();
  };

  const autoDias = businessDays(mes).length;
  const diasMes = store.data?.mon?.dias_uteis ?? autoDias;
  const vtDiario = Number(store.data?.mon?.vt_diario ?? 12);
  const liquidos = store.data?.mon?.liquidos ?? {};

  const rows = useMemo(() => {
    if (!tt.data || !store.data) return [];
    const defs = new Map(store.data.defs.map(d => [d.external_id, d]));
    return tt.data.employees.map(e => {
      const def = defs.get(e.external_id);
      const uteis = businessDays(mes, e.desligado_em);
      const dias = e.desligado_em && e.desligado_em.slice(0, 7) === mes ? uteis.length : Math.min(diasMes, Math.max(diasMes, 0));
      const setUteis = new Set(uteis);
      let faltas = 0, atestados = 0;
      for (const d of tt.data!.daily.filter(x => x.employee_external_id === e.external_id && setUteis.has(x.dia))) {
        const c = classifyDay(d, e.horario_previsto);
        if (c.atestado) atestados++; else if (c.faltaDia) faltas++;
      }
      const liq = liquidos[e.external_id] ?? null;
      const r = computeBenefits({ diasUteis: dias, ausencias: faltas + atestados, vrDiario: def?.vr_diario ?? null, vtDiario, recebeVt: def?.recebe_vt ?? true, vtCartao: def?.vt_cartao ?? false, liquido: liq });
      return { e, def, dias, faltas, atestados, liq, ...r };
    });
  }, [tt.data, store.data, mes, diasMes, vtDiario, liquidos]);

  const total = rows.reduce((s, r) => s + r.pix, 0);
  const copy = () => { navigator.clipboard.writeText(rows.map(r => `${r.e.nome}\t${r.pix.toFixed(2).replace('.', ',')}`).join('\n') + `\nTOTAL\t${total.toFixed(2).replace('.', ',')}`); toast.success('Valores do PIX copiados.'); };
  const download = () => {
    const head = 'Colaboradora;Dias úteis;Faltas;Atestados;Dias pagos;VR;VT;VT no cartão;Líquido;PIX';
    const body = rows.map(r => [r.e.nome, r.dias, r.faltas, r.atestados, r.dias - r.faltas - r.atestados, r.vr, r.vt, r.def?.vt_cartao ? 'sim' : 'não', r.liq ?? '', r.pix].map(v => typeof v === 'number' ? String(v).replace('.', ',') : v).join(';'));
    const blob = new Blob(['\ufeff' + [head, ...body, `TOTAL;;;;;;;;;${String(total).replace('.', ',')}`].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `beneficios-pix-${mes}.csv`; a.click();
  };
  const th = 'whitespace-nowrap px-2 py-2 font-medium';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">Mês<Input type="month" className="mt-1 h-8 w-40" value={mes} onChange={e => e.target.value && setMes(e.target.value)} /></label>
        <label className="text-xs">Dias úteis <span className="text-muted-foreground">(automático: {autoDias})</span>
          <Input key={`du-${mes}-${diasMes}`} className="mt-1 h-8 w-24" disabled={!canEdit} defaultValue={String(diasMes)} onBlur={e => { const n = num(e.target.value); if (n !== diasMes) saveMonth({ dias_uteis: n == null || n === autoDias ? null : Math.round(n) }); }} /></label>
        <label className="text-xs">VT por dia (R$)
          <Input key={`vt-${mes}-${vtDiario}`} className="mt-1 h-8 w-24" disabled={!canEdit} defaultValue={vtDiario.toFixed(2).replace('.', ',')} onBlur={e => { const n = num(e.target.value); if (n != null && n !== vtDiario) saveMonth({ vt_diario: n }); }} /></label>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-1 h-4 w-4" />Copiar PIX</Button>
          <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" />Baixar</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Faltas e atestados vêm do Ponto e descontam VR e VT por dia. PIX = líquido do holerite + VR + VT (sem o VT para quem recebe no cartão). Desligadas contam só até a data de saída.</p>
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Holerites: a leitura automática do PDF com todos os holerites será ligada assim que recebermos um PDF de exemplo. Enquanto isso, preencha o líquido de cada pessoa na tabela.
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-xs">
        <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground"><tr>
          <th className={th}>Colaboradora</th><th className={th}>Dias úteis</th><th className={th}>Faltas</th><th className={th}>Atestados</th><th className={th}>VR/dia</th><th className={th}>VR</th><th className={th}>Recebe VT</th><th className={th}>VT no cartão</th><th className={th}>VT</th><th className={th}>Líquido</th><th className={th}>PIX</th>
        </tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.e.external_id} className="border-t border-border">
            <td className="px-2 py-1.5 font-medium">{r.e.nome}{r.e.desligado_em && <span className="ml-1 text-[10px] text-muted-foreground">(saída {r.e.desligado_em.slice(8, 10)}/{r.e.desligado_em.slice(5, 7)})</span>}</td>
            <td className="px-2">{r.dias}</td><td className="px-2">{r.faltas}</td><td className="px-2">{r.atestados}</td>
            <td className="px-2"><Input key={`vr-${r.e.external_id}-${r.def?.vr_diario}`} className="h-7 w-20 text-xs" disabled={!canEdit} defaultValue={r.def?.vr_diario != null ? String(r.def.vr_diario).replace('.', ',') : ''} onBlur={ev => { const n = num(ev.target.value); if (n !== (r.def?.vr_diario ?? null)) saveDef(r.e.external_id, { vr_diario: n }); }} /></td>
            <td className="px-2">{brl(r.vr)}</td>
            <td className="px-2"><Switch checked={r.def?.recebe_vt ?? true} disabled={!canEdit} onCheckedChange={v => saveDef(r.e.external_id, { recebe_vt: v })} /></td>
            <td className="px-2"><Switch checked={r.def?.vt_cartao ?? false} disabled={!canEdit} onCheckedChange={v => saveDef(r.e.external_id, { vt_cartao: v })} /></td>
            <td className="px-2">{brl(r.vt)}</td>
            <td className="px-2"><Input key={`lq-${mes}-${r.e.external_id}-${r.liq}`} className="h-7 w-24 text-xs" disabled={!canEdit} defaultValue={r.liq != null ? String(r.liq).replace('.', ',') : ''} onBlur={ev => { const n = num(ev.target.value); if (n !== r.liq) { const l = { ...liquidos }; if (n == null) delete l[r.e.external_id]; else l[r.e.external_id] = n; saveMonth({ liquidos: l }); } }} /></td>
            <td className="px-2 font-semibold">{brl(r.pix)}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr className="border-t-2 border-border bg-muted/30"><td className="px-2 py-2 font-semibold" colSpan={10}>Total a fazer de PIX</td><td className="px-2 font-bold">{brl(total)}</td></tr></tfoot>
      </table></div>
    </div>
  );
}
