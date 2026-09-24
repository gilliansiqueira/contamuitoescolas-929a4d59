# Por que o saldo não bate na Prévia (Santa Mônica)

## O que está acontecendo
- **Saldo inicial:** a prévia usa o fechamento de agosto da planilha antiga (R$ 25.175,55). O banco em 31/08 tinha R$ 28.175,97, contando conta e aplicado. A diferença é de **R$ 3.000,42** e vem de agosto, não de setembro.
- **Movimento de setembro:** a diferença é de só **R$ 0,38** (-12.004,07 × -12.004,45). Provavelmente é um arredondamento ou uma parte de divisão, mas a causa ainda não foi confirmada.
- **Saldo final:** carrega as duas diferenças somadas (R$ 3.000,04).
- A aba Resumo bate porque já começa pelo saldo do banco em 31/08.
- Há também dois erros de texto na tabela: a linha "dessas, Movimentações ignoradas" está com o nome quebrado. O valor dela (-10.697) parece somado de novo às operações, mas isso ainda precisa ser conferido.

## O que vou fazer
1. **Saldo inicial vem do banco:** quando a empresa estiver no Fluxo de Caixa, setembro começa com o saldo do banco em 31/08 (conta + aplicado). Assim, Dashboard, Fluxo Diário e Resumo usam o mesmo número. Agosto e os meses anteriores continuam travados e não mudam. A diferença de R$ 3.000,42 aparece só como informação: "Fechamento de agosto da planilha diferente do banco".
2. **Encontrar os R$ 0,38:** conferir cada lançamento do banco com a linha gerada correspondente e mostrar exatamente qual deles causa a diferença, depois corrigir a causa.
3. **Corrigir a tabela:** mostrar "Movimentações ignoradas (banco)" como detalhe da linha de operações, sem somar duas vezes, e acertar o nome.
4. **Liberar o botão:** "Aprovar e ativar" fica liberado quando o saldo inicial, o movimento e o saldo final baterem com o banco.

## Detalhes técnicos
- `bankCashflowOverlay.ts` / `withCashflowSource`: quando o status for `ativo`, o saldo base da competência inicial passa a ser a soma de `saldo_conta + saldo_aplicado` em `bank_account_balances`, na data anterior à `start_month`. Nada é gravado em `financial_entries`.
- `ActivationPreview.tsx`: usar o mesmo saldo base; corrigir o nome da linha; mostrar as ignoradas como parte das operações, sem somá-las de novo.
- Diagnóstico dos R$ 0,38: consulta comparando `bank_transactions`/`bank_transaction_splits` com `bank_cashflow_entries` de Santa Mônica, de 01/09 a 24/09.
