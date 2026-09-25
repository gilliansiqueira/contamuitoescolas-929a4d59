import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, RefreshCw, AlertTriangle, CheckCircle2, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { useCashflowEntries, useDataSource, useResyncCashflow, useSheetFluxoEntries } from '@/hooks/useBankPilot';
import { accountBalances, anchorAdjustments, isAutoInvest, type BankAccount, type BankTx } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, fmtDateTime } from './shared';
import { ActivationPreview } from './ActivationPreview';

interface Props { schoolId: string; accounts: BankAccount[]; txs: BankTx[] }

const STATUS_LABEL: Record<string, string> = { rascunho: 'Rascunho', em_conferencia: 'Em conferência', ativo: 'Ativo', pausado: 'Pausado' };
const r2 = (n: number) => Math.round(n * 100) / 100;
const dayBefore = (d: string) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10); };
const Ok = ({ ok }: { ok: boolean }) => ok ? <CheckCircle2 className="inline h-4 w-4 text-success" /> : <AlertTriangle className="inline h-4 w-4 text-destructive" />;

/** Conferência (só equipe): compara o Fluxo de Caixa novo com a planilha de fluxo realizado, sem alterar nada. */
export function CashflowConference({ schoolId, accounts, txs }: Props) {
  const { data: cfg } = useDataSource(schoolId);
  const [from, setFrom] = useState('2026-09-01');
  const [to, setTo] = useState('2026-09-24');
  const { data: gen = [] } = useCashflowEntries(schoolId, !!cfg);
  const { data: sheetAll = [] } = useSheetFluxoEntries(schoolId, from, to, !!cfg);
  const resync = useResyncCashflow(schoolId);
  const accName = useMemo(() => new Map(accounts.map(a => [a.id, a.nome])), [accounts]);
  const active = accounts.filter(a => a.ativa);

  const data = useMemo(() => {
    const g = gen.filter(e => e.data >= from && e.data <= to);
    const sheet = sheetAll.filter(e => e.source_kind !== 'bank_cashflow');
    const tx = txs.filter(t => t.data >= from && t.data <= to);
    const signed = (tipo: string, v: number) => (tipo === 'entrada' ? 1 : -1) * Math.abs(Number(v));

    const ini = active.reduce((s, a) => s + accountBalances(a, txs, dayBefore(from)).total, 0);
    const fim = active.reduce((s, a) => s + accountBalances(a, txs, to).total, 0);
    const genIn = g.filter(e => e.tipo === 'entrada').reduce((s, e) => s + Number(e.valor), 0);
    const genOut = g.filter(e => e.tipo === 'saida').reduce((s, e) => s + Number(e.valor), 0);
    // Ajustes de saldo conferido (resgate/rendimento que o extrato não trouxe como lançamento)
    const ajusteConferido = active.reduce((s, a) => s + anchorAdjustments(a, txs, from, to), 0);
    const diffSaldo = r2(fim - ini - (genIn - genOut) - ajusteConferido);

    const aClass = g.filter(e => e.tipo_nome === 'A classificar');
    const pend = tx.filter(t => t.recon_status === 'pendente');
    const semPar = tx.filter(t => t.movement_kind === 'transferencia' && !t.transfer_pair_id);
    const pairOut = tx.filter(t => t.transfer_pair_id && !tx.some(o => o.id !== t.id && o.transfer_pair_id === t.transfer_pair_id));
    const splitDiff = tx.filter(t => t.splits?.length && Math.abs(r2(t.splits.reduce((s, p) => s + Number(p.valor), 0)) - r2(Number(t.valor))) > 0.004);
    const auto = tx.filter(isAutoInvest);
    const transf = tx.filter(t => t.transfer_pair_id);

    // Duplicidades no extrato
    const dupKey = new Map<string, BankTx[]>();
    for (const t of tx) { const k = `${t.account_id}|${t.data}|${t.tipo}|${r2(Number(t.valor))}|${t.descricao}`; dupKey.set(k, [...(dupKey.get(k) ?? []), t]); }
    const dups = [...dupKey.values()].filter(l => l.length > 1);

    // Por conta
    const porConta = active.map(a => {
      const at = tx.filter(t => t.account_id === a.id);
      const bi = accountBalances(a, txs, dayBefore(from)), bf = accountBalances(a, txs, to);
      return { a, ini: bi.total, fim: bf.total, n: at.length, ent: at.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0),
        sai: at.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0), last: txs.filter(t => t.account_id === a.id).reduce((m, t) => t.data > m ? t.data : m, '') };
    });

    // Período comum: só compara com a planilha até o último dia lançado nela
    const sheetMax = sheet.reduce((m, e) => e.data > m ? e.data : m, '');
    const cmpTo = sheetMax && sheetMax < to ? sheetMax : to;
    const gCmp = g.filter(e => e.data <= cmpTo);
    const txCmp = tx.filter(t => t.data <= cmpTo);
    const txPost = tx.filter(t => t.data > cmpTo);

    // Por tipo financeiro: Fluxo novo x planilha
    const tipos = new Map<string, { gIn: number; gOut: number; gN: number; sIn: number; sOut: number; sN: number }>();
    const T = (k: string) => { const key = k.trim().toLowerCase(); if (!tipos.has(key)) tipos.set(key, { gIn: 0, gOut: 0, gN: 0, sIn: 0, sOut: 0, sN: 0 }); return tipos.get(key)!; };
    const labelOf = new Map<string, string>();
    for (const e of gCmp) { const k = e.tipo_nome; labelOf.set(k.trim().toLowerCase(), k); const x = T(k); x.gN++; e.tipo === 'entrada' ? x.gIn += Number(e.valor) : x.gOut += Number(e.valor); }
    for (const e of sheet) { const k = e.tipo_original || '(sem tipo)'; if (!labelOf.has(k.trim().toLowerCase())) labelOf.set(k.trim().toLowerCase(), k); const x = T(k); x.sN++; e.tipo === 'entrada' ? x.sIn += Math.abs(Number(e.valor)) : x.sOut += Math.abs(Number(e.valor)); }

    // Por dia (só período comum)
    const dias = new Map<string, { gIn: number; gOut: number; bIn: number; bOut: number; sIn: number; sOut: number }>();
    const D = (d: string) => { if (!dias.has(d)) dias.set(d, { gIn: 0, gOut: 0, bIn: 0, bOut: 0, sIn: 0, sOut: 0 }); return dias.get(d)!; };
    for (const e of gCmp) { const x = D(e.data); e.tipo === 'entrada' ? x.gIn += Number(e.valor) : x.gOut += Number(e.valor); }
    for (const t of txCmp) { const x = D(t.data); t.tipo === 'entrada' ? x.bIn += Number(t.valor) : x.bOut += Number(t.valor); }
    for (const e of sheet) { const x = D(e.data); e.tipo === 'entrada' ? x.sIn += Math.abs(Number(e.valor)) : x.sOut += Math.abs(Number(e.valor)); }

    // Divergências linha a linha: extrato x planilha (mesma data, sentido e valor)
    const pool = new Map<string, typeof sheet>();
    for (const e of sheet) { const k = `${e.data}|${e.tipo}|${r2(Math.abs(Number(e.valor)))}`; pool.set(k, [...(pool.get(k) ?? []), e]); }
    const soExtrato: BankTx[] = [];
    for (const t of txCmp) { const k = `${t.data}|${t.tipo}|${r2(Number(t.valor))}`; const l = pool.get(k); if (l?.length) l.pop(); else soExtrato.push(t); }
    const soPlanilhaRaw = [...pool.values()].flat();
    const divergencias: { tipo: string; data: string; conta: string; descricao: string; valor: number; sentido: string; detalhe: string }[] = [];
    const usedSheet = new Set<string>();
    for (const t of soExtrato) {
      const conta = accName.get(t.account_id) ?? '';
      const near = soPlanilhaRaw.find(e => !usedSheet.has(e.id) && e.tipo === t.tipo && r2(Math.abs(Number(e.valor))) === r2(Number(t.valor)) && Math.abs(new Date(e.data).getTime() - new Date(t.data).getTime()) <= 5 * 86400000);
      if (near) { usedSheet.add(near.id); divergencias.push({ tipo: 'Data diferente', data: t.data, conta, descricao: t.descricao, valor: Number(t.valor), sentido: t.tipo, detalhe: `planilha em ${fmtDate(near.data)}` }); }
      else divergencias.push({ tipo: 'Falta na planilha', data: t.data, conta, descricao: t.descricao, valor: Number(t.valor), sentido: t.tipo, detalhe: isAutoInvest(t) ? 'aplicação automática' : t.transfer_pair_id ? 'transferência interna' : '' });
    }
    for (const e of soPlanilhaRaw) if (!usedSheet.has(e.id)) divergencias.push({ tipo: 'Só na planilha', data: e.data, conta: '', descricao: e.descricao, valor: Math.abs(Number(e.valor)), sentido: e.tipo, detalhe: e.tipo_original ?? '' });
    divergencias.sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));

    const sheetNet = sheet.reduce((s, e) => s + signed(e.tipo, e.valor), 0);
    const semMov = porConta.filter(c => c.n === 0);
    const cmp = {
      bIn: txCmp.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0),
      bOut: txCmp.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0),
      sIn: sheet.filter(e => e.tipo === 'entrada').reduce((s, e) => s + Math.abs(Number(e.valor)), 0),
      sOut: sheet.filter(e => e.tipo === 'saida').reduce((s, e) => s + Math.abs(Number(e.valor)), 0),
    };
    return { g, sheet, tx, ini, fim, genIn, genOut, diffSaldo, aClass, pend, semPar, pairOut, splitDiff, auto, transf, dups, porConta, semMov,
      tipos: [...tipos.entries()].map(([k, v]) => ({ label: labelOf.get(k) ?? k, ...v })).sort((a, b) => (b.gIn + b.gOut + b.sIn + b.sOut) - (a.gIn + a.gOut + a.sIn + a.sOut)),
      dias: [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)), divergencias, sheetNet, sheetMax, cmpTo, txPost, cmp };
  }, [gen, sheetAll, txs, from, to, active, accName]);

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const rows = data.divergencias.map(d => ({ Situação: d.tipo, Data: fmtDate(d.data), Conta: d.conta, Descrição: d.descricao, Sentido: d.sentido === 'entrada' ? 'Entrada' : 'Saída', Valor: d.valor, Detalhe: d.detalhe }));
    const post = data.txPost.map(t => ({ Data: fmtDate(t.data), Conta: accName.get(t.account_id) ?? '', Descrição: t.descricao, Sentido: t.tipo === 'entrada' ? 'Entrada' : 'Saída', Valor: Number(t.valor) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Divergências');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(post), 'Posteriores à planilha');
    XLSX.writeFile(wb, `conferencia_${from}_a_${data.cmpTo}.xlsx`);
  };

  if (!cfg) return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Esta empresa não tem configuração de integração com o Dashboard e o Fluxo Diário.</p>;

  const sum = (l: { valor: number }[]) => l.reduce((s, x) => s + Number(x.valor), 0);
  const card = (label: string, value: string, hint?: string, warn = false) => (
    <div className={`rounded-xl border bg-card p-3 ${warn ? 'border-warning' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-lg font-bold">{value}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
  const attentionCount = data.dups.length + data.splitDiff.length + data.semPar.length + data.pairOut.length;
  const closes = data.diffSaldo === 0;

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${closes ? 'border-success/40 bg-success/10' : 'border-warning bg-warning/10'}`}>
        <div className="flex items-start gap-3">
          {closes ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />}
          <div><p className="font-display text-lg font-bold">{closes ? 'O saldo bancário fecha' : `Há uma diferença de ${fmtBRL(data.diffSaldo)}`}</p>
            <p className="text-xs text-muted-foreground">{data.aClass.length ? `${data.aClass.length} movimentações ainda precisam de classificação.` : 'As movimentações geradas já estão classificadas.'}{attentionCount ? ` ${attentionCount} pontos precisam de revisão.` : ''}</p></div>
        </div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={exportXlsx}><Download className="mr-1 h-4 w-4" />Baixar Excel</Button>
          <Button size="sm" disabled={resync.isPending} onClick={() => resync.mutate(undefined, { onSuccess: n => toast.success(`${n} movimentações sincronizadas`), onError: (e: any) => toast.error(e.message ?? 'Erro') })}><RefreshCw className={`mr-1 h-4 w-4 ${resync.isPending ? 'animate-spin' : ''}`} />Sincronizar</Button></div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="space-y-0.5 text-sm">
          <p><strong>Situação:</strong> <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">{STATUS_LABEL[cfg.status]}</span> · competência inicial {cfg.start_month.split('-').reverse().join('/')}</p>
          <p className="text-xs text-muted-foreground">Fluxo de Caixa atualizado até {fmtDate(cfg.synced_through ?? undefined)} (último dia com extrato em todas as contas ativas) · última sincronização {fmtDateTime(cfg.last_synced_at)}</p>
          {cfg.status !== 'ativo' && <p className="text-xs text-muted-foreground">Enquanto não estiver Ativo, o Dashboard e o Fluxo Diário continuam usando a planilha. Nenhum lançamento antigo é alterado.</p>}
          {cfg.last_error && <p className="text-xs font-semibold text-destructive">Erro na última sincronização: {cfg.last_error}</p>}
        </div>
        <div className="flex items-end gap-2">
          <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={from} min="2026-09-01" onChange={e => setFrom(e.target.value < '2026-09-01' ? '2026-09-01' : e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {card('Saldo inicial (histórico)', fmtBRL(data.ini), `posição de ${fmtDate(dayBefore(from))}, em conta + aplicado`)}
        {card('Entradas geradas', fmtBRL(data.genIn), `${data.g.filter(e => e.tipo === 'entrada').length} linhas`)}
        {card('Saídas geradas', fmtBRL(data.genOut), `${data.g.filter(e => e.tipo === 'saida').length} linhas`)}
        {card('Saldo final', fmtBRL(data.fim), `bancário em ${fmtDate(to)}`)}
        {card('Fechamento do saldo', data.diffSaldo === 0 ? 'Fecha' : fmtBRL(data.diffSaldo), 'inicial + entradas − saídas = final', data.diffSaldo !== 0)}
      </div>

      {cfg.synced_through && <ActivationPreview schoolId={schoolId} cfg={cfg} gen={gen} bankTo={cfg.synced_through}
        bankIni={active.reduce((s, a) => s + accountBalances(a, txs, dayBefore(`${cfg.start_month}-01`)).total, 0)}
        bankFim={active.reduce((s, a) => s + accountBalances(a, txs, cfg.synced_through!).total, 0)} />}


      {(data.dups.length > 0 || data.splitDiff.length > 0 || data.semPar.length + data.pairOut.length > 0) && (
        <section className="rounded-xl border border-warning bg-card p-3 text-sm">
          <h3 className="mb-2 font-semibold">Para revisar</h3>
          {data.dups.map((l, i) => <p key={`d${i}`}>Possível duplicidade: {l.length}× {fmtBRL(Number(l[0].valor))} em {fmtDate(l[0].data)}, {accName.get(l[0].account_id)}: {l[0].descricao}</p>)}
          {data.splitDiff.map(t => <p key={t.id}>Divisão com diferença: {t.descricao} ({fmtDate(t.data)}): banco {fmtBRL(Number(t.valor))}, partes {fmtBRL(t.splits!.reduce((s, p) => s + Number(p.valor), 0))}</p>)}
          {[...data.semPar, ...data.pairOut].map(t => <p key={`t${t.id}`}>Transferência sem a outra ponta: {fmtBRL(Number(t.valor))} em {fmtDate(t.data)}, {accName.get(t.account_id)}: {t.descricao}</p>)}
        </section>
      )}


      <Accordion type="multiple" className="rounded-xl border border-border bg-card px-4">
        <AccordionItem value="sheet"><AccordionTrigger className="text-sm">Comparação com planilhas antigas (só consulta, não é alerta)</AccordionTrigger><AccordionContent><div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 text-sm"><div className="mb-2 flex items-center gap-2"><CalendarRange className="h-4 w-4 text-primary" /><h3 className="font-semibold">Período comparado com a planilha</h3></div>
          <p className="font-medium">{data.sheetMax ? `${fmtDate(from)} a ${fmtDate(data.cmpTo)}` : 'Sem planilha neste período'}</p>
          {data.sheetMax && <p className="mt-1 text-xs text-muted-foreground">Diferença: entradas {fmtBRL(data.cmp.bIn - data.cmp.sIn)} · saídas {fmtBRL(data.cmp.bOut - data.cmp.sOut)}</p>}</section>
        <section className="rounded-xl border border-border bg-card p-4 text-sm"><div className="mb-2 flex items-center gap-2"><CalendarRange className="h-4 w-4 text-muted-foreground" /><h3 className="font-semibold">Depois do fechamento da planilha</h3></div>
          <p className="font-medium">{data.txPost.length} movimentações — não são divergência</p>
          <p className="mt-1 text-xs text-muted-foreground">Entradas {fmtBRL(data.txPost.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0))} · saídas {fmtBRL(data.txPost.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0))}</p></section>
      </div>
      <section className="rounded-xl border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">Divergências no período comparado ({data.divergencias.length})</h3>
        {data.divergencias.length === 0 ? <p className="text-sm text-success">Extrato e planilha batem linha a linha.</p> : (
          <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th>Situação</th><th>Data</th><th>Conta</th><th>Descrição</th><th className="text-right">Valor</th><th>Detalhe</th></tr></thead>
            <tbody>{data.divergencias.map((d, i) => <tr key={i} className="border-t border-border"><td className="py-1 text-xs font-semibold">{d.tipo}</td><td>{fmtDate(d.data)}</td><td className="text-xs">{d.conta}</td><td className="max-w-80 truncate" title={d.descricao}>{d.descricao}</td><td className={`text-right tabular-nums ${d.sentido === 'entrada' ? 'text-success' : 'text-destructive'}`}>{d.sentido === 'entrada' ? '' : '−'}{fmtBRL(d.valor)}</td><td className="text-xs text-muted-foreground">{d.detalhe}</td></tr>)}</tbody></table></div>
        )}
      </section>
        </div></AccordionContent></AccordionItem>

        <AccordionItem value="operational"><AccordionTrigger className="text-sm">Detalhes operacionais</AccordionTrigger><AccordionContent><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {card('Pendentes de conciliação', String(data.pend.length), `${fmtBRL(sum(data.pend))} · já entram nos totais`)}
          {card('A classificar', `${data.aClass.length} · ${fmtBRL(sum(data.aClass))}`, 'somente exceções pendentes', data.aClass.length > 0)}
          {card('Transferências internas', `${data.transf.length}`, 'neutras no consolidado')}
          {card('Aplicações e resgates', `${data.auto.length}`, 'neutros no caixa total')}
          {card('Contas sem movimentação', String(data.semMov.length), data.semMov.length ? data.semMov.map(c => c.a.nome).join(', ') : 'nenhuma')}
        </div></AccordionContent></AccordionItem>

        <AccordionItem value="accounts"><AccordionTrigger className="text-sm">Saldos por conta</AccordionTrigger><AccordionContent>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Por conta</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th>Conta</th><th>Atualizada até</th><th className="text-right">Saldo inicial</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo final</th><th className="text-right">Lançamentos</th></tr></thead>
          <tbody>{data.porConta.map(c => (
            <tr key={c.a.id} className="border-t border-border"><td className="py-1.5">{c.a.nome}</td>
              {c.n === 0
                ? <td className="text-muted-foreground">Sem movimentação no período</td>
                : <td className={c.last && cfg.synced_through && c.last === cfg.synced_through && c.last < to ? 'text-warning' : ''}>{fmtDate(c.last || undefined)}</td>}
              <td className="text-right tabular-nums">{fmtBRL(c.ini)}</td><td className="text-right tabular-nums text-success">{fmtBRL(c.ent)}</td><td className="text-right tabular-nums text-destructive">{fmtBRL(c.sai)}</td><td className="text-right tabular-nums font-semibold">{fmtBRL(c.fim)}</td><td className="text-right">{c.n}</td></tr>
          ))}</tbody>
        </table>
      </section></AccordionContent></AccordionItem>

        <AccordionItem value="types"><AccordionTrigger className="text-sm">Comparação por tipo financeiro</AccordionTrigger><AccordionContent>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Por tipo financeiro: Fluxo de Caixa x planilha ({fmtDate(from)} a {fmtDate(data.cmpTo)})</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th>Tipo</th><th className="text-right">Fluxo: entradas</th><th className="text-right">Fluxo: saídas</th><th className="text-right">Fluxo: qtd.</th><th className="text-right">Planilha: entradas</th><th className="text-right">Planilha: saídas</th><th className="text-right">Planilha: qtd.</th><th /></tr></thead>
          <tbody>{data.tipos.map(t => { const ok = r2(t.gIn) === r2(t.sIn) && r2(t.gOut) === r2(t.sOut); return (
            <tr key={t.label} className="border-t border-border"><td className="py-1.5">{t.label}</td><td className="text-right tabular-nums">{fmtBRL(t.gIn)}</td><td className="text-right tabular-nums">{fmtBRL(t.gOut)}</td><td className="text-right">{t.gN}</td>
              <td className="text-right tabular-nums">{fmtBRL(t.sIn)}</td><td className="text-right tabular-nums">{fmtBRL(t.sOut)}</td><td className="text-right">{t.sN}</td><td className="pl-2"><Ok ok={ok} /></td></tr>); })}</tbody>
        </table>
      </section></AccordionContent></AccordionItem>

        <AccordionItem value="days"><AccordionTrigger className="text-sm">Comparação por dia</AccordionTrigger><AccordionContent>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Por dia</h3>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th>Dia</th><th className="text-right">Extrato: entradas</th><th className="text-right">Extrato: saídas</th><th className="text-right">Geradas: entradas</th><th className="text-right">Geradas: saídas</th><th className="text-right">Planilha: entradas</th><th className="text-right">Planilha: saídas</th><th /></tr></thead>
            <tbody>{data.dias.map(([d, v]) => { const ok = r2(v.bIn) === r2(v.sIn) && r2(v.bOut) === r2(v.sOut); return (
              <tr key={d} className="border-t border-border"><td className="py-1">{fmtDate(d)}</td><td className="text-right tabular-nums">{fmtBRL(v.bIn)}</td><td className="text-right tabular-nums">{fmtBRL(v.bOut)}</td><td className="text-right tabular-nums">{fmtBRL(v.gIn)}</td><td className="text-right tabular-nums">{fmtBRL(v.gOut)}</td><td className="text-right tabular-nums">{fmtBRL(v.sIn)}</td><td className="text-right tabular-nums">{fmtBRL(v.sOut)}</td><td className="pl-2"><Ok ok={ok} /></td></tr>); })}</tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">"Geradas" excluem transferências internas e aplicações automáticas (neutras). A comparação com a planilha vai só até o último dia lançado nela.</p>
      </section></AccordionContent></AccordionItem>
      </Accordion>
    </div>
  );
}
