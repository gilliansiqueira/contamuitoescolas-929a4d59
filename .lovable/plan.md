# Desconsiderar batida 09:13 da Isabella em 21/10

Dia 21/10/2026 da Isabella Morais tem 5 batidas: 08:48 · **09:13** · 12:17 · 13:22 · 18:32 (marcado "Marcações Incorretas"). Sem a 09:13 fica 08:48 · 12:17 · 13:22 · 18:32, dia completo.

## O que será feito
1. Guardar "batidas ignoradas" por pessoa/dia, que a atualização do PontoFopag não apaga.
2. Registrar a 09:13 da Isabella em 21/10 como ignorada.
3. Tela do mês, card dela e planilha da contabilidade passam a calcular sem essa batida (mostrada riscada, para consulta).
4. Na aba de detalhes do dia, você (super_admin) ganha a opção "Desconsiderar batida" / "Voltar a considerar" para casos futuros.

## Detalhes técnicos
- Nova coluna `team_time_daily_overrides` (tabela com employee_external_id, dia, batidas_ignoradas text[]), GRANT + RLS: leitura `can_view_team_time()`, escrita `is_super_admin()`.
- Função pura em `src/lib/teamTime/` remove as batidas antes do cálculo, aplicada em `useTeamTime.ts` junto de `applyScheduleOverride`/`beforeTermination`; teste com o dia real dela.
- Recalcular situação do dia a partir das batidas restantes.
