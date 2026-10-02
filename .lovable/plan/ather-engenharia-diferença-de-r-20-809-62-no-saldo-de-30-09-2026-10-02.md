# Ather Engenharia — diferença de R$ 20.809,62 no saldo de 30/09

## O que encontrei
O movimento do mês e o saldo inicial batem. A diferença está só no **saldo de referência do banco** (o saldo impresso nos extratos), e se divide exatamente em duas contas:

| Conta | Sistema em 30/09 | Pelo extrato | Diferença |
|---|---|---|---|
| Inter | R$ 135.252,09 | R$ 116.579,16 | R$ 18.672,93 |
| Itaú | R$ 2.559,02 | R$ 422,33 | R$ 2.136,69 |
| **Total** | R$ 137.811,11 | R$ 117.001,49 | **R$ 20.809,62** |

**Inter (R$ 18.672,93):** o primeiro extrato (01/09 a 28/09) foi baixado no dia 28 antes de os lançamentos daquele dia aparecerem. O saldo dele (R$ 171.327,07) é do fim do dia 27, mas ficou gravado como se fosse do fim do dia 28. Os 6 lançamentos de 28/09 (CREA, resgate do fundo, 3 Pix enviados) vieram no extrato seguinte e somam exatamente +R$ 18.672,93. Ou seja: o dinheiro está certo, a data do saldo de referência é que está errada.

**Itaú (R$ 2.136,69):** o extrato de 29/09 (período 26 a 28/09) trouxe 26 lançamentos novos, mas o saldo impresso nele (R$ 9.979,26) é R$ 2.136,69 menor que o resultado no sistema. Ainda não sei se é um lançamento repetido de outro extrato ou um saldo de referência no horário errado, como no Inter — preciso comparar linha a linha.

## O que vou fazer
1. **Itaú:** comparar os 26 lançamentos de 28/09 com os extratos anteriores e localizar exatamente as linhas que dão R$ 2.136,69 (repetidas, ou saldo antigo). Mostro a lista antes de mexer em qualquer coisa.
2. **Corrigir os dados da Ather:** usar os saldos dos extratos mais recentes (que já incluem o dia 28) como referência. Se houver linha repetida no Itaú, excluir com motivo registrado no Histórico.
3. **Evitar que se repita:** quando o extrato termina no próprio dia em que foi baixado (dia ainda aberto), o saldo impresso passa a valer para o dia anterior ao último lançamento confirmado, ou passa a ser tratado como "a confirmar", sem gerar diferença falsa. Vale para todos os bancos.
4. Conferir de novo a prévia da Ather: o "Saldo final difere do banco" deve sumir.

## Detalhes técnicos
- Inter: `bank_statement_imports` 02e61168… (`periodo_fim` 2026-09-28, `saldo_final_informado` 171327.07 = 344000 + 1.096.719,83 − 1.269.392,76, sem as 6 linhas de 28/09 importadas depois por "Extrato-26-09-2026-a-01-10-2026-OFX.ofx").
- Itaú: import 48053c2e… (26–28/09, 26 inseridas, 1 duplicada, saldo 9.979,26); ledger em 28/09 = 116,08 + 11.999,87 = 12.115,95.
- Regra nova no ponto onde a âncora de saldo é derivada do import: se `periodo_fim` = data do envio (`created_at` em America/Sao_Paulo), não usar como âncora de fim de dia, ou rebaixar para o fim do dia anterior quando nenhuma linha do dia estiver no arquivo.
- Nada muda nos cálculos oficiais (SSOT); só a âncora de saldo e, se confirmado, linhas duplicadas.
