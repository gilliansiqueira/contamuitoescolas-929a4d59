# Joinville Centro e Norte: conciliar PIX, TED e despesas automaticamente

## 1. Agora (Joinville Centro)
Vou conciliar estes lançamentos pendentes:
- os 9 "PIX RECEBIDO" de 11/11, que somam R$ 1.923,88;
- a TED recebida de 12/11, de R$ 417,50.

Continuam pendentes:
- os 8 recebimentos de cobrança (CR COB) que a Helo desfez em 11/11, porque você vai verificar;
- a cobrança e os 2 recebimentos da Getnet de 12/11.

## 2. Regra fixa, só para Joinville Centro e Joinville Norte
Quando um extrato for importado, já entram conciliados:
- PIX recebidos e enviados;
- TED recebidas e enviadas;
- despesas, ou seja, todas as saídas do banco.

Mesmo nesses casos, o lançamento fica **pendente** quando:
- ainda não tem item do modelo (para nada ficar conciliado sem classificação);
- é uma transferência entre contas;
- é uma aplicação ou um resgate automático.

Cobrança/boleto, cartão (Getnet) e as outras entradas continuam para a equipe conciliar.

A regra vale só para extratos novos. A conciliação automática fica registrada no histórico como "automática (regra Joinville)", e a equipe pode desfazer normalmente. Nenhuma outra empresa muda.

## Detalhes técnicos
- Liga uma nova chave `school_features.auto_recon_pix_ted_despesas`, só para os ids `7f6d0018-...` (Centro) e `eb5943df-...` (Norte).
- Uma migration altera `bank_tx_force_pending`. Com a chave ligada, o lançamento entra como `conciliado`, com `recon_source='auto_regra'` e `recon_by_email='automático'`, quando:
  - tem `model_item_id`;
  - `movement_kind='normal'`;
  - não tem `transfer_pair_id`;
  - a descrição contém PIX ou TED, ou `tipo='saida'`.
  Fora isso, o lançamento continua `pendente`.
- O registro em `bank_reconciliation_history` é feito por gatilho AFTER INSERT.
- É preciso confirmar se o item do modelo já vem preenchido no momento da inserção. Se ele só entra depois, a regra passa a rodar também no momento em que o item é definido.
- O passo 1 é feito pelo run_sql, com registro em `audit_log`.
- Haverá um teste da regra (entrada PIX, entrada boleto, saída sem item, aplicação automática).
