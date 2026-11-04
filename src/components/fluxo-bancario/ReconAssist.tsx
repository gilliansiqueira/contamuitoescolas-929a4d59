import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInvalidateBank, useSchoolModelItems } from '@/hooks/useBankPilot';
import { fetchAllRows } from '@/lib/fetchAll';
import { buildIndex, suggest, type HistTx } from '@/lib/reconSuggest';
import { threeWayMatch, type Expected } from '@/lib/receiptThreeWayMatch';
import type { BankTx } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate } from './shared';

const db = supabase as any;
const isCardForma = (c: string) => /cart/i.test(c ?? '');

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

export function ReconAssist({ schoolId, txs }: { schoolId: string; txs: BankTx[] }) {
  const qc = useQueryClient();
  const invalidate = useInvalidateBank(schoolId);
  const { data: items = [] } = useSchoolModelItems(schoolId);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const itemName = useMemo(() => new Map(items.map(i => [i.id, i.name])), [items]);

  const extra = useQuery({
    queryKey: ['reconAssistExtra', schoolId],
    queryFn: async () => {
      const rows = await fetchAllRows<any>('bank_transactions', q => q.eq('school_id', schoolId).eq('is_forecast', false), 1000, 'id, recon_source, school_system_status');
      return new Map(rows.map(r => [r.id, r]));
    },
  });
  const network = useQuery({
    queryKey: ['reconNetwork', schoolId],
    queryFn: async () => {
      const { data, error } = await db.rpc('recon_network_patterns', { _school_id: schoolId });
      if (error) throw error;
      return (data ?? []) as { descricao: string; tipo: string; item_name: string; n: number }[];
    },
    staleTime: 30 * 60_000,
  });
  const refresh = () => { invalidate(); qc.invalidateQueries({ queryKey: ['reconAssistExtra', schoolId] }); };

  // ---------- 1. Sugestões ----------
  const suggestions = useMemo(() => {
    const own = buildIndex(txs.filter(t => t.recon_status === 'conciliado' && t.model_item_id && !t.is_forecast)
      .map(t => ({ descricao: t.descricao, tipo: t.tipo, itemId: t.model_item_id! })));
    const byName = new Map(items.map(i => [i.name.toLowerCase(), i.id]));
    const netHist: HistTx[] = [];
    for (const r of network.data ?? []) {
      const id = byName.get(String(r.item_name).toLowerCase());
      if (id) for (let k = 0; k < Math.min(Number(r.n), 50); k++) netHist.push({ descricao: r.descricao, tipo: r.tipo, itemId: id });
    }
    const net = buildIndex(netHist);
    return txs.filter(t => t.recon_status === 'pendente' && !t.is_forecast && !t.transfer_pair_id)
      .map(t => ({ t, s: suggest(t, own, net) }))
      .filter((x): x is { t: BankTx; s: NonNullable<ReturnType<typeof suggest>> } => !!x.s)
      .sort((a, b) => Number(b.s.reliable) - Number(a.s.reliable) || b.s.count - a.s.count);
  }, [txs, items, network.data]);

  const accept = async (list: { t: BankTx; s: { itemId: string; count: number; source: string } }[]) => {
    if (!list.length) return;
    setBusy(true);
    try {
      for (const { t, s } of list) {
        const { error } = await db.from('bank_transactions').update({
          model_item_id: s.itemId, recon_status: 'conciliado', recon_source: 'sugestao',
          recon_note: `Sugestão (${s.source}: ${s.count}x)`,
          school_system_status: t.tipo === 'entrada' ? 'pendente' : null,
        }).eq('id', t.id);
        if (error) throw error;
      }
      toast.success(`${list.length} lançamento(s) conciliado(s) pela sugestão.`);
      refresh();
    } catch { toast.error('Não foi possível aplicar as sugestões.'); }
    setBusy(false);
  };

  // ---------- 2. Cruzamento triplo ----------
  const monthEnd = `${month}-31`;
  const forecasts = useQuery({
    queryKey: ['reconAssistForecast', schoolId, month],
    queryFn: () => fetchAllRows<any>('financial_entries', q => q.eq('school_id', schoolId).eq('tipo_registro', 'projetado')
      .in('origem', ['sponte', 'cartao']).gte('data', `${month}-01`).lte('data', monthEnd), 1000, 'id, data, valor, origem, categoria, tipo'),
  });
  const three = useMemo(() => {
    const f = (forecasts.data ?? []).filter((e: any) => e.tipo !== 'saida');
    const expected: Expected[] = [
      ...f.filter((e: any) => e.origem === 'cartao').map((e: any) => ({ id: e.id, date: e.data, valor: Math.abs(Number(e.valor)), kind: 'cartao' as const })),
      ...f.filter((e: any) => e.origem === 'sponte' && !isCardForma(e.categoria)).map((e: any) => ({ id: e.id, date: e.data, valor: Math.abs(Number(e.valor)), kind: 'boleto_pix' as const })),
    ];
    const cardForecast = f.filter((e: any) => e.origem === 'sponte' && isCardForma(e.categoria)).reduce((s: number, e: any) => s + Math.abs(Number(e.valor)), 0);
    const deposits = txs.filter(t => t.tipo === 'entrada' && !t.is_forecast && !t.transfer_pair_id && t.data >= `${month}-01` && t.data <= addDaysEnd(monthEnd))
      .map(t => ({ id: t.id, date: t.data, valor: Math.abs(Number(t.valor)), descricao: t.descricao }));
    return threeWayMatch(expected, deposits, cardForecast);
  }, [forecasts.data, txs, month, monthEnd]);
  const txById = useMemo(() => new Map(txs.map(t => [t.id, t])), [txs]);
  const toConcile = three.matched.flatMap(m => m.depositIds).filter(id => txById.get(id)?.recon_status === 'pendente');

  const autoConcile = async () => {
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      for (const m of three.matched) {
        const ids = m.depositIds.filter(id => txById.get(id)?.recon_status === 'pendente');
        if (!ids.length) continue;
        const note = m.kind === 'cartao' ? `Repasse da maquininha de ${fmtDate(m.date)}` : `Recebimento previsto de ${fmtDate(m.date)} (boleto/PIX)`;
        const { error } = await db.from('bank_transactions').update({ recon_status: 'conciliado', recon_source: 'automatico', recon_note: note, school_system_status: 'pendente' }).in('id', ids);
        if (error) throw error;
        await db.from('receipt_matches').insert(ids.map(id => ({
          school_id: schoolId, month, bank_transaction_id: id, settlement_total: m.kind === 'cartao' ? m.total : null,
          forecast_total: m.kind === 'boleto_pix' ? m.total : null, bank_total: m.total + m.diferenca, status: 'fechou', diferenca: m.diferenca,
          detalhe: { kind: m.kind, entry_ids: m.ids }, created_by: auth.user?.id ?? null,
        })));
      }
      toast.success(`${toConcile.length} entrada(s) conciliada(s) automaticamente.`);
      refresh();
    } catch { toast.error('Não foi possível conciliar.'); }
    setBusy(false);
  };

  // ---------- 3. Baixa no Omni/Sponte ----------
  const pendingSystem = txs.filter(t => t.tipo === 'entrada' && t.recon_status === 'conciliado' && extra.data?.get(t.id)?.school_system_status === 'pendente');
  const markSystem = async (ids: string[], status: 'baixado' | 'nao_se_aplica') => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db.from('bank_transactions').update({ school_system_status: status, school_system_confirmed_at: new Date().toISOString(), school_system_confirmed_by: auth.user?.id ?? null, school_system_source: 'manual' }).in('id', ids);
    if (error) { toast.error('Não foi possível marcar.'); return; }
    toast.success(status === 'baixado' ? 'Marcado como baixado no sistema da escola.' : 'Marcado como não se aplica.');
    refresh();
  };

  // ---------- 4. Ganho ----------
  const gain = useMemo(() => {
    const c = { automatico: 0, sugestao: 0, manual: 0 };
    for (const t of txs) if (t.recon_status === 'conciliado') {
      const src = extra.data?.get(t.id)?.recon_source;
      if (src === 'automatico') c.automatico++; else if (src === 'sugestao') c.sugestao++; else c.manual++;
    }
    return c;
  }, [txs, extra.data]);

  const reliable = suggestions.filter(x => x.s.reliable);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[['Automáticas', gain.automatico], ['Por sugestão', gain.sugestao], ['Manuais', gain.manual]].map(([l, n]) => (
          <div key={l as string} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Conciliações {String(l).toLowerCase()}</p><strong className="text-xl">{n as number}</strong></div>
        ))}
      </div>

      <Section title="Recebimentos: previsão × maquininha × banco" hint="Liga o repasse da maquininha e os recebimentos de boleto/PIX previstos às entradas do banco (até 2 dias úteis).">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-9 w-44 text-xs" />
          <Button size="sm" disabled={busy || !toConcile.length} onClick={autoConcile}><Check className="mr-1 h-4 w-4" />Conciliar o que fechou ({toConcile.length})</Button>
        </div>
        <div className="mb-3 grid gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-success/10 p-2">Fechou: <strong>{three.matched.length}</strong></div>
          <div className="rounded-md bg-warning/15 p-2">Sem depósito: <strong>{three.missing.length}</strong> ({fmtBRL(three.missing.reduce((s, m) => s + m.total, 0))})</div>
          <div className="rounded-md bg-destructive/10 p-2">Depósito sem previsão: <strong>{three.unexpectedDeposits.length}</strong></div>
          <div className="rounded-md bg-muted p-2">Cartão previsto (Sponte/Omni) {fmtBRL(three.cardForecastTotal)} × repasse {fmtBRL(three.cardSettlementTotal)}</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div><p className="mb-1 text-xs font-medium">Previsto sem entrada no banco</p>
            <div className="max-h-72 space-y-1 overflow-y-auto">{three.missing.map(m => (
              <div key={m.date + m.kind + m.ids[0]} className="flex justify-between rounded border border-border px-2 py-1 text-xs"><span>{fmtDate(m.date)} · {m.kind === 'cartao' ? 'Repasse maquininha' : 'Boleto/PIX'} ({m.ids.length})</span><strong>{fmtBRL(m.total)}</strong></div>
            ))}{!three.missing.length && <p className="text-xs text-muted-foreground">Nada pendente.</p>}</div>
          </div>
          <div><p className="mb-1 text-xs font-medium">Entrada no banco sem previsão</p>
            <div className="max-h-72 space-y-1 overflow-y-auto">{three.unexpectedDeposits.map(d => (
              <div key={d.id} className="flex justify-between gap-2 rounded border border-border px-2 py-1 text-xs"><span className="truncate">{fmtDate(d.date)} · {d.descricao}</span><strong>{fmtBRL(d.valor)}</strong></div>
            ))}{!three.unexpectedDeposits.length && <p className="text-xs text-muted-foreground">Nenhuma.</p>}</div>
          </div>
        </div>
      </Section>

      <Section title="Sugestões de classificação" hint="Aprendidas com o que a equipe já conciliou. Confiável = 3 ou mais vezes igual na própria empresa, sem divergência. Sugestões da rede precisam de confirmação.">
        <Button size="sm" className="mb-3" disabled={busy || !reliable.length} onClick={() => accept(reliable)}><Sparkles className="mr-1 h-4 w-4" />Aceitar sugestões confiáveis ({reliable.length})</Button>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {suggestions.slice(0, 200).map(({ t, s }) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
              <span className="w-20 text-muted-foreground">{fmtDate(t.data)}</span>
              <span className="min-w-0 flex-1 truncate" title={t.descricao}>{t.descricao}</span>
              <strong>{fmtBRL(Math.abs(Number(t.valor)))}</strong>
              <span className="rounded bg-muted px-1.5 py-0.5">{itemName.get(s.itemId) ?? '—'}</span>
              <span className={s.reliable ? 'text-success' : 'text-muted-foreground'}>{s.source === 'rede' ? 'sugestão da rede' : `${s.count}x de ${s.total}`}</span>
              <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={busy} onClick={() => accept([{ t, s }])}>Aceitar</Button>
            </div>
          ))}
          {!suggestions.length && <p className="text-xs text-muted-foreground">Nenhuma sugestão para os pendentes.</p>}
        </div>
      </Section>

      <Section title="Falta baixar no Omni/Sponte" hint="Entradas conciliadas que ainda não foram confirmadas como baixadas no sistema da escola. A conciliação só fica completa depois da baixa.">
        {pendingSystem.length > 0 && <Button size="sm" variant="outline" className="mb-2" onClick={() => markSystem(pendingSystem.map(t => t.id), 'baixado')}>Marcar todas como baixadas ({pendingSystem.length})</Button>}
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {pendingSystem.map(t => (
            <div key={t.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
              <span className="w-20 text-muted-foreground">{fmtDate(t.data)}</span>
              <span className="min-w-0 flex-1 truncate">{t.descricao}</span>
              <strong>{fmtBRL(Math.abs(Number(t.valor)))}</strong>
              <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => markSystem([t.id], 'baixado')}>Baixei no sistema</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => markSystem([t.id], 'nao_se_aplica')}>Não se aplica</Button>
            </div>
          ))}
          {!pendingSystem.length && <p className="text-xs text-muted-foreground">Nada pendente de baixa.</p>}
        </div>
      </Section>
    </div>
  );
}

/** Depósitos de até 2 dias úteis após o fim do mês ainda pertencem aos repasses do mês. */
function addDaysEnd(monthEnd: string): string {
  const [y, m] = monthEnd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  last.setUTCDate(last.getUTCDate() + 4);
  return last.toISOString().slice(0, 10);
}
