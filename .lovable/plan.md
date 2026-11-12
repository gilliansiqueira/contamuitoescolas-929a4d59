# Joinville Centro: conciliar só os PIX baixados pela escola

## Situação
- Setembro e outubro estão 100% conciliados. A correção não deixou nada pendente nesses meses.
- Os 8 recebimentos de cobrança (CR COB) de 05 a 11/11 foram desfeitos pela Helo em 11/11. **Não vou mexer neles.** Você vai verificar.

## O que fazer
Conciliar os 9 "PIX RECEBIDO" de 11/11, que a equipe da escola baixa direto (total R$ 1.923,88):
- R$ 60,00 · R$ 2,00 · R$ 537,78 · R$ 2,00 · R$ 4,00 · R$ 4,00 · R$ 403,00 · R$ 60,00 · R$ 851,10

Ficam pendentes: cobrança, TED e Getnet de 12/11, além dos 8 de cobrança.

## Detalhes técnicos
- Os 9 lançamentos com `recon_status='pendente'`, descrição "PIX RECEBIDO" e data 2026-11-11 passam para `conciliado`, sem trocar o item do modelo.
- A mudança fica registrada em `bank_reconciliation_history` e em `audit_log`, com uma nota de que foi feita a pedido da Bruna.
