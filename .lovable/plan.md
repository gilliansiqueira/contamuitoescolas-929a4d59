# Corrigir a importação do BB: aplicação automática, saldo e movimentações

Não é preciso me mandar os lançamentos. Consigo ver a importação direto na plataforma. O extrato entrou completo: 118 lançamentos, de 01/09 a 24/09, saldo em conta de R$ 1.200,80, igual ao do banco.

## O que deu errado (confirmado)
1. **Nenhum lançamento foi marcado como aplicação automática.** Eu liguei a aplicação automática da conta pelo sistema, mas a sua tela ainda estava com o cadastro antigo, sem essa opção. Por isso a importação não procurou o "BB RENDE FÁCIL".
2. **O saldo não bateu por causa disso.** Os R$ 27.448,47 que foram para a aplicação saíram da conta e não somaram no aplicado. Deu R$ 123.279,53 no lugar de R$ 150.728,00.
3. **A aba Movimentações abre no mês escolhido lá em cima.** Se o mês não for setembro, a tabela aparece vazia, mesmo com os lançamentos gravados.

## O que vou fazer
1. **Arrumar os lançamentos já importados:** marcar os 16 "BB RENDE FÁCIL" como aplicação ou resgate automático. Valor, data e conciliação não mudam, e a troca fica registrada no histórico. Não é preciso importar de novo.
2. **Importação:** antes de ler o arquivo, a tela busca o cadastro da conta atualizado. Assim a aplicação automática é sempre reconhecida, mesmo que alguém tenha mudado o cadastro em outra tela.
3. **Movimentações:** se o mês escolhido não tiver lançamentos, a tabela abre no mês do último extrato importado. O aviso "Nenhum lançamento no filtro" passa a dizer qual é o período e oferece um botão "Ver último extrato".
4. **Conferir:** depois disso, o resumo do BB deve mostrar R$ 1.200,80 em conta, R$ 149.527,20 aplicados, R$ 150.728,00 no total e "confere" nos dois saldos. Vou checar esses números direto nos dados.

## Detalhes técnicos
- Dados: `update bank_transactions set movement_kind = case tipo when 'saida' then 'auto_aplicacao' else 'auto_resgate' end` para a conta BB, onde a descrição normalizada contém "bb rende facil". O gatilho aceita essa alteração e grava o histórico.
- `BankAccountsImports.onFile`: ler `bank_accounts` pelo id em vez de usar a lista em cache.
- `BankTransactionsTable`: sincronizar `from`/`to` quando mudar `defaultFrom`/`defaultTo`; em `FluxoBancario`, se não houver lançamentos no mês, usar o mês do último lançamento como padrão.
