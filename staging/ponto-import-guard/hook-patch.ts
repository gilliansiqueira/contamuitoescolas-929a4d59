// Substituto de useTeamTimeImportReport em src/hooks/useTeamTime.ts (PROMOÇÃO FUTURA).
// Envia também os totais impressos (o servidor confere). Em falha de rede/timeout, NÃO reenvia:
// após timeout, consultar a ação import_status com o mesmo attempt_id; uma nova importação manual usa novo attempt_id e reaplica por upsert (sem duplicar).
// Em ImportCartaoPonto.tsx incluir `totais` no map: ({ codigo, nome, matricula, departamento, funcao, dias, totais }).
/*
export function useTeamTimeImportReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { attempt_id: string; arquivo: string; periodoInicio: string; periodoFim: string; funcionarios: unknown[] }) => {
      const { data, error } = await supabase.functions.invoke('pontofopag-sync', { body: { action: 'import_report', ...payload } });
      if (error) {
        const ctx = (error as any).context; let b: any = null; try { b = await ctx?.json?.(); } catch { }
        if (b?.errors?.length) throw new Error(`Importação bloqueada:\n${b.errors.join('\n')}`);
        throw new Error(b?.message ?? 'Sem resposta do servidor. Verifique o Ponto antes de importar de novo — reenviar o mesmo arquivo não duplica.');
      }
      if (data?.status !== 'success') throw new Error(data?.message ?? 'Erro ao gravar');
      return data as { replay: boolean; counts: { funcionarios: number; dias: number; ocorrencias: number } };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team-time'] }),
  });
}
*/
export {};
