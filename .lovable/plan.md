# Texto da Projeção olhando para o futuro + limpeza em Portão

## 1. Portão
Apagar a "Lucratividade com receita integral" repetida (fica uma só, com o valor de outubro).

## 2. Texto da Projeção (aba "Projeção" do Controle)
Hoje o texto repete o fechamento do mês passado. Passa a falar do que vem pela frente, em três partes:

1. **Caixa do mês atual (ex.: novembro):** saldo de hoje, menor saldo previsto e em que dia, saldo previsto no fim do mês e se há risco de faltar dinheiro (com valor e data). Mesmos números do Fluxo Diário.
2. **Próximos meses:** receitas, despesas e resultado previstos para os 2 meses seguintes, apontando se algum deles aperta o caixa.
3. **Matrículas e renovações:** quantas matrículas e renovações precisam ser feitas por mês, tiradas da Simulação da escola (cada linha cadastrada, ex.: "Matrículas", "Renovação", "Kids - Matrículas"), do mês atual até o fim do próximo semestre, com o total. Se a escola não tiver Simulação, o texto deixa o lembrete [completar cenário de matrículas e renovações].

O fechamento do mês passado sai do texto da Projeção (ele já está no texto do Relatório), no máximo uma frase curta.

## Detalhes técnicos
- `buildProjectionFacts` (`src/lib/reportNarrativeFacts.ts`): saldo inicial passa a vir do mesmo saldo bancário do Fluxo Diário; fatos de min/fim do mês, 2 meses seguintes via `calculateTotals`; novo parâmetro `simulation` (produtos + quantidades por mês) lido de `simulation_products`/`simulation_monthly_quantities` em `ReportChecklist.tsx`.
- Prompt `projecao` da Edge Function `draft-monthly-analysis` reescrito para tom de futuro e as três partes acima.
- Teste em `reportNarrativeFacts.test.ts` para os fatos de simulação e risco de caixa.
- Nenhum cálculo financeiro novo: só leitura da SSOT e da Simulação.
