import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseBRNumber } from '@/lib/bankStatements/parsers';
import type { BankAccount } from '@/lib/bankStatements/bankCashflowEngine';
import { fmtBRL, fmtDate, todayIso } from './shared';

const db = supabase as any;

/**
 * Saldo conferido com o extrato: vira o ponto de partida do saldo da conta a
 * partir daquela data. Nenhum lançamento importado é alterado; pode ser desfeito.
 */
export function BalanceAnchorControl({ schoolId, account }: { schoolId: string; account: BankAccount }) {
  const qc = useQueryClient();
  const anchors = [...(account.anchors ?? [])].sort((a, b) => b.data.localeCompare(a.data));
  const refresh = () => qc.invalidateQueries({ queryKey: ['bankAccounts', schoolId] });

  const add = async () => {
    const dataBr = prompt(`${account.nome}: data do saldo conferido no extrato (dd/mm/aaaa)`, fmtDate(todayIso()));
    if (!dataBr) return;
    const m = dataBr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return toast.error('Data inválida. Use dd/mm/aaaa.');
    const data = `${m[3]}-${m[2]}-${m[1]}`;
    if (data < '2026-09-01') return toast.error('Só é possível conferir saldos a partir de 01/09/2026.');
    const conta = prompt('Saldo em conta nessa data (R$)', '0,00');
    if (conta == null) return;
    let aplic = '0';
    if (account.has_auto_invest) {
      const a = prompt('Saldo aplicado nessa data (R$)', '0,00');
      if (a == null) return;
      aplic = a;
    }
    const saldo_conta = parseBRNumber(conta), saldo_aplicado = parseBRNumber(aplic);
    if (!Number.isFinite(saldo_conta) || !Number.isFinite(saldo_aplicado)) return toast.error('Valor inválido.');
    const { error } = await db.from('bank_account_balances').upsert(
      { school_id: schoolId, account_id: account.id, data, saldo_conta, saldo_aplicado, origem: 'conferencia' },
      { onConflict: 'account_id,data' });
    if (error) return toast.error(error.message);
    toast.success('Saldo conferido registrado');
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Desfazer este saldo conferido? A conta volta a ser calculada só pelos lançamentos.')) return;
    const { error } = await db.from('bank_account_balances').delete().eq('id', id).eq('origem', 'conferencia');
    if (error) return toast.error(error.message);
    toast.success('Saldo conferido desfeito');
    refresh();
  };

  return (
    <div className="mt-1 space-y-0.5 text-[11px]">
      {anchors.map(a => (
        <p key={a.id} className="text-primary">
          Saldo conferido em {fmtDate(a.data)}: {fmtBRL(Number(a.saldo_conta) + Number(a.saldo_aplicado))}
          {' '}<button className="underline text-muted-foreground" onClick={() => remove(a.id)}>desfazer</button>
        </p>
      ))}
      <button className="underline text-muted-foreground hover:text-foreground" onClick={add}>Informar saldo conferido</button>
    </div>
  );
}
