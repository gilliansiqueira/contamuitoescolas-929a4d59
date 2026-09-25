# Dourados: saldos aplicados, saldo final e movimento do caixa

## O que já foi conferido no banco de dados

**Sicredi (aplicado)**
- Saldo aplicado em 31/08: R$ 2.088,94
- \+ aplicações automáticas de setembro: R$ 7.509,84
- − resgates automáticos de setembro: R$ 8.691,41
- = R$ 907,37, que é o valor mostrado hoje. O correto seria R$ 618,38, uma diferença de R$ 288,99.
- O saldo em conta aparece como **−R$ 289,41**. O valor que sobra no aplicado é praticamente o mesmo que falta na conta. O total do Sicredi (conta + aplicado = R$ 617,96) já está quase certo, com diferença de R$ 0,42. Parece faltar um resgate automático de cerca de R$ 289, usado para cobrir a conta negativa, que não entrou no extrato importado.

**Banco do Brasil (aplicado)**
- R$ 122.078,73 em 31/08 + R$ 35.211,28 de aplicações − R$ 5.969,48 de resgates = R$ 151.320,53, que é o valor mostrado hoje. O correto seria R$ 148.992,18, uma diferença de R$ 2.328,35.
- A conta também está negativa (−R$ 190,53). Descontando isso, sobra uma diferença de **R$ 2.137,82** no total do BB.

**Saldo final**
- R$ 209.244,54 − R$ 207.107,14 = R$ 2.137,40.
- Isso é a diferença do BB (R$ 2.137,82) menos a do Sicredi (R$ 0,42). Ou seja, quase toda a diferença do saldo final está no Banco do Brasil.

**Movimento realizado no caixa (tela de conferência)**
- Na conferência, "Entradas no banco" e "Saídas no banco" contam até **18/09**, o último dia em que todas as contas têm extrato (o Bradesco está até 18/09).
- Já Receitas, Despesas, Operações e Saldo realizado aparecem com o saldo bancário até **24/09 ou 25/09**.
- Como uma parte da conta usa até 18/09 e a outra usa até 24/09, o movimento não fecha e aparece a diferença de R$ 43.853,52. O saldo realizado mostrado como sendo de 18/09 (R$ 209.244,54) é, na verdade, o saldo de 25/09.
- Essa explicação ainda não está confirmada linha a linha. Ela é a primeira coisa a verificar.

## Etapas

1. **Confirmar a diferença de movimento**: recalcular a conferência de Dourados usando a mesma data final para todas as linhas e mostrar se a diferença de R$ 43.853,52 zera. Se sobrar alguma diferença, listar exatamente quais lançamentos a causam (data, conta, valor, categoria).
2. **Corrigir a conferência** para que todas as linhas usem a mesma data final: saldo inicial, entradas, saídas, receitas, despesas, operações, ignorados e saldo final. O cabeçalho vai dizer qual data está sendo usada. Os cartões do Resumo e o período De/Até passam a seguir a mesma regra.
3. **Aplicado do Sicredi e do BB**: comparar, dia a dia, o saldo aplicado calculado com o extrato. Mostrar em que dia começa a diferença e que lançamento de aplicação, resgate ou rendimento está faltando ou foi classificado de forma errada. As causas possíveis são:
   - um resgate automático que não veio no arquivo;
   - rendimento ou IR da aplicação sem lançamento;
   - saldo aplicado de 31/08 cadastrado errado.
   Vou precisar que vocês confirmem o saldo aplicado de 31/08 de cada banco pelo extrato.
4. **Ferramenta de ajuste auditado**: se o extrato do banco não trouxer a linha que falta, permitir que a equipe informe o "saldo aplicado conferido em uma data". A partir dele, o sistema cria uma linha de ajuste identificada, visível e reversível, com registro de quem fez e quando. Nada é apagado nem alterado nos lançamentos importados.
5. Conferir Dourados na tela depois das correções: aplicado do Sicredi R$ 618,38, aplicado do BB R$ 148.992,18 e saldo final R$ 207.107,14.

## Garantias
- Nenhum lançamento importado é editado nem apagado. Nada anterior a 01/09/2026 é tocado.
- Dashboard e Fluxo Diário continuam na planilha, porque Dourados segue "Em conferência".
- Os cálculos oficiais do sistema não são duplicados.

## Detalhes técnicos
- Tabelas envolvidas: bank_accounts (auto_invest_saldo_inicial), bank_account_balances e bank_transactions (movement_kind auto_aplicacao/auto_resgate).
- A data de corte é o "realizado até", que hoje é o menor último dia com extrato entre as contas ativas. Ela precisa ser a mesma na prévia, em ActivationPreview.tsx / bankCashflowOverlay.ts, e nas colunas Dashboard e Banco.
- O ajuste da etapa 4 usaria bank_account_balances, com origem 'conferencia', como âncora do saldo aplicado. Isso só é feito se for confirmado que falta uma linha no extrato.
