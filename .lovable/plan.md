# Lucratividade total sem aplicações e resgates

## Problema
A "Lucratividade total" soma todas as Operações (entradas menos saídas). Em SJP, uma aplicação financeira (dinheiro guardado para render) entrou como saída e derrubou o indicador, mas esse dinheiro não saiu da empresa.

## Regra nova
- Lucratividade operacional: não muda (já não considera nenhuma Operação).
- Lucratividade total: continua somando Operações como pró-labore e aportes, mas **ignora aplicações e resgates de investimento** (aplicação, aplicações, resgate, resgate de investimento, aplicação e resgate automático).
- Vale para todas as empresas, no Dashboard e no valor gravado automaticamente nos indicadores.
- Meses fechados não são reescritos; meses de outubro/2026 em diante ainda abertos são recalculados sozinhos. Para SJP, confiro o mês afetado e mostro o valor antes e depois.

## Passos
1. Conferir no banco de SJP qual lançamento de aplicação entrou no mês e quanto ele pesa no indicador.
2. Na regra central de classificação (ledgerEngine), marcar os tipos de aplicação/resgate como "investimento", e o resumo mensal passar a informar à parte quanto das Operações é investimento.
3. Na regra de lucratividade, descontar esse valor do cálculo da total.
4. Teste: mês com pró-labore + aplicação → a total considera só o pró-labore; resgate também fica fora.
5. Conferir SJP depois da mudança; se o mês estiver fechado, perguntar antes de corrigir o valor salvo.

## Detalhes técnicos
- `src/lib/ledgerEngine.ts`: flag `isInvestimento` nas entradas de aplicação/resgate da tabela de regras.
- `buildMonthMovement`: novos campos `investimentosIn/Out` (sem alterar `operacoesIn/Out` nem o Caixa).
- `src/lib/profitability.ts`: `lucro_total = resultado + (opIn − invIn) − (opOut − invOut)`; campos opcionais para não quebrar quem chama.
- Teste em `src/test/` junto aos de lucratividade.
