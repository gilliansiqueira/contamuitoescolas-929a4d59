# Corrigir "Aprovar e ativar" (Piracicaba)

## O que aconteceu
Em Piracicaba, o botão marcou a empresa como **Ativo** (saldo inicial R$ 863,69, sincronizado até 25/09). Porém a fonte do Dashboard e do Fluxo Diário continuou em **planilha**. O botão só troca o status e nunca troca a fonte. Em Dourados e nas Uberlândias a fonte tinha sido trocada manualmente, por isso lá funcionou. Os lançamentos do banco de Piracicaba estão todos lá (384), nada se perdeu.

## Correção
1. No botão "Aprovar e ativar": além do status, passar a fonte do Dashboard e do Fluxo Diário para "fluxo de caixa".
2. No botão "Pausar": voltar as duas fontes para "planilha".
3. Consertar Piracicaba agora: trocar só as duas fontes para "fluxo de caixa", sem mexer em nenhum lançamento, e registrar a troca no histórico.
4. Conferir que nenhuma outra empresa ficou "Ativo" com fonte em planilha. Hoje só Piracicaba está assim.
5. Abrir o Fluxo Diário e o Dashboard de Piracicaba em setembro e conferir que os valores aparecem e batem com a prévia.

## Detalhes técnicos
- `useSetDataSourceStatus` (useBankPilot.ts): o patch inclui `dashboard_source`/`daily_flow_source` = `'fluxo_caixa'` quando status for `'ativo'` e `'planilha'` quando for `'pausado'`/`'em_conferencia'`; também invalida as queries do Fluxo Diário/Dashboard.
- Atualizar `school_data_sources` de Piracicaba (0a433a86…) via SQL + registro no `audit_log`.
- Histórico antes de 01/09/2026 intocado.
