# Corrigir texto de Sinop com despesas zeradas

## O que aconteceu
O topo do texto pega receitas e despesas de uma lista de lançamentos que, em Sinop, está vazia para outubro (os números do mês vêm de outra fonte, a mesma que o Dashboard usa). Antes isso aparecia como "receitas R$ 0"; com a receita integral, só a receita foi preenchida e as despesas ficaram em R$ 0,00. Peço desculpas pela confusão.

## O que muda
- Os números do mês no texto (receitas, despesas, resultado, receita recebida e lucratividade) passam a vir do **mesmo cálculo do Dashboard**, que já mostra as despesas de outubro de Sinop corretamente.
- Com receita integral: Receitas = integral, Despesas = as do Dashboard, Resultado = integral − despesas, e a receita recebida aparece como observação.
- **Trava de segurança:** se as despesas ou as receitas do mês vierem zeradas, o botão avisa "dados do mês ainda não carregados / mês sem lançamentos" e não gera texto com R$ 0,00.
- O botão de gerar fica desativado enquanto os dados ainda estão carregando.

## Detalhes técnicos
- Primeiro passo: confirmar em Sinop que `buildMonthMovement('2026-10')` traz receitas/despesas diferentes de zero (e que `useProjectedEntries` está sem realizados em outubro).
- `buildReportFacts` recebe `monthTotals?: { receitas; despesas }` (de `buildMonthMovement`) e usa esses totais nas linhas do topo e na lucratividade; as comparações históricas seguem usando a mesma fonte por mês (`buildMonthMovement` para cada mês de comparação).
- `ReportChecklist.tsx`: passa os totais, desativa o botão com `mvLoading` e bloqueia geração quando receitas e despesas do mês = 0.
- Teste: com receita integral R$ 152.788,43 e despesas de exemplo, o topo mostra despesas e resultado corretos; com totais zerados, a geração é bloqueada.
