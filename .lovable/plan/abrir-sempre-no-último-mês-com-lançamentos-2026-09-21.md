# Abrir sempre no último mês com lançamentos

## Problema

Hoje, quando o cliente entra pela primeira vez (ou em uma escola nova), o filtro de período é montado a partir da data de hoje: os últimos 12 meses do calendário. Se a escola não tem lançamentos nesses meses, as telas abrem vazias ou com erro, e o cliente precisa corrigir o filtro manualmente toda vez.

## O que muda

- Na primeira abertura de cada escola, o filtro vem com **somente o último mês que tem lançamentos** daquela escola.
- Se a escola ainda não tiver nenhum lançamento, o filtro cai no mês atual (comportamento neutro, sem erro).
- A seleção que o cliente fizer continua sendo guardada por escola e **respeitada como está**, mesmo que aponte para meses sem lançamentos.

## Detalhes técnicos

- `src/contexts/GlobalPeriodContext.tsx`: em vez de calcular o valor inicial só pela data atual, o provider passa a consultar os meses disponíveis da escola (`useAvailableMonths`, que já usa a função `get_available_financial_months` no banco).
  - Estado inicial fica "não definido" quando não há valor salvo em localStorage.
  - Quando a lista de meses chega, define o valor uma única vez com o último mês da lista; lista vazia → mês atual.
  - Só grava em localStorage depois que o valor é definido, para não congelar um padrão errado antes dos meses carregarem.
  - Nenhuma correção automática de seleções salvas.
- Nada muda em `MonthSelector`, `SharedMonthContext` ou nos motores de cálculo (`projectionEngine`, `ledgerEngine`, `periodMovement`): eles continuam consumindo o mesmo valor de filtro.

## Validação

- Abrir uma escola sem seleção salva e confirmar que o filtro mostra o último mês com dados.
- Trocar de escola e confirmar que cada uma abre no seu próprio último mês com dados.
- Confirmar que uma seleção salva anterior continua sendo carregada sem alteração.
- Rodar a checagem de tipos do projeto.
