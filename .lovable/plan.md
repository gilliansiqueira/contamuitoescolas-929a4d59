# Indaiatuba – 10 transferências sem par

## O que encontrei
As 10 são todas de **setembro/2026**: saídas do Asaas e da Stone para a Pfaffenzeller (conta Itaú da própria empresa). Novembro e outubro estão todos com par.

Motivo: o Itaú só tem lançamentos a partir de **01/10/2026**. O extrato de setembro do Itaú nunca foi enviado, então a outra ponta (a entrada no Itaú) não existe na plataforma.

| Data | Conta | Valor |
|---|---|---|
| 02/09 | Stone | 2.000,00 |
| 04/09 | Stone | 1.354,47 |
| 04/09 | Asaas | 3.991,42 (2x) |
| 04/09 | Asaas | 4.397,96 |
| 15/09 | Stone | 5.835,69 |
| 16/09 | Asaas | 4.246,85 |
| 21/09 | Asaas | 2.283,58 |
| 21/09 | Stone | 2.080,48 |
| 30/09 | Stone | 1.842,48 |

Caso especial: as duas saídas de R$ 3.991,42 de 04/09 tiveram **estorno** no mesmo dia no Asaas (duas entradas "Estorno de transação via Pix" de R$ 3.991,42). Ou seja, esse dinheiro nunca saiu — não é transferência.

## O que vou fazer
1. **Estornos (2 saídas de 3.991,42):** ligar cada saída ao seu estorno e marcar ambos como estorno/operação que se anula, para não ficar transferência sem par nem afetar resultado.
2. **As outras 8:** como o Itaú começa em outubro, deixar de cobrar par para transferências anteriores ao início do Itaú — o aviso "Transferências sem par" passa a ignorar linhas cuja outra conta ainda não tinha extrato naquela data. Elas continuam no Caixa como operação (sem entrar em receita/despesa).
   - Alternativa: se a equipe tiver o extrato de setembro do Itaú, basta subir que a plataforma pareia sozinha (aí não mexo nas 8).

## Detalhes técnicos
- Estornos: atualizar `bank_transactions` (par entre saída e estorno, `movement_kind` adequado) via SQL pontual.
- Contagem: em `BankTransactionsTable.tsx` (`transferPending`) e `CashflowConference.tsx` (`semPar`), desconsiderar transferências com data anterior à primeira data de lançamento da conta de destino/da conta mais recente da empresa; teste unitário da regra.
