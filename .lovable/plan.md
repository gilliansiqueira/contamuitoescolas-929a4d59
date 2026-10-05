# Brasília: corrigir os saldos do Asaas e da Caixa

## O que já foi confirmado nos dados
- **Asaas:** o último extrato (02/10) informa R$ 65.507,52, o mesmo valor que o sistema mostra. O aviso vermelho ("diferença de R$ 481,25") vem do saldo **calculado lançamento por lançamento**, que fica R$ 481,25 longe do saldo do banco. Algum lançamento está sobrando, faltando ou repetido entre os 5 extratos sobrepostos (25/09, 28/09, 29/09, 01/10 e 02/10).
- **Caixa:** o extrato de 01–02/10 informa R$ 8.052,67, que está correto. Depois dele foi enviado outro extrato de setembro (02/10 às 18:08) com "saldo 0", e três extratos de setembro têm saldos que não batem entre si (0, 0 e −3.526,69). Nenhum extrato da Caixa traz o valor aplicado, então o sistema hoje calcula os R$ 12.658,16 aplicados por conta própria, a partir dos resgates automáticos.

## O que será feito
1. **Asaas:** comparar o arquivo enviado (01/09 a 02/10) com os lançamentos gravados e mostrar exatamente quais linhas causam os R$ 481,25 (repetidas, faltando ou com outro valor). Depois corrigir: tirar a repetida ou incluir a que falta. A causa será confirmada antes de qualquer alteração.
2. **Caixa, saldo em conta:** o saldo de referência passa a vir sempre do extrato que cobre a **data mais recente**, e não do último arquivo enviado. Assim, um extrato antigo enviado depois (com saldo 0) não substitui mais o de 02/10. Essa regra vale para todas as empresas.
3. **Caixa, aplicado:** permitir informar à mão o saldo aplicado da conta numa data (ex.: R$ 15.659,50 em 02/10), porque o arquivo da Caixa não traz esse valor. Esse valor informado passa a valer no lugar do cálculo pelos resgates. Só administradores poderão usar.
4. Conferir na tela de Brasília: Caixa deve mostrar R$ 8.052,67 em conta + R$ 15.659,50 aplicado, e o aviso do Asaas deve sumir.

## Detalhes técnicos
- Âncora em `useBankPilot.ts`: ordenar por `periodo_fim` desc, com `created_at` só para desempatar. Manter a regra atual do "extrato baixado no mesmo dia".
- Aplicado manual: usar `bank_statement_imports.saldo_aplicado_informado` (já existe) por meio de uma ação "Informar saldo aplicado" em Contas e Extratos. Ele tem prioridade sobre o aplicado inferido.
- Asaas: fazer o diff por FITID/data/valor entre o OFX e `bank_transactions`. Corrigir os dados com run_sql somente depois de mostrar as linhas.
- Nada muda na classificação nem nos motores SSOT.
