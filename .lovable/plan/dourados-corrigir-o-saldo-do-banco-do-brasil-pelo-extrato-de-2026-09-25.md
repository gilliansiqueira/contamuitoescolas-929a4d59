# Dourados: corrigir o saldo do Banco do Brasil pelo extrato de 25/09

## O que o extrato mostra
| Item do extrato BB (25/09) | Valor |
|---|---|
| Conta corrente (saldo do dia) | -190,53 |
| BB Rende Fácil (saldo de fundos) | 151.354,02 |
| **Total real hoje** | **151.163,49** |
| Lançamento futuro: PGT CARTAO (25/09) | -2.159,03 |
| "Saldo" do resumo do banco (já descontando o cartão) | 148.992,18 |

- O valor **148.992,18** digitado na importação é o "Saldo" do resumo do banco, que **já desconta o pagamento do cartão de R$ 2.159,03**. Esse pagamento ainda não aparece nos lançamentos. Por isso o fechamento ficou menor.
- O sistema calcula R$ 151.130,00 para o Banco do Brasil. A diferença para o extrato é de só **R$ 33,49**, que é o rendimento do Rende Fácil no mês.
- **Conclusão:** o Painel (R$ 209.244,54) está praticamente certo. O saldo real de hoje é **R$ 209.278,03**, e fica em cerca de **R$ 207.119,00** depois do débito do cartão. O fechamento de R$ 207.106,72 já tinha descontado o cartão, mas sem o rendimento, e tem ainda uma diferença de R$ 12,28 que vou localizar.

## O que vou fazer
1. **Corrigir o saldo informado na última importação do BB** de 148.992,18 para **151.163,49** (conta + Rende Fácil). A alteração fica registrada no histórico, e nenhum lançamento é mudado.
2. **Registrar o PGT CARTAO de R$ 2.159,03 como previsto** em 25/09, igual aos outros lançamentos futuros. Assim ele aparece no Fluxo Diário e será substituído pelo lançamento real quando o próximo extrato chegar.
3. **Mostrar o rendimento de R$ 33,49** como diferença visível em "A confirmar no próximo extrato", sem travar o Painel.
4. **Leitura automática do PDF do BB:** passar a ler sozinho o "Saldo de fundos de investimento" e os "Lançamentos futuros". Assim não será mais preciso digitar o saldo da aplicação, e o erro de hoje não se repete.
5. **Localizar a diferença de R$ 12,28** entre o fechamento e o total dos bancos, provavelmente no Sicredi ou no Bradesco (extrato só até 18/09), e mostrar as linhas responsáveis.

## Detalhes técnicos
- Atualizar `bank_statement_imports.saldo_aplicado_informado` do import `574d466e…` e registrar em `audit_log`. Não mexer no período anterior a 01/09/2026.
- Inserir o futuro via fluxo de importação existente (`is_forecast`), usando dedup_hash.
- Parser BB PDF em `src/lib/bankStatements/parsers.ts`: extrair `Saldo de fundos de investimento` + saldo do dia para preencher automaticamente o total. Adicionar teste com este PDF como fixture.
