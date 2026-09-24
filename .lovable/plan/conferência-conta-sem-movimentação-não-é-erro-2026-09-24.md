# Conferência: conta sem movimentação não é erro

## Contexto
Na aba "Conferência Dashboard" (Fluxo Bancário), contas sem lançamentos no período — como o Bradesco de Dourados — hoje podem aparecer como divergência/alerta. Isso é um falso positivo: um banco pode simplesmente não ter movimentação no mês.

## Mudança
Ajustar `src/components/fluxo-bancario/CashflowConference.tsx`:

1. **Conta sem movimentação = situação normal.**
   - Quando uma conta não tiver nenhum lançamento no período, exibir status neutro "Sem movimentação no período" (cor neutra, sem ícone de alerta/erro).
   - Essa conta não entra na contagem de divergências nem nos totais de pendências.

2. **Divergência só quando há o que comparar.**
   - Alertas de diferença entre extrato e planilha só são gerados quando existe movimentação no extrato, valor na planilha, ou ambos — nunca quando os dois lados estão zerados/ausentes.
   - Se a planilha antiga tiver valor para uma conta sem extrato, isso continua aparecendo como divergência informativa (dado existe de um lado só).

3. **Resumo da conferência.**
   - O resumo do topo passa a mostrar "Contas sem movimentação: N" como informação neutra, separada das divergências reais.

## Fora de escopo
- Nenhuma alteração em cálculos, saldos, sincronização, Dashboard, Fluxo Diário ou dados.
- Nenhuma alteração no status das escolas (seguem "Em conferência").

## Validação
- Conferência de Dourados: conta Bradesco aparece como "Sem movimentação", sem alerta.
- Contas com movimentação e divergências reais continuam sinalizadas normalmente.
- `tsgo --noEmit` sem erros.
