# Empréstimo: operação no Dashboard, visível no Fluxo Diário e na Simulação

## Diagnóstico (confirmado)
A planilha tem 262 linhas e soma R$ 278.096,97. O sistema importa todas. A diferença de R$ 25.290,62 é exatamente a soma das 8 parcelas de **Empréstimo**, que o modelo da empresa classifica como Operação. Por isso elas não entram no total "Despesas" mostrado na tela de importação.

## O que muda
1. **Tela de importação (Contas a Pagar):** além de Receitas e Despesas, aparece **"Operações: R$ 25.290,62"**, e o total geral do arquivo (R$ 278.096,97) bate com a planilha.
2. **Dashboard inicial / Resultado:** fica como está. Empréstimo continua sendo operação e não entra em Despesa nem no Resultado.
3. **Projeção do Fluxo Diário:** as parcelas de empréstimo aparecem como saídas a pagar em linha própria ("Operações – Empréstimo") no dia de vencimento e descontam do saldo projetado. Antes da mudança vou conferir se hoje elas já descontam o saldo sem aparecer na tela, ou se ficam totalmente de fora.
4. **Simulação:** as saídas de operação (como empréstimo) entram em uma linha separada "Operações (saídas de caixa)" e afetam o caixa simulado, sem somar em Despesas nem no Resultado simulado.

## Detalhes técnicos
- A regra continua no SSOT: `getEffectiveClassification` / `getSaldoImpact`. Nada de recálculo por tela; Fluxo Diário e Simulação apenas exibem o bloco `operacao` que o motor já devolve.
- `DailyFlowTable`/`CashFlow`: separar as linhas `operacao` em grupo próprio e confirmar que o `impacto` entra no saldo.
- `Simulation.tsx` (filtros por volta das linhas 230–250): incluir `operacao` no caixa, mas não em receita/despesa.
- Preview de importação: somar por classificação usando o mesmo utilitário do SSOT.
- Sem mudança no banco de dados. Validação: reimportar o arquivo de Fazenda Rio Grande e conferir 252.806,35 + 25.290,62 = 278.096,97, depois ver as parcelas no Fluxo Diário de out/nov/dez.
