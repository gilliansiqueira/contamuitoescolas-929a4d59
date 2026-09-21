# Comparativo: fazer 2025 aparecer

## Por que não puxou

Confirmei no banco do Dourados: os dados de 2025 existem, mas não onde a aba Comparativo procurou.

- Histórico mensal (o que o Dashboard usa): 12 meses de 2025, receita e despesa completas (jan a dez).
- Relatório Realizado: 2.407 lançamentos de despesa em 2025 e faturamento dos 12 meses.
- Projeção / fluxo (única base que o Comparativo lê hoje): **começa em abril de 2026**.

Por isso o Dashboard mostra 2025 normalmente e o Comparativo aparece zerado: ele foi montado só em cima da projeção. Os meses de 2025 até aparecem na lista de seleção, mas somam zero.

## O que vou mudar

Fazer o Comparativo usar a mesma regra de origem do Dashboard, mês a mês:

1. Fechamento do mês (quando existe);
2. Histórico mensal;
3. Upload / projeção do mês.

Com isso, 2025 vem do histórico e 2026 continua vindo da projeção, exatamente como no Dashboard — sem inventar regra nova e sem duplicar valores.

Ajustes na tela:

- Os cartões de Receita, Despesa e Resultado passam a somar por essa regra.
- O quarto cartão sai de "Saldo de caixa" (que só existe na projeção, de abr/2026 em diante) e vira **Margem do resultado (%)**, comparável entre os dois períodos.
- Os três gráficos mês a mês passam a usar a mesma base, então as linhas de 2025 aparecem.
- Cada período mostra, em letra pequena, de onde veio o dado (histórico / fechamento / projeção).
- Aviso curto quando algum mês escolhido estiver sem nenhum dado, nomeando os meses.
- A tabela de variação por categoria continua igual — ela já lê o Realizado e já funciona para 2025.

## Detalhes técnicos

`src/components/comparativo/ComparativoPeriodos.tsx`:

- Novas consultas: `historical_monthly` e `period_closure_snapshots` (mesmas chaves de cache já usadas no Dashboard), além do `financial_entries` e `realized_entries` atuais.
- `monthSources`: mapa `YYYY-MM -> 'snapshot' | 'historico' | 'projecao' | 'vazio'`, replicando a prioridade do Dashboard (`src/components/Dashboard.tsx`, `monthlyChart`).
- `monthlyTotals`: para `historico`, classificar cada `tipo_valor` por `resolveTipoMeta(tipo_valor, classifications, modelItems)` e somar só o que tem `entraNoResultado`; para `snapshot`, usar `receitas`/`despesas`; para `projecao`, manter `processLedger` como hoje. Mantém a SSOT — nenhuma regra de classificação nova.
- `availableMonths` passa a incluir os meses de histórico e de snapshot (hoje só olha projeção e realizado).
- `aggregate` e `chartData` somam a partir de `monthlyTotals`.
- Card `caixa` substituído por `margem` = resultado / receita, com variação em pontos percentuais.
- Sem migração de banco; nenhuma outra tela é afetada.
