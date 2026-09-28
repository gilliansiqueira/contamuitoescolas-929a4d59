import { useBankAccounts, useDataSource } from '@/hooks/useBankPilot';
import { confirmedBankBalance } from '@/lib/bankStatements/confirmedBalance';

/** Fotografia do extrato, independente da previsão de fechamento do mês. */
export function useConfirmedBankBalance(schoolId: string) {
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts(schoolId);
  const { data: source, isLoading: sourceLoading } = useDataSource(schoolId);
  return {
    confirmed: source?.status === 'ativo' && source.dashboard_source === 'fluxo_caixa' && accounts
      ? confirmedBankBalance(accounts) : null,
    isLoading: accountsLoading || sourceLoading,
  };
}