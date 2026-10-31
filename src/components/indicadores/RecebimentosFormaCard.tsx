import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { recebimentosPorForma } from '@/lib/gestaoIndicadores';
import { useEntityFilter, applyEntityFilterShared, scaleSharedRows } from '@/contexts/GlobalPeriodContext';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted-foreground))'];
const cur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function RecebimentosFormaCard({ schoolId, referenceMonth }: { schoolId: string; referenceMonth?: string }) {
  const [modo, setModo] = useState<'realizado' | 'previsto'>('realizado');
  const [porCnpj, setPorCnpj] = useState(false);
  const entityId = useEntityFilter();
  const { data: rows = [] } = useQuery({
    queryKey: ['recebimentos-forma', schoolId, entityId],
    queryFn: async () => {
      const { fetchAllRows } = await import('@/lib/fetchAll');
      const r = await fetchAllRows<any>('financial_entries', q =>
        applyEntityFilterShared(q.eq('school_id', schoolId).eq('tipo', 'entrada'), entityId), 1000, 'data,valor,tipo_registro,payment_method_key,entity_id');
      return scaleSharedRows(r, entityId, schoolId);
     },
    staleTime: 10 * 60 * 1000,
  });
  const { data: entidades = [] } = useQuery({
    queryKey: ['company-entities-forma', schoolId],
    queryFn: async () => (await supabase.from('company_entities').select('id,nome').eq('school_id', schoolId).order('sort_order')).data ?? [],
    staleTime: 10 * 60 * 1000,
  });

  const ref = referenceMonth || new Date().toISOString().slice(0, 7);
  const selRows = useMemo(() => {
    const sel = (rows as any[]).filter(r => modo === 'realizado'
      ? r.tipo_registro !== 'projetado' && String(r.data).slice(0, 4) === ref.slice(0, 4) && String(r.data).slice(0, 7) <= ref
      : r.tipo_registro === 'projetado' && String(r.data).slice(0, 7) > ref);
    return sel;
  }, [rows, modo, ref]);
  const lista = useMemo(() => recebimentosPorForma(selRows), [selRows]);
  const grupos = useMemo(() => {
    const g = (entidades as any[]).map(e => ({ nome: e.nome, lista: recebimentosPorForma(selRows.filter((r: any) => r.entity_id === e.id)) }));
    const sem = selRows.filter((r: any) => !r.entity_id || !(entidades as any[]).some(e => e.id === r.entity_id));
    if (sem.length) g.push({ nome: 'Sem CNPJ', lista: recebimentosPorForma(sem) });
    return g;
  }, [selRows, entidades]);
  const total = lista.reduce((s, f) => s + f.valor, 0);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <CreditCard className="w-4 h-4 text-primary" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Recebimentos por forma</h3>
            <p className="text-xs text-muted-foreground">
              {modo === 'realizado' ? `Recebido em ${ref.slice(0, 4)} até ${ref.slice(5, 7)}/${ref.slice(0, 4)}` : `A receber depois de ${ref.slice(5, 7)}/${ref.slice(0, 4)}`} · {cur(total)}
            </p>
          </div>
          {!entityId && entidades.length > 1 && (
            <Button size="sm" variant={porCnpj ? 'default' : 'outline'} className="h-7 rounded-lg text-xs" onClick={() => setPorCnpj(v => !v)}>Por CNPJ</Button>
          )}
          <div className="inline-flex rounded-xl border border-input p-0.5">
            {(['realizado', 'previsto'] as const).map(m => (
              <Button key={m} size="sm" variant={modo === m ? 'default' : 'ghost'} className="h-7 rounded-lg text-xs" onClick={() => setModo(m)}>
                {m === 'realizado' ? 'Realizado' : 'Previsto'}
              </Button>
            ))}
          </div>
        </div>
        {!lista.length ? (
          <p className="text-sm text-muted-foreground">Sem recebimentos nesse período.</p>
        ) : porCnpj && !entityId ? (
          <div className="grid gap-4 md:grid-cols-2">
            {grupos.map(g => {
              const t = g.lista.reduce((s, f) => s + f.valor, 0);
              const cartao = g.lista.filter(f => f.forma.startsWith('Cartão')).reduce((s, f) => s + f.valor, 0);
              return (
                <div key={g.nome} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex justify-between text-sm font-semibold"><span>{g.nome}</span><span>{cur(t)}</span></div>
                  <Lista lista={g.lista} />
                  <p className="text-xs text-muted-foreground border-t border-border pt-2">Cartão: {cur(cartao)} ({pct(t ? cartao / t * 100 : 0)}) · Demais formas: {cur(t - cartao)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <Lista lista={lista} />
        )}
        {lista.some(f => f.forma.includes('estimado') || f.forma.startsWith('Asaas')) && (
          <p className="text-xs text-muted-foreground">Ago/set/2026: forma estimada pela descrição (parcelado sem Asaas = cartão; Asaas = boleto ou Pix). Fica exato quando vier a exportação do Tiny com a forma de recebimento.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Lista({ lista }: { lista: { forma: string; valor: number; qtd: number; pct: number }[] }) {
  const cor = (f: string, i: number) => COLORS[f === 'Forma não informada' ? 5 : i % 5];
  return (
    <>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {lista.map((f, i) => <div key={f.forma} style={{ width: `${f.pct}%`, background: cor(f.forma, i) }} title={`${f.forma}: ${pct(f.pct)}`} />)}
      </div>
      <div className="space-y-1.5">
        {lista.map((f, i) => (
          <div key={f.forma} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cor(f.forma, i) }} />
            <span className="flex-1">{f.forma}</span>
            <span className="text-xs text-muted-foreground">{f.qtd} parcelas</span>
            <span className="w-28 text-right">{cur(f.valor)}</span>
            <span className="w-14 text-right font-semibold">{pct(f.pct)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
