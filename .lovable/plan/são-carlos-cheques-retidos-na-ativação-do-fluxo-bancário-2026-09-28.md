# São Carlos — cheques retidos na ativação do Fluxo Bancário

## Situação
- Sistema: saldo realizado em 28/09 = R$ 67.606,82. Banco (saldo disponível) = R$ 52.176,78.
- Diferença de R$ 15.430,04 = cheques depositados que o banco ainda segura. A conferência já mostra esse valor como "a confirmar no próximo extrato", mas a Prévia da ativação ignora isso e trava o botão.

## O que muda
1. **Nova linha na Prévia:** "Cheques retidos pelo banco (liberam nos próximos dias)" com R$ 15.430,04, logo abaixo do saldo.
2. **Saldo do banco considerado = disponível + retidos** (52.176,78 + 15.430,04 = 67.606,82). O item passa a "Saldo final bate com o banco (inclui R$ 15.430,04 em cheques retidos)" e o botão Aprovar e ativar libera.
3. **Dashboard e Fluxo Diário:** saldo de R$ 67.606,82 (o dinheiro é da empresa, só está retido), com aviso "inclui R$ 15.430,04 em cheques retidos" para não confundir.
4. **Sem contar em dobro:** quando o próximo extrato trouxer a liberação dos cheques, ela não entra como nova receita — só zera o valor retido. Se a liberação vier com valor diferente, a diferença aparece com as linhas exatas.
5. Só vale quando a diferença bate exatamente com o valor retido informado no extrato. Qualquer outra diferença continua bloqueando.

## O que não muda
Nenhum lançamento, histórico ou mês fechado é alterado; receitas e despesas continuam iguais; outras empresas não são afetadas.

## Detalhes técnicos
- Investigar primeiro de onde vem o `ajusteConferido` (CashflowConference) em São Carlos e confirmar que é o saldo bloqueado/cheques do extrato.
- `ActivationPreview.tsx`: receber o valor retido (mesma fonte da conferência), `fimOk = r2(fimReal - (bankFim + retido)) === 0`, nova linha e texto.
- Aviso no Dashboard/Fluxo Diário a partir da mesma fonte (sem recalcular saldo fora dos motores oficiais).
- Liberação posterior: reaproveitar a regra de depósito bloqueado/liberação já usada nos parsers (Sicoob/Sicredi/Inter).
- Testar na prévia com São Carlos: botão libera, saldo 67.606,82, aviso visível.
