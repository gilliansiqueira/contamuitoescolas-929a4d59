# Fluxo Bancário: dividir lançamento + categoria "Ignorar"

## Como fica o exemplo
Saiu R$ 1.000,00 no banco: R$ 800,00 são desta empresa e R$ 200,00 são de reembolso/outra empresa.

```text
Linha do banco: Saída R$ 1.000,00   (não muda, saldo segue o banco)
  Parte 1: R$ 800,00  Saída     -> conta em Saídas realizadas
  Parte 2: R$ 200,00  Ignorar   -> não conta em nada, só no saldo
```

Na planilha, hoje vocês lançam 800 de saída, mais 200 de saída e 200 de entrada marcados como Ignorar. Aqui não precisa do par saída + entrada. A linha do banco continua com os R$ 1.000,00 reais, então o saldo bate sozinho. Só a parte de R$ 200,00 fica fora de Entradas, Saídas e Operações.

## O que muda
1. **Categoria "Ignorar"**: nova opção na coluna Categoria, junto com Entrada/Saída e Operação. Um lançamento ignorado conta só no saldo, sem aparecer em nenhum total. Pode ser usada na linha inteira ou em uma parte dela.
2. **Botão "Dividir valor"** no menu da linha:
   - Você cria 2 ou mais partes, cada uma com valor, categoria (Entrada/Saída, Operação ou Ignorar), descrição e observação.
   - A soma das partes precisa dar exatamente o valor do banco. O botão Salvar só libera quando a diferença for R$ 0,00.
   - A linha dividida mostra um selo "Dividido em N" e abre para mostrar as partes. Também dá para "Desfazer divisão".
3. **Resumo**: ganha um cartão "Ignorados" com o total do mês, para conferência. Entradas, Saídas e Operações passam a respeitar as partes.
4. **Histórico**: registra quem dividiu ou desfez, quando e quais partes foram criadas. Só administradores podem fazer essas mudanças.

## O que continua protegido
O valor, a data e a descrição original do banco nunca mudam. Dividir não cria lançamentos novos no extrato e não mexe no saldo.

## Detalhes técnicos
- Migration:
  - `movement_kind` passa a aceitar `'ignorar'`.
  - Nova tabela `bank_transaction_splits` (id, school_id, transaction_id, valor > 0, categoria `normal|operacao|ignorar`, descricao, note, sort_order, created_by, created_at), com GRANT e RLS só para administradores.
  - Um trigger confere que a soma das partes é igual a `bank_transactions.valor`. A validação roda na função `set_bank_tx_splits(tx_id, jsonb)`, que substitui as partes de forma atômica e grava o histórico em `bank_reconciliation_history`.
- `bankCashflowEngine.ts`: `summarize` usa as partes quando elas existem. Senão, usa `movement_kind` da linha. `ignorar` fica fora de entradas, saídas e operações e soma em `ignorados`. `accountBalances` e `runningBalances` não mudam, porque sempre usam o valor do banco.
- `useBankPilot.ts`: `useBankSplits` e `useSetSplits` (via rpc).
- `BankTransactionsTable.tsx`: opção Ignorar, diálogo "Dividir valor" com a diferença em tempo real, linhas das partes expansíveis, filtro "Ignorados".
- `FluxoBancario.tsx`: novo cartão Ignorados.
- Testes: divisão 800/200 com Ignorar (saídas = 800, saldo = −1.000) e soma diferente sendo rejeitada.
- Fase 2: `ignorar` corresponde a "Ignorar" da SSOT (não entra em nenhum cálculo gerencial).
