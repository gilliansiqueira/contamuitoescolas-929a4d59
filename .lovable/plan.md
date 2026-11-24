# Indaiatuba – ignorar as 10 transferências sem par

## O que encontrei
As 10 são de **setembro/2026**: saídas do Asaas e da Stone para a Pfaffenzeller (conta Itaú da própria empresa). O Itaú só tem extrato a partir de 01/10, por isso a outra ponta não existe. Outubro e novembro estão todos com par.

| Data | Conta | Valor |
|---|---|---|
| 02/09 | Stone | 2.000,00 |
| 04/09 | Stone | 1.354,47 |
| 04/09 | Asaas | 3.991,42 (2x, ambas estornadas no mesmo dia) |
| 04/09 | Asaas | 4.397,96 |
| 15/09 | Stone | 5.835,69 |
| 16/09 | Asaas | 4.246,85 |
| 21/09 | Asaas | 2.283,58 |
| 21/09 | Stone | 2.080,48 |
| 30/09 | Stone | 1.842,48 |

## O que vou fazer
- Marcar **somente essas 10 linhas de Indaiatuba** como "par dispensado". Elas continuam no Caixa como transferência (sem entrar em receita/despesa) e deixam de aparecer em "Transferências sem par" e na conferência.
- Nenhuma outra escola e nenhuma outra transferência muda: novas transferências sem par em Indaiatuba continuam sendo cobradas normalmente.
- Valores, saldos e conciliação não são alterados.

## Detalhes técnicos
- Migration: coluna `bank_transactions.transfer_pair_waived boolean default false`.
- SQL pontual: `true` apenas nos 10 ids listados (school Indaiatuba).
- `BankTransactionsTable.tsx` (`transferPending` e filtro `transf`) e `CashflowConference.tsx` (`semPar`) passam a ignorar linhas com `transfer_pair_waived`.
- Regra registrada no AGENTS.md; teste da contagem.
