# Thauane: retirar a entrada repetida de 07/11

## O que muda
- No dia 07/11 a Thauane tem três batidas: **08:51, 08:56 e 14:46**. As duas primeiras são entradas repetidas.
- A batida das **08:56** passa a ser ignorada, e o dia fica 08:51 → 14:46.
- A batida não é apagada do registro original: só deixa de contar, como já acontece com outras correções. Se precisar, dá para voltar atrás.
- As horas do dia são recalculadas a partir das batidas que sobraram.

## Detalhes técnicos
- Grava `team_time_daily_overrides` (employee_external_id `pf-14`, dia `2026-11-07`, batidas_ignoradas `{08:56}`), o mesmo recurso que a tela usa em `applyIgnoredPunches`. A sincronização não sobrescreve essa marcação.
- Nenhuma mudança de código nem de cálculos financeiros.
