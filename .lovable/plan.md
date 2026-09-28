# Coluna "Atualizado até" → tempo desde a última alteração

## Contexto
Hoje a coluna "Atualizado até" da Central de Clientes mostra a data mais distante com lançamento gravado (ex.: 30/09/2026), o que confunde porque parece data futura. A usuária quer ver **há quanto tempo foi feita a última alteração** naquela empresa (ex.: "há 2 h", "há 3 dias").

## O que muda

### 1. Banco de dados (migration aditiva, somente leitura)
- Atualizar a função `get_management_portfolio` (CREATE OR REPLACE, sem apagar nada) para devolver também `last_activity_at` (data/hora da última atividade real da empresa).
- A última atividade é a maior data/hora entre:
  - importações de extrato (`bank_statement_imports.imported_at`)
  - lançamentos bancários (`bank_transactions.created_at/updated_at`)
  - lançamentos financeiros e realizado (`financial_entries`, `realized_entries` — created_at/updated_at)
- Manter o campo `data_updated_through` como está (usado em outras regras, ex.: selo "Atualizadas hoje").

### 2. Tela (ManagementCenter.tsx)
- A coluna passa a se chamar **"Última alteração"** e mostra tempo relativo em português:
  - "agora mesmo", "há 15 min", "há 2 h", "ontem", "há 3 dias"
- Ao passar o mouse, mostrar a data/hora exata (ex.: 28/09/2026 13:12).
- Se nunca houve atividade, mostrar "—".

## O que NÃO muda
- Nenhum dado financeiro, relatório, dashboard ou fluxo de caixa.
- Nenhuma tabela é alterada — só a função de leitura da Central de Clientes.
- Demais cards e colunas continuam iguais.

## Verificação
- Testar na prévia com a Central de Clientes aberta: conferir que cada empresa mostra o tempo desde a última alteração e que o valor bate com a última importação/lançamento conhecido.
