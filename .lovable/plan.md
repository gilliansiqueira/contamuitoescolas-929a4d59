# Fluxo Bancário: editar descrição/observação + categoria "Operação"

## O que muda para você
1. **Editar descrição**: cada linha ganha um lápis. Você escreve a descrição que quiser; a descrição original do banco fica guardada e aparece em cinza embaixo ("Original do banco: ..."), com botão "Voltar ao original".
2. **Editar observação**: a observação (hoje só na conciliação) pode ser editada direto na linha, a qualquer momento.
3. **Categoria da movimentação** (coluna nova, com filtro e ação em lote):
   - **Entrada / Saída** (padrão, conforme o banco)
   - **Operação** — ex.: distribuição de lucros, antecipação, aporte, empréstimo. Não conta em Entradas/Saídas realizadas, mas continua no saldo (mesma regra das Operações do Dashboard e Fluxo Diário).
   - **Transferência entre contas** e **Aplicação/Resgate automático** continuam como já estão.
4. **Resumo**: novo cartão "Operações" (entradas e saídas de operação separadas), ao lado de Entradas e Saídas realizadas. O saldo não muda, só a forma de mostrar.
5. Toda alteração (descrição, observação, categoria) fica no histórico da linha: quem, quando, valor antigo e novo. Só administradores podem alterar.

## O que continua protegido
Valor, data, sentido, conta e a descrição original do banco nunca mudam. Nada é excluído ou duplicado.

## Detalhes técnicos
- Migration: em `bank_transactions` adicionar `descricao_editada text` (nulo = usa original); ampliar `movement_kind` para aceitar `'operacao'`. Trigger `guard_bank_tx_immutable` segue bloqueando `descricao`; permite `descricao_editada`, `recon_note`, `movement_kind` e grava cada mudança em `bank_reconciliation_history` (note com campo/antes/depois).
- `bankCashflowEngine.ts`: `MovementKind` += `'operacao'`; `accountBalances`/resumo separam `operacoesIn/Out` (fora de entradas/saídas, dentro do saldo). Testes novos em `bankCashflow.test.ts`.
- `useBankPilot.ts`: `useUpdateDescription`, `useUpdateNote`; `useSetMovementKind` aceita `operacao` e lote.
- `BankTransactionsTable.tsx`: edição inline, seletor de categoria, filtro; `FluxoBancario.tsx`: cartão Operações.
- Fase 2 (quando os extratos alimentarem Dashboard/Fluxo Diário), `operacao` mapeia direto para Operações da SSOT (`entraNoResultado=false`, `impactaCaixa=true`).
