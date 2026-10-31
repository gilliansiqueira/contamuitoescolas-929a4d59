import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Landmark, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEntityFilter } from '@/contexts/GlobalPeriodContext';
import { usePeriodMovementCtx } from '@/hooks/usePeriodMovementCtx';
import { useSchool } from '@/hooks/useFinancialData';
import { novaAncora, saldoCalculadoNaData, totalInformado, type BankBalance } from '@/lib/saldoBancos';

const cur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d.split('-').reverse().join('/');

export function useBankBalances(schoolId: string) {
  return useQuery({
    queryKey: ['bankBalances', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_balances').select('*').eq('school_id', schoolId).order('sort_order');
      if (error) throw error;
      return (data ?? []) as BankBalance[];
    },
    enabled: !!schoolId,
  });
}

export function SaldosBancosCard({ schoolId, compact }: { schoolId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const entityId = useEntityFilter();
  const { data: rows = [] } = useBankBalances(schoolId);
  const { data: school } = useSchool(schoolId);
  const { ctx, isInModel, isLoading } = usePeriodMovementCtx(schoolId);
  const { data: entities = [] } = useQuery({
    queryKey: ['companyEntities', schoolId],
    queryFn: async () => (await supabase.from('company_entities').select('id,nome').eq('school_id', schoolId)).data ?? [],
    enabled: !!schoolId,
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { setDraft({}); }, [rows]);

  const visiveis = useMemo(
    () => entityId && entityId !== 'all' ? rows.filter(r => r.entity_id === entityId || r.entity_id == null) : rows,
    [rows, entityId],
  );
  if (rows.length === 0) return null;

  const refDate = rows.map(r => r.data_ref).sort().at(-1)!;
  const total = totalInformado(rows);
  const totalVisivel = totalInformado(visiveis);
  const calculado = saldoCalculadoNaData(ctx, refDate, { isInModel });
  const diferenca = total - calculado;
  const entName = (id: string | null) => entities.find((e: any) => e.id === id)?.nome ?? 'Compartilhado';

  const salvar = async (r: BankBalance) => {
    const raw = draft[r.id];
    if (raw === undefined) return;
    const v = raw.trim() === '' ? null : Number(raw.replace(/\./g, '').replace(',', '.'));
    if (v !== null && Number.isNaN(v)) { toast.error('Valor inválido'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('bank_balances').update({ saldo: v, data_ref: today }).eq('id', r.id);
    if (error) { toast.error('Não foi possível salvar'); return; }
    qc.invalidateQueries({ queryKey: ['bankBalances', schoolId] });
  };

  const ajustarHistorico = async () => {
    const base = Number(school?.saldoInicial ?? 0);
    const { error } = await supabase.from('schools').update({ saldo_inicial: novaAncora(base, total, calculado) }).eq('id', schoolId);
    if (error) { toast.error('Não foi possível ajustar'); return; }
    toast.success('Histórico de saldo recalculado a partir dos bancos');
    qc.invalidateQueries({ queryKey: ['schools', schoolId] });
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4" /> Saldos em conta e aplicações</h3>
        <span className="text-xs text-muted-foreground">Atualizado em {fmtDate(refDate)}</span>
      </div>
      {!compact && (
        <div className="grid gap-1.5">
          {visiveis.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="truncate">{r.nome}</div>
                <div className="text-xs text-muted-foreground">{r.tipo === 'aplicacao' ? 'Aplicação' : 'Conta'} · {entName(r.entity_id)}</div>
              </div>
              <Input
                className="w-36 h-8 text-right"
                placeholder="a atualizar"
                value={draft[r.id] ?? (r.saldo == null ? '' : Number(r.saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}
                onChange={e => setDraft(d => ({ ...d, [r.id]: e.target.value }))}
                onBlur={() => salvar(r)}
              />
            </div>
          ))}
        </div>
      )}
      <div className="border-t pt-2 space-y-1 text-sm">
        <div className="flex justify-between font-semibold"><span>{entityId && entityId !== 'all' ? 'Total deste CNPJ (com compartilhadas)' : 'Total em bancos + aplicações'}</span><span>{cur(totalVisivel)}</span></div>
        {(!entityId || entityId === 'all') && !isLoading && (
          <>
            <div className="flex justify-between text-muted-foreground"><span>Saldo calculado pelo sistema</span><span>{cur(calculado)}</span></div>
            <div className={`flex justify-between ${Math.abs(diferenca) < 1 ? 'text-success' : 'text-destructive'}`}><span>Diferença</span><span>{cur(diferenca)}</span></div>
            {Math.abs(diferenca) >= 1 && !compact && (
              <Button size="sm" variant="outline" className="w-full mt-1" onClick={ajustarHistorico}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Usar saldo dos bancos e refazer o histórico
              </Button>
            )}
          </>
        )}
        {rows.some(r => r.saldo == null) && <p className="text-xs text-muted-foreground">Contas sem saldo ({rows.filter(r => r.saldo == null).map(r => r.nome).join(', ')}) ainda não entram no total.</p>}
      </div>
    </div>
  );
}
