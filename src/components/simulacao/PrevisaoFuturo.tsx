import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { useRealizedEntries } from '@/hooks/useRealizedEntries';
import { useBankBalances } from '@/components/dashboard/SaldosBancosCard';
import { totalInformado } from '@/lib/saldoBancos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CENTROS_ECO, calcularBase2025, calcularPrevisao, mesesPrevisao, modelosExpedicoes, valoresMes, valoresExpedicaoMes, PRO_LABORE_2026_PADRAO, FOLHA_2026_PADRAO, type Premissas, type CentroEco } from '@/lib/previsao';

const ESCRITORIO_CONTAS = ['Escritório', 'Programas', 'Contabilidade', 'Material de escritório'];
const ECO_ENTITY_NOME = /ecoturismo/i;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fm = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const cur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function NumField({ label, value, onChange, suffix, expense = true }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; expense?: boolean }) {
  return (
    <label className="space-y-1 text-xs">
      <span className={expense ? 'text-destructive' : 'text-muted-foreground'}>{label}</span>
      <div className="flex items-center gap-1">
        <Input aria-label={label} type="number" min={0} className={`h-8 text-xs ${expense ? 'text-destructive' : ''}`} value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

const ROTULO = { expReceita: 'Receita expedições (editável)', expCusto: '(−) Custo expedições (editável)', proLabore: 'Pró-labore por sócio (editável)', folha: 'Folha de pagamento (editável)', impostosExtra: '(−) Impostos (simulação, editável)' } as const;

export function PrevisaoFuturo({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const meses = useMemo(() => mesesPrevisao('2026-10', '2027-12'), []);
  const { data: realized = [] } = useRealizedEntries(schoolId, 'all');
  const { data: bancos = [] } = useBankBalances(schoolId);

  const { data: fonte } = useQuery({
    queryKey: ['previsao-fonte', schoolId],
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [{ data: groups }, { data: entities }] = await Promise.all([
        supabase.from('expense_detail_groups').select('id,name').eq('school_id', schoolId),
        supabase.from('company_entities').select('id,nome').eq('school_id', schoolId),
      ]);
      const name = new Map((groups || []).map(g => [g.id, g.name]));
      const trips = await fetchAllRows<any>('expense_detail_trips', q => q.eq('school_id', schoolId).gte('trip_date', '2025-01-01').lt('trip_date', '2027-01-01'));
      const items = await fetchAllRows<any>('expense_detail_items', q => q.eq('school_id', schoolId).gte('data', '2025-01-01').lt('data', '2027-01-01'));
      const proj = await fetchAllRows<any>('financial_entries', q => q.eq('school_id', schoolId).eq('tipo_registro', 'projetado').eq('tipo', 'entrada').gte('data', '2026-10-01'));
      const expedicoes: Record<string, number> = {};
      proj.forEach(e => {
        const d = e.descricao || ''; if (!/expedi/i.test(d)) return;
        const m = String(e.data).slice(0, 7);
        // Em 2027, parcelas de viagens de 2027+ já estão na cópia de 2026
        const ano = d.match(/\(([^)]*?)(20\d\d)\)/)?.[2];
        if (m >= '2027-01' && ano && ano >= '2027') return;
        expedicoes[m] = (expedicoes[m] ?? 0) + Math.abs(Number(e.valor) || 0);
      });
      const ecoNomes = new Set(['Caiaques', 'Montanhas', 'Passeios Locais', 'Outros Passeios', 'A classificar']);
      const baseExp = { receita: {} as Record<string, number>, custo: {} as Record<string, number> };
      items.forEach(i => {
        const g = name.get(i.group_id) || ''; if (!g || ecoNomes.has(g) || !String(i.data).startsWith('2026')) return;
        const k = i.tipo === 'receita' ? 'receita' : i.tipo === 'despesa' ? 'custo' : null; if (!k) return;
        const mm = String(i.data).slice(5, 7); baseExp[k][mm] = (baseExp[k][mm] ?? 0) + Math.abs(Number(i.valor) || 0);
      });
      // Caixa: despesas de expedições pela data do pagamento; receita estimada no mesmo ritmo
      const totR = Object.values(baseExp.receita).reduce((s, v) => s + v, 0);
      const totC = Object.values(baseExp.custo).reduce((s, v) => s + v, 0);
      const EXP_RE = /atacama|uyuni|peru|patag|equador|guatemala/i;
      const caixa: Record<string, number> = {};
      const add = (d: string, v: number) => { const mm = String(d).slice(5, 7); caixa[mm] = (caixa[mm] ?? 0) + Math.abs(Number(v) || 0); };
      const re = await fetchAllRows<any>('realized_entries', q => q.eq('school_id', schoolId).eq('tipo', 'despesa').gte('data', '2026-01-01').lt('data', '2026-08-01'));
      re.forEach(e => { if (EXP_RE.test(`${e.descricao} ${e.complemento ?? ''}`)) add(e.data, e.valor); });
      const fe = await fetchAllRows<any>('financial_entries', q => q.eq('school_id', schoolId).eq('tipo_registro', 'realizado').eq('tipo', 'saida').gte('data', '2026-08-01').lt('data', '2027-01-01'));
      fe.forEach(e => { if (EXP_RE.test(`${e.descricao} ${e.tipo_original ?? ''}`)) add(e.data, e.valor); });
      if (totC > 0 && Object.keys(caixa).length) {
        const totCx = Object.values(caixa).reduce((s, v) => s + v, 0); const ratio = totR / totCx;
        baseExp.custo = caixa;
        baseExp.receita = Object.fromEntries(Object.entries(caixa).map(([m, v]) => [m, Math.round(v * ratio * 100) / 100]));
      }
      const ecoId = (entities || []).find(e => ECO_ENTITY_NOME.test(e.nome))?.id ?? null;
      // Mês corrente pelo caixa: realizado até hoje + previsto depois
      const hoje = new Date().toISOString().slice(0, 10); const mesAtual = hoje.slice(0, 7);
      const doMes = await fetchAllRows<any>('financial_entries', q => q.eq('school_id', schoolId).gte('data', `${mesAtual}-01`).lte('data', `${mesAtual}-31`));
      const at = { receitaEco: 0, custoEco: 0, receitaExp: 0, custoExp: 0, fixos: 0 };
      doMes.forEach(e => {
        const d = String(e.data); const real = e.tipo_registro === 'realizado';
        if (real ? d > hoje : d <= hoje) return;
        const v = Math.abs(Number(e.valor) || 0);
        const eco = e.entity_id ? e.entity_id === ecoId : !EXP_RE.test(`${e.descricao} ${e.tipo_original ?? ''}`);
        if (e.tipo === 'entrada') { if (eco) at.receitaEco += v; else at.receitaExp += v; }
        else if (e.tipo === 'saida') { if (!e.entity_id) at.fixos += v; else if (eco) at.custoEco += v; else at.custoExp += v; }
      });
      const atual = doMes.length ? { [mesAtual]: at } : {};
      const hist = await fetchAllRows<any>('historical_monthly', q => q.eq('school_id', schoolId).gte('month', '2025-01').lte('month', '2025-12'));
      const caixa2025 = { receita: Array(12).fill(0), despesa: Array(12).fill(0) };
      hist.forEach(h => { const i = Number(String(h.month).slice(5, 7)) - 1; if (h.tipo_valor === 'receita') caixa2025.receita[i] += Number(h.valor) || 0; else if (h.tipo_valor === 'despesa') caixa2025.despesa[i] += Number(h.valor) || 0; });
      return { atual, caixa2025,
        trips: trips.map(t => ({ group_name: name.get(t.group_id) || '', trip_date: t.trip_date, paying_people: t.paying_people, revenue: t.revenue })),
        items: items.map(i => ({ group_name: name.get(i.group_id) || '', data: i.data, tipo: i.tipo, valor: i.valor })),
        expedicoes, baseExp, ecoId, centros: (groups || []).map(g => g.name),
      };
    },
  });

  const { data: salvo, isFetched } = useQuery({
    queryKey: ['simulation_assumptions', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from('simulation_assumptions').select('data').eq('school_id', schoolId).maybeSingle();
      if (error) throw error;
      return (data?.data as unknown as Premissas) || null;
    },
  });

  const base = useMemo(() => {
    if (!fonte) return null;
    // Escritório: média mensal dos últimos 6 meses com lançamentos
    const porMes = new Map<string, number>();
    (realized as any[]).forEach(e => {
      if (e.tipo !== 'despesa' || !ESCRITORIO_CONTAS.includes(e.conta_nome)) return;
      const m = String(e.data).slice(0, 7); porMes.set(m, (porMes.get(m) ?? 0) + Math.abs(Number(e.valor) || 0));
    });
    const ult = Array.from(porMes.keys()).sort().slice(-6);
    const escritorio = ult.length ? Math.round(ult.reduce((s, m) => s + (porMes.get(m) ?? 0), 0) / ult.length) : 0;
    // Impostos da Ecoturismo em 2025 ÷ receita dos centros de ecoturismo em 2025
    const impostos = (realized as any[]).filter(e => e.tipo === 'despesa' && e.conta_nome === 'Impostos' && e.entity_id === fonte.ecoId && String(e.data).startsWith('2025'))
      .reduce((s, e) => s + Math.abs(Number(e.valor) || 0), 0);
    const recEco = fonte.items.filter(i => i.data.startsWith('2025') && i.tipo === 'receita' && (CENTROS_ECO as readonly string[]).includes(i.group_name)).reduce((s, i) => s + Math.abs(Number(i.valor) || 0), 0);
    const impostoPct = recEco > 0 ? Math.round((impostos / recEco) * 10000) / 100 : 0;
    return calcularBase2025(fonte.trips, fonte.items, { escritorio, impostoPct, anoValores: { 'Passeios Locais': '2026' } });
  }, [fonte, realized]);

  const modelos = useMemo(() => fonte ? modelosExpedicoes(fonte.trips, fonte.items, fonte.centros, '2026') : [], [fonte]);
  const defaults = useMemo(() => base ? { ...base.premissas, novasExpedicoes: modelos.map(m => ({
    id: `modelo:${m.centro}`, centro: m.centro, nome: m.centro, participantes: 0,
    ticket: m.ticket, custoPessoa: m.custoPessoa,
    entradasPct: { [meses[0]]: 100 }, saidasPct: { [meses[0]]: 100 },
  })) } : null, [base, modelos, meses]);

  const [p, setP] = useState<Premissas | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  useEffect(() => { if (!p && defaults && isFetched) setP(salvo ? { ...defaults, ...salvo, centros: { ...defaults.centros, ...(salvo.centros || {}) } } : defaults); }, [defaults, salvo, isFetched, p]);

  const timer = useRef<number>();
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const persist = (next: Premissas) => {
    saveQueue.current = saveQueue.current.then(async () => {
      const { error } = await supabase.from('simulation_assumptions').upsert({ school_id: schoolId, data: next as any, updated_at: new Date().toISOString() }, { onConflict: 'school_id' });
      if (error) { setSaveStatus('Não foi possível salvar. Tente novamente.'); return; }
      qc.setQueryData(['simulation_assumptions', schoolId], next);
      setSaveStatus('Alterações salvas');
    }).catch(() => setSaveStatus('Não foi possível salvar. Tente novamente.'));
  };
  const update = (next: Premissas) => {
    setP(next);
    setSaveStatus('Salvando…');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist(next), 600);
  };
  const setCentro = (c: CentroEco, k: 'ticket' | 'custoPessoa' | 'ajustePct', v: number) => p && update({ ...p, centros: { ...p.centros, [c]: { ...p.centros[c], [k]: v } } });

  const linhas = useMemo(() => (base && p && fonte ? calcularPrevisao(base, p, meses, fonte.expedicoes, fonte.baseExp, { atual: fonte.atual, caixa2025: fonte.caixa2025 }) : []), [base, p, fonte, meses]);
  const saldoBancos = bancos.length ? totalInformado(bancos) : null;
  const saldoRef = bancos.length ? bancos.map(b => b.data_ref).sort().at(-1)!.split('-').reverse().join('/') : '';

  if (!base || !p) return <div className="glass-card rounded-xl p-5 text-sm text-muted-foreground">Carregando previsão…</div>;

  type TotalKey = 'receitaEco' | 'custoPasseios' | 'impostos' | 'fixos' | 'expedicoes' | 'novasExpedicoes' | 'custoExpedicoes' | 'impostosExtra' | 'brutoEco' | 'brutoExp' | 'resultado' | 'resultadoEco';
  const total = (k: TotalKey) => linhas.reduce((s, l) => s + l[k], 0);
  const Row = ({ label, k, neg, bold }: { label: string; k: TotalKey | 'acumulado'; neg?: boolean; bold?: boolean }) => (
    <tr className={`border-t border-border/30 ${bold ? 'bg-muted/30 font-semibold' : ''}`}>
      <td className={`sticky left-0 bg-card px-2 py-1.5 ${neg ? 'text-destructive' : ''}`}>{label}</td>
      {linhas.map(l => { const v = (neg ? -1 : 1) * l[k]; return <td key={l.month} className={`px-2 py-1.5 text-right ${neg || v < 0 ? 'text-destructive' : bold ? 'text-success' : ''}`}>{cur(v)}</td>; })}
      <td className={`px-2 py-1.5 text-right font-semibold ${neg || (k === 'acumulado' ? (linhas.at(-1)?.acumulado ?? 0) : total(k)) < 0 ? 'text-destructive' : bold ? 'text-success' : ''}`}>{k === 'acumulado' ? cur(linhas.at(-1)?.acumulado ?? 0) : cur((neg ? -1 : 1) * total(k))}</td>
    </tr>
  );

  return (
    <div className="glass-card rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Previsão do futuro (out/2026 a dez/2027)</h3>
          <p className="text-xs text-muted-foreground">Ecoturismo igual a 2025 (participantes do mesmo mês × ticket), despesas fixas e recebimentos já vendidos das expedições. Altere qualquer número: a previsão é refeita e salva na hora.</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { if (defaults && window.confirm('Restaurar os valores sugeridos e zerar as novas expedições simuladas?')) update(defaults); }}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Voltar aos valores de 2025</Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">{saveStatus}{saveStatus.startsWith('Não') && <Button size="sm" variant="outline" onClick={() => update(p)}>Tentar novamente</Button>}</div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Despesas fixas por mês</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumField label="Escritório" value={p.escritorio} onChange={v => update({ ...p, escritorio: v })} />
          <NumField label="Pró-labore até dez/2026" value={p.proLaboreSocio2026 ?? PRO_LABORE_2026_PADRAO} onChange={v => update({ ...p, proLaboreSocio2026: v })} />
          <NumField label="Pró-labore a partir de jan/2027" value={p.proLaboreSocio} onChange={v => update({ ...p, proLaboreSocio: v })} />
          <NumField label="Nº de sócios" expense={false} value={p.socios} onChange={v => update({ ...p, socios: Math.floor(v) })} />
          <NumField label="Folha até dez/2026" value={p.folha2026 ?? FOLHA_2026_PADRAO} onChange={v => update({ ...p, folha2026: v })} />
          <NumField label="Folha a partir de jan/2027" value={p.folha} onChange={v => update({ ...p, folha: v })} />
          <NumField label="Marketing" value={p.marketing} onChange={v => update({ ...p, marketing: v })} />
          <NumField label="Impostos Ecoturismo" value={p.impostoPct} onChange={v => update({ ...p, impostoPct: v })} suffix="%" />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Pró-labore é por sócio. Para mudar um mês específico, edite direto na tabela abaixo. Escritório sugerido pela média dos últimos 6 meses · impostos pela alíquota efetiva da Ecoturismo em 2025.</p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Ecoturismo por centro (base 2025)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="px-2 py-1 text-left">Centro</th><th className="px-2 py-1 text-right">Participantes 2025</th><th className="px-2 py-1">Ticket médio</th><th className="px-2 py-1">Custo por pessoa</th><th className="px-2 py-1">Ajuste de público</th></tr></thead>
            <tbody>
              {CENTROS_ECO.map(c => (
                <tr key={c} className="border-t border-border/30">
                  <td className="px-2 py-1.5 font-medium">{c}</td>
                  <td className="px-2 py-1.5 text-right">{base.pessoas[c].reduce((s, n) => s + n, 0).toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-1"><Input type="number" className="h-8 text-xs" value={p.centros[c].ticket} onChange={e => setCentro(c, 'ticket', Number(e.target.value) || 0)} /></td>
                  <td className="px-2 py-1"><Input type="number" min={0} className="h-8 text-xs text-destructive" value={p.centros[c].custoPessoa} onChange={e => setCentro(c, 'custoPessoa', Math.max(0, Number(e.target.value) || 0))} /></td>
                  <td className="px-2 py-1"><div className="flex items-center gap-1"><Input type="number" className="h-8 text-xs" value={p.centros[c].ajustePct} onChange={e => setCentro(c, 'ajustePct', Number(e.target.value) || 0)} /><span className="text-muted-foreground">%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Base 2025 da Ecoturismo:</span>
        <Button size="sm" className="h-7 text-xs" variant={(p.baseEco ?? 'competencia') === 'competencia' ? 'default' : 'outline'} onClick={() => update({ ...p, baseEco: 'competencia' })}>Competência</Button>
        <Button size="sm" className="h-7 text-xs" variant={p.baseEco === 'caixa' ? 'default' : 'outline'} onClick={() => update({ ...p, baseEco: 'caixa' })}>Caixa</Button>
        <span className="text-muted-foreground">{p.baseEco === 'caixa' ? 'Mesmo total do ano, distribuído nos meses como o dinheiro entrou e saiu em 2025.' : 'Cada passeio conta no mês em que acontece.'}</span>
      </div>
      {linhas.some(l => l.real) && <p className="text-xs font-medium text-primary">{linhas.filter(l => l.real).map(l => fm(l.month)).join(', ')} = realizado até hoje + previsto até o fim do mês (pelo caixa).</p>}
      <p className="text-xs text-muted-foreground">Expedições de 2027 repetem o caixa do mesmo mês de 2026. Receita estimada por caixa até termos os recebimentos de 2026.</p>
      <div className="overflow-x-auto" aria-label="Resumo mensal da previsão">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border bg-surface"><th className="sticky left-0 bg-surface px-2 py-2 text-left min-w-[200px]">Linha</th>{linhas.map(l => <th key={l.month} className="px-2 py-2 text-right min-w-[84px]">{fm(l.month)}</th>)}<th className="px-2 py-2 text-right min-w-[96px]">Total</th></tr></thead>
          <tbody>
            {CENTROS_ECO.map(c => (
              <tr key={c} className="border-t border-border/30 text-muted-foreground">
                <td className="sticky left-0 bg-card px-2 py-1.5">Receita {c}</td>
                {linhas.map(l => <td key={l.month} className="px-2 py-1.5 text-right" title={`${l.porCentro[c].pessoas} participantes`}>{cur(l.porCentro[c].receita)}</td>)}
                <td className="px-2 py-1.5 text-right">{cur(linhas.reduce((s, l) => s + l.porCentro[c].receita, 0))}</td>
              </tr>
            ))}
            <Row label="Receita Ecoturismo" k="receitaEco" bold />
            <Row label="Expedições já vendidas / parcelas de expedições anteriores" k="expedicoes" />
            <Row label="(−) Custo dos passeios" k="custoPasseios" neg />
            <Row label="(−) Impostos Ecoturismo" k="impostos" neg />
            {(['expReceita', 'expCusto', 'impostosExtra', 'proLabore', 'folha'] as const).map(campo => (
              <tr key={campo} className="border-t border-border/30">
                <td className={`sticky left-0 bg-card px-2 py-1.5 ${campo === 'expReceita' ? '' : 'text-destructive'}`}>{ROTULO[campo]}</td>
                {linhas.map(l => {
                  const exp = campo === 'expReceita' || campo === 'expCusto';
                  const ajustado = p.ajustesMes?.[l.month]?.[campo] !== undefined;
                  const ve = valoresExpedicaoMes(p, l.month, fonte?.baseExp);
                  const valor = campo === 'expReceita' ? ve.receita : campo === 'expCusto' ? ve.custo : campo === 'impostosExtra' ? l.impostosExtra : valoresMes(p, l.month)[campo];
                  return (
                    <td key={l.month} className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <Input type="number" min={0} aria-label={`${ROTULO[campo]} ${fm(l.month)}`}
                          className={`h-7 min-w-[76px] px-1 text-right text-xs ${campo === 'expReceita' ? '' : 'text-destructive'} ${ajustado ? 'border-primary bg-primary/10' : ''}`}
                          value={valor}
                          onChange={e => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            const atual = p.ajustesMes?.[l.month] || {};
                            update({ ...p, ajustesMes: { ...(p.ajustesMes || {}), [l.month]: { ...atual, [campo]: v } } });
                          }} />
                        {ajustado && <button type="button" title="Voltar ao valor padrão (2026)" className="text-muted-foreground hover:text-foreground"
                          onClick={() => { const { [campo]: _, ...resto } = p.ajustesMes?.[l.month] || {}; update({ ...p, ajustesMes: { ...(p.ajustesMes || {}), [l.month]: resto } }); }}>
                          <RotateCcw className="h-3 w-3" /></button>}
                      </div>
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 text-right font-semibold ${campo === 'expReceita' ? '' : 'text-destructive'}`}>{cur((campo === 'expReceita' ? 1 : -1) * linhas.reduce((s, l) => s + (campo === 'expReceita' ? l.novasExpedicoes : campo === 'expCusto' ? l.custoExpedicoes : campo === 'impostosExtra' ? l.impostosExtra : l[campo]), 0))}</td>
              </tr>
            ))}
            <Row label="Resultado bruto Ecoturismo (receita − custo direto)" k="brutoEco" bold />
            <Row label="Resultado bruto Expedições (receita − custo direto)" k="brutoExp" bold />
            {([['Margem bruta Ecoturismo', 'brutoEco', (l: any) => l.receitaEco], ['Margem bruta Expedições', 'brutoExp', (l: any) => l.expedicoes + l.novasExpedicoes]] as const).map(([lab, k, rec]) => {
              const tot = linhas.reduce((s, l) => s + rec(l), 0); const pct = (v: number, r: number) => r > 0 ? `${((v / r) * 100).toFixed(1).replace('.', ',')}%` : '—';
              return (
                <tr key={lab} className="border-t border-border/30 text-muted-foreground">
                  <td className="sticky left-0 bg-card px-2 py-1.5">{lab} (%)</td>
                  {linhas.map(l => <td key={l.month} className={`px-2 py-1.5 text-right ${l[k] < 0 ? 'text-destructive' : ''}`}>{pct(l[k], rec(l))}</td>)}
                  <td className="px-2 py-1.5 text-right font-semibold">{pct(total(k), tot)}</td>
                </tr>
              );
            })}
            <Row label="(−) Despesas fixas" k="fixos" neg />
            <Row label="Resultado previsto" k="resultado" bold />
            <Row label="Resultado Ecoturismo (com sua parte das fixas)" k="resultadoEco" bold />
            {fonte?.caixa2025 && (
              <tr className="border-t border-border/30 text-muted-foreground">
                <td className="sticky left-0 bg-card px-2 py-1.5">Conferência: caixa 2025 real (mesmo mês)</td>
                {linhas.map(l => { const i = Number(l.month.slice(5, 7)) - 1; const v = fonte.caixa2025.receita[i] - fonte.caixa2025.despesa[i]; return <td key={l.month} className={`px-2 py-1.5 text-right ${v < 0 ? 'text-destructive' : ''}`}>{cur(v)}</td>; })}
                <td className="px-2 py-1.5 text-right">—</td>
              </tr>
            )}
            <Row label="Acumulado" k="acumulado" bold />
            {saldoBancos !== null && (
              <tr className="border-t border-border/30 bg-muted/30 font-semibold">
                <td className="sticky left-0 bg-card px-2 py-1.5">Saldo em caixa projetado (bancos {saldoRef})</td>
                {linhas.map(l => { const v = saldoBancos + l.acumulado; return <td key={l.month} className={`px-2 py-1.5 text-right ${v < 0 ? 'text-destructive' : 'text-success'}`}>{cur(v)}</td>; })}
                <td className="px-2 py-1.5 text-right">{cur(saldoBancos + (linhas.at(-1)?.acumulado ?? 0))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Expedições de 2027 repetem a receita e o custo do mesmo mês de 2026 (Centro de Custos). Parcelas já previstas de viagens de 2027 não são somadas, pois já estão na cópia; parcelas de viagens anteriores entram. Em out a dez/2026, receita e custo das expedições começam em zero e podem ser preenchidos.</p>
    </div>
  );
}
