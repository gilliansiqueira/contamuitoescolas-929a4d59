# Cuiabá Goiabeiras — queda de saldo de 30/11 para 01/12

## O que já foi confirmado nos dados
- 01/12 tem 20 contas a pagar previstas somando **R$ 25.480,20** (arquivo de contas a pagar enviado em 25/11), contra R$ 7.598,20 de cartão previstos. Só esse dia já tira cerca de **R$ 17,9 mil** do saldo.
- Os maiores valores são Banco Sicredi (Reforma) R$ 8.451,53, Influx Várzea Grande R$ 7.610,97, Escola Gasparzinho R$ 1.600 (sem categoria), mais VR/VT dos funcionários (vários de R$ 700 e R$ 300).
- Não há linhas repetidas de outros arquivos em 01/12.
- Isso explica a maior parte da queda, mas não toda: R$ 12 mil − R$ 17,9 mil dá cerca de −R$ 5,9 mil, não −R$ 19 mil. Faltam cerca de **R$ 13 mil** sem explicação.

## Próximos passos
1. Abrir o Fluxo Diário da escola e anotar o saldo final de 30/11 e cada linha de 01/12.
2. Localizar a origem dos ~R$ 13 mil restantes. Suspeitas a verificar:
   - contas a pagar previstas de novembro já vencidas que não foram pagas e "pulam" para dezembro (há 71 previstas até 25/11, R$ 191 mil);
   - saldo inicial de dezembro calculado de forma diferente do saldo final mostrado em novembro;
   - 3 cheques (R$ 1.552,22) que aparecem iguais em novembro e em dezembro (possível repetição).
3. Mostrar as linhas exatas que causam a diferença e corrigir só o que estiver errado (dado duplicado/vencido ou regra de virada de mês), sem mexer nos cálculos oficiais.
4. Avisar sobre a Escola Gasparzinho sem categoria.

## Detalhes técnicos
- Fonte: `financial_entries` (projetado, origem `contas_pagar` upload ceefaecd…, `cartao`, `cheque`) e `bank_transactions` com `is_forecast`.
- Comparar o saldo de virada do motor (projectionEngine/ledgerEngine) com a soma das linhas; qualquer correção de regra vai para o motor, com teste.
