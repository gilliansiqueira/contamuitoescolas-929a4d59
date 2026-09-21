# Comparativo: fazer 2025 aparecer

## O que está acontecendo

Verifiquei os dados do Dourados no banco:

- Relatório Realizado (despesas lançadas): 2.407 registros em 2025 (jan a dez) e 1.633 em 2026.
- Faturamento mensal: 12 meses de 2025 e 8 meses de 2026.
- Projeção / fluxo (a base que a aba Comparativo está usando hoje): **começa só em abril de 2026**.

Ou seja: os dados de 2025 existem, mas estão no Relatório Realizado, e a aba Comparativo foi montada em cima da base de projeção. Por isso o período de 2025 aparece zerado, mesmo com os meses selecionáveis na lista.

## O que vou mudar

Passar o Comparativo a ler as mesmas informações do Relatório Realizado, que é onde está o histórico:

- **Receita** do mês: o faturamento informado no Realizado.
- **Despesa** do mês: a soma dos lançamentos do Realizado.
- **Resultado**: receita menos despesa.
- Quando um mês não tiver Realizado (mês ainda em aberto), cai automaticamente para a projeção daquele mês, com uma marcação discreta de "projetado" para não confundir.

Ajustes na tela:

- O quarto cartão passa de "Saldo de caixa" (que só existe na projeção, a partir de abr/2026) para **Margem do resultado (%)**, comparável entre os dois períodos.
- Os três gráficos mês a mês passam a usar a mesma base, então as linhas de 2025 aparecem.
- A tabela de variação por categoria continua igual (já lê o Realizado e já funciona).
- Um aviso curto quando algum mês escolhido não tiver nenhum dado, dizendo quais meses estão vazios.

## Detalhes técnicos

`src/components/comparativo/ComparativoPeriodos.tsx`:

- Novas consultas: `monthly_revenue` (receita por mês) e reuso do `realized_entries` já carregado (despesa por mês, `tipo = 'despesa'`).
- `monthlyTotals`: mapa `YYYY-MM -> { receita, despesa, resultado, fonte: 'realizado' | 'projecao' }`. Realizado tem prioridade; `processLedger(byMonth[m], classifications)` só é usado quando o mês não tem nem faturamento nem lançamento realizado (mantém a SSOT de projeção).
- `availableMonths` passa a considerar também os meses de `monthly_revenue`.
- `aggregate` e `chartData` somam a partir de `monthlyTotals` em vez de chamar `processLedger` direto.
- Card `caixa` substituído por `margem` = resultado / receita, exibido em %, com comparação em pontos percentuais.
- Sem migração de banco; nenhuma outra tela é afetada.
