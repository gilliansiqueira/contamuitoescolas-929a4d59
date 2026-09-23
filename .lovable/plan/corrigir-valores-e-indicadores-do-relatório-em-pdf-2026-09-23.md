# Corrigir valores e indicadores do relatório em PDF

Três problemas confirmados na leitura do código que monta o relatório.

## 1. Receitas mostrando os anos errados (só até fevereiro)

A página "Evolução de receitas" pega **os dois últimos anos que têm qualquer lançamento**, sem olhar o período selecionado. Como existem lançamentos projetados em 2027 (janeiro e fevereiro), o relatório de agosto de 2026 comparou 2026 com 2027 — e a linha de 2027 termina em fevereiro porque é só até onde existe projeção.

Correção: a comparação passa a ser sempre **o ano do período selecionado contra o ano anterior** (2026 contra 2025). Anos futuros nunca entram. Se o ano anterior não tiver dados, o relatório mostra apenas o ano atual, com aviso de que não há histórico para comparar.

## 2. Indicadores desalinhados e com cor errada

Hoje o texto do card ("Ótimo", "Bom", etc.) vem da faixa configurada, mas a **cor** é escolhida pela variação em relação ao mês anterior. Por isso a evasão aparece como "Ótimo" em vermelho: o valor está dentro da faixa ótima, mas subiu em relação a julho.

O card ficará igual ao do relatório online:

- valor e selo de status na cor da faixa configurada (a mesma cor que aparece na plataforma);
- linha de variação contra o mês anterior separada, em verde ou vermelho conforme melhora ou piora;
- comparação com o ano anterior: variação absoluta e percentual, com a frase "Comparado ao acumulado do ano passado (mesmo período)" e a média Jan→mês do ano atual contra o ano anterior;
- gráfico anual maior, com o ano atual e o ano anterior no mesmo gráfico e legenda;
- espaçamento revisto para o selo não encostar no texto e nada ficar cortado.

## 3. Falta a evolução de despesas

Existe uma página de evolução de receitas, mas nenhuma de despesas. Será adicionada logo depois, no mesmo formato (ano atual contra ano anterior, totais e média mensal no topo), seguida de uma página de evolução do resultado nos mesmos moldes — a partir dos mesmos números oficiais já usados no restante do relatório.

## Ordem das páginas depois da mudança

1. Capa e resumo
2. Leitura gerencial
3. Evolução de receitas (ano atual x ano anterior)
4. Evolução de despesas (ano atual x ano anterior)
5. Despesas por categoria e uma página por categoria-mãe
6. Indicadores de gestão
7. Comercial, matrículas e contatos

## Detalhes técnicos

- `src/components/dashboard/pdf/mesCompletoPdf.ts`: `annualComparisonPage` recebe os anos de referência (`currentYear` / `previousYear`) em vez de usar `.slice(-2)`; chamada nova para `data.annualExpenses` e para uma série de resultado; bloco de KPI reescrito (cor vinda da faixa, variação mensal e bloco YoY separados, gráfico maior, legenda alinhada).
- `src/components/Dashboard.tsx` (`buildMesCompletoData`): no mapeamento de `kpis`, incluir `color` das faixas (já vem em `kpi_thresholds`), a cor/rótulo da faixa vigente e o agregado YoY calculado como média Jan→mês de referência contra o mesmo período do ano anterior — mesma regra do `KpiCard`; adicionar a série anual de resultado ao lado de `annualRevenue`/`annualExpenses`.
- Nada de cálculo financeiro novo: receitas, despesas, resultado e saldos continuam vindo de `periodMovement`/`buildMonthMovement`. Sem alteração de banco.

## Validação

Gerar o relatório de Dourados em agosto de 2026 e conferir página a página: anos 2025/2026 nas evoluções, despesas presentes, indicadores com as mesmas cores e comparações da tela online.
