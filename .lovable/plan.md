# Floripa Ingleses: contas a pagar de novembro aparecem zeradas

## O que já conferi
- O envio de hoje (03/11, 15:29, "Contas a Pagar.xls") foi gravado: **47 contas em novembro, R$ 92.601,05**. Bate centavo por centavo com a planilha que você mandou. Dezembro também bate (47 contas, R$ 99.601,05).
- Novembro não tem extrato bancário ainda (os extratos de Itaú e Asaas vão até 30/10), então nada do banco deveria substituir essas contas.
- Ou seja, **o dado está no sistema e o problema é na tela** (linha "Contas a pagar (realizado + previsto)" da Simulação).

## Causa ainda não confirmada
Duas hipóteses:
1. A tela estava aberta antes do envio e não recarregou os valores novos (o envio não avisa a Simulação para atualizar).
2. A regra que junta "realizado + previsto" no mês corrente está descartando a previsão de novembro em empresas com Fluxo Bancário ativo.

## O que vou fazer
1. Abrir a Simulação de Floripa Ingleses na prévia e ver o valor de novembro, comparando com o Fluxo Diário de novembro.
2. Se for a hipótese 1: fazer o envio de contas a pagar (e os demais uploads) atualizarem a Simulação e o Fluxo Diário na hora.
3. Se for a hipótese 2: corrigir a regra para que, sem extrato no mês, a previsão inteira das contas a pagar entre na soma; e conferir as outras empresas com Fluxo Bancário ativo.
4. Registrar a regra num teste automático e conferir na tela que novembro mostra R$ 92.601,05.

## Detalhe técnico
- Linha vem de `useDailyFlowMonthlyTotals` → `buildDailyRows` / `closingEstimate` (`src/lib/dailyFlow.ts`), com fonte do mês por `resolveMonthSource`.
- Invalidação: conferir se o upload de `contas_pagar` invalida as chaves usadas por `useProjectedEntries`, `useEntries` e `usePeriodMovementCtx`.
- Para abrir a tela preciso de uma sessão de teste: sua conta não foi encontrada como usuária desta prévia; vou pedir aprovação para entrar com uma conta da equipe.
