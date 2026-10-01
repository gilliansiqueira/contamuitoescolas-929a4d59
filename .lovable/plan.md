# Prévia da ativação: saldo do banco em 30/09 errado quando o extrato traz débitos futuros de 01/10

## O que foi confirmado (Sinop)
- Os dados de setembro fecham. Saldo inicial de R$ 54.073,85, mais o movimento de R$ 4.518,14, dá R$ 58.591,99 em 30/09. A tela mostra esse mesmo valor na coluna Dashboard.
- A coluna Banco mostra R$ 77.768,47 em 30/09. A tela calcula esse valor partindo do saldo de 01/10 e voltando um dia.
  - O saldo de 01/10, R$ 60.128,06, conta só o que já aconteceu de fato.
  - Para voltar a 30/09, a tela desconta R$ 17.640,41, que inclui os 4 EMPRÉSTIMOS de 01/10 que são débitos futuros (previsão) do extrato do BB. Esses débitos não estão no saldo de 01/10.
  - Resultado: a previsão é descontada sem ter sido somada antes, e sobram R$ 19.176,48 de diferença falsa. É o "puxar valores do dia 01 no dia 30".
- Afeta toda empresa cujo extrato termina no dia 01 e traz pagamentos futuros (BB, Bradesco etc.), não só Sinop.

## Correção (vale para todas as empresas)
- O saldo do banco no fim do mês passa a ser calculado direto, conta por conta, no último dia do mês (ex.: 30/09). Não depende mais de partir de 01/10 e voltar.
- A linha "Movimento do mês seguinte já no extrato" passa a mostrar só o que já aconteceu de fato. Os débitos futuros aparecem separados, como "previsão, não entra na comparação".
- Em Sinop, as duas colunas devem mostrar R$ 58.591,99 e o botão deve liberar.
- Nenhum dado é alterado. Muda só a conta feita na tela de prévia.

## Detalhes técnicos
- `CashflowConference.tsx`: novo prop `bankFimMonth = Σ accountBalances(a, txs, fimDoMês(cfg.start_month)).total`, usando as contas ativas.
- `ActivationPreview.tsx`: usa `bankFimMonth` recebido no lugar de `bankFim - afterNet`. Mostra `afterNet = bankFim - bankFimMonth` (só realizado). Previsões identificadas por `txs.is_forecast` saem da lista "mês seguinte".
- Teste com o caso Sinop: o fim do mês bate em R$ 58.591,99 com as previsões de 01/10 presentes.
