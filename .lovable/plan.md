# Joinville Centro – conciliação depois da correção

## O que encontrei
- **Setembro e outubro estão 100% conciliados** (520 e 541 lançamentos). Nenhum ficou pendente.
- Os lançamentos apagados na correção eram cópias repetidas. A conciliação delas se perdeu junto, mas o lançamento verdadeiro de cada uma continua e está conciliado.
- **Novembro tem 21 pendentes.** 13 deles entraram hoje e nunca foram conciliados (PIX de 11/11, cobrança, TED e Getnet de 12/11). Esses ficam com a equipe.
- **Os outros 8 estavam conciliados e voltaram a ficar pendentes em 11/11 às 14:53.** Quem fez isso foi a **Helo**, na tela, e não a correção (que foi em 12/11). São recebimentos de cobrança (CR COB) de 05, 06, 10 e 11/11, somando R$ 60.329,75:
  - 05/11: R$ 5.967,14 e R$ 419,00
  - 06/11: R$ 2.014,43 e R$ 841,66
  - 10/11: R$ 18.118,17 e R$ 1.428,15
  - 11/11: R$ 27.163,73 e R$ 4.377,47
  - Isabelly conciliou 7 deles e a Helo, 1. Depois a Helo desfez os 8 de uma vez.

## O que fazer
1. Conciliar de novo esses 8 lançamentos de cobrança, mantendo o item do modelo que já têm. Fica registrado no histórico como restauração da conciliação de 10 e 11/11.
2. Não mexer nos 13 lançamentos novos nem em setembro e outubro.

Atenção: se a Helo desfez de propósito (por exemplo, porque a cobrança não batia com o sistema da escola), o melhor é perguntar a ela antes de aprovar.

## Detalhes técnicos
- Atualizar `bank_transactions.recon_status='conciliado'` dos 8 ids (`recon_by_email`/`recon_note` = restauração) pelo run_sql, inserir as linhas em `bank_reconciliation_history` e registrar em `audit_log`.
