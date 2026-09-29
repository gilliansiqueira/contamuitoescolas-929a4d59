# São Braz — diferença de R$ 28.057,54 no saldo consolidado

## O que já conferi
Os lançamentos gravados de cada conta chegam aos saldos do banco:

| Conta | Banco (28/09) | Sistema (lançamentos) |
|---|---|---|
| Stone | R$ 1.145,95 | R$ 1.145,95 (confere) |
| Sicredi TS | R$ 212.417,85 | R$ 213.206,65 (R$ 788,80 a mais, vindos do extrato de 29/09) |
| Sicredi PRAC | R$ 119,47 | R$ 119,47 (confere) |
| Bradesco | R$ 3.439,15 | R$ 3.439,15 (só o saldo inicial, **nenhum extrato enviado**) |

- O extrato Sicredi enviado bate com o sistema até 28/09. O Pix de R$ 352,00 de 10/09 que aparece duas vezes está duas vezes no banco também (é real).
- Ou seja, a falta não está nos lançamentos. Os R$ 189.064,88 saem de outro cálculo da tela: pode ser o saldo previsto para o fechamento, o corte de data ou alguma conta que ficou fora.
- Ainda não sei a causa exata. Por isso o primeiro passo é abrir a tela.

## Passos
1. Abrir São Braz na prévia (Fluxo Bancário, Conferência e Fluxo Diário) e achar em qual quadro aparecem os R$ 189.064,88.
2. Refazer a conta desse quadro conta por conta e dia por dia. Assim localizo as linhas exatas que somam os R$ 28.057,54: previsões, saídas futuras, transferências próprias sem par, conta fora do cálculo ou data errada.
3. Corrigir a causa com o menor ajuste possível, dentro das regras oficiais de cálculo. Se for dado errado, corrijo o dado e registro no histórico. Se for regra da tela, corrijo a regra e crio um teste.
4. Conferir na tela que o consolidado de 28/09 fecha em R$ 217.122,42, com o Sicredi TS em R$ 212.417,85 nessa data.
5. Explicar a causa com as linhas responsáveis e publicar, se houver mudança no sistema.

## Ponto para a equipe
O Bradesco não tem nenhum extrato em setembro. O sistema usa só o saldo inicial de R$ 3.439,15. Se houve movimento no Bradesco no mês, é preciso enviar o extrato dele.

## Detalhes técnicos
- Contas ativas: saldo_inicial em 31/08. Não há registros em bank_account_balances nem previsões (is_forecast) para essa empresa.
- Os saldos informados vêm de bank_statement_imports. O Sicredi TS tem dois extratos de 28/09 (211.090,85 e 212.417,85) e um de 29/09 (213.206,65). Vou confirmar qual deles cada tela usa como âncora.
