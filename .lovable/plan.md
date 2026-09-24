# Conferência: comparar extrato e planilha só no mesmo período

## Problema
As planilhas de setembro foram feitas até uma data anterior, mas os extratos agora vão até hoje. Por isso a conferência mostra como "diferença" lançamentos que só existem porque o extrato cobre mais dias. Não é erro.

## O que muda (só na aba Conferência Dashboard)
1. **Período comum automático**: para cada escola, a comparação extrato x planilha usa apenas os dias que os dois cobrem, até a última data lançada na planilha. O período aparece no topo, por exemplo: "Comparando de 01/09 a 15/09 (último dia da planilha)".
2. **Lançamentos após a planilha**: o que o extrato tem depois dessa data aparece em um bloco separado e neutro, "Movimentações posteriores à planilha", com quantidade e valor. Não conta como divergência.
3. **Lista "Falta na planilha"**: dentro do período comum, uma lista por escola com os lançamentos do extrato sem correspondente na planilha (data, conta, descrição, valor), e o inverso ("Só na planilha"). Botão para baixar em Excel para a equipe conferir.
4. Totais do topo (entradas, saídas, diferença) recalculados só com o período comum.

## O que não muda
- Nenhum dado é criado, alterado ou apagado.
- Dashboard, Fluxo Diário, Análise de Despesas, PDFs e demais empresas continuam iguais.
- As três escolas seguem "Em conferência".

## Detalhes técnicos
- `CashflowConference.tsx`: calcular `sheetMaxDate` a partir de `useSheetFluxoEntries` por escola; filtrar linhas do extrato (`bank_cashflow_entries`) por `data <= sheetMaxDate` para comparação; separar o restante em grupo "posterior".
- Pareamento reaproveita a lógica atual (data + valor + sentido, tolerância de dias já usada).
- Exportação Excel via biblioteca xlsx já usada no projeto, gerada no navegador.
