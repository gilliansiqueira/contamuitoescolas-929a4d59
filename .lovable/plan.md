# São Mateus: data do saldo inicial errada nas duas contas

## O que causa os avisos (confirmado)
Os saldos iniciais já estão corretos: Sicredi R$ 3.378,93 e Stone R$ 4.670,81. Os lançamentos também batem com os extratos. O problema agora é a **data** desse saldo.

- Os dois extratos mostram esses valores como o "saldo anterior", ou seja, o saldo do fim do dia **31/08**.
- No cadastro das contas, a data do saldo está como **01/09**.
- O sistema entende que um saldo de 01/09 já inclui o movimento desse dia. Por isso ele **descarta os lançamentos de 01/09**.

Os lançamentos de 01/09 que ficam de fora são exatamente as diferenças da tela:

| Conta | Lançamentos de 01/09 ignorados | Aviso na tela |
|---|---|---|
| Sicredi | 1.304,79 − 70,00 − 348,43 − 190,00 − 1,36 − 2,72 = **R$ 692,28** | R$ 692,28 |
| Stone | 912,46 + 456,23 = **R$ 1.368,69** | R$ 1.368,69 |

Quando a data é corrigida para 31/08, as duas contas fecham exatamente com o banco: Sicredi R$ 1.764,50 e Stone R$ 0,00 em 01/10.

## O que vou fazer
1. **Corrigir a data do saldo inicial** das contas Stone e Sicredi de São Mateus para **31/08/2026**, sem mudar valores nem lançamentos, e registrar a alteração no histórico. Depois, atualizar o Fluxo de Caixa da empresa.
2. **Evitar que isso se repita:** no cadastro da conta, o campo passa a se chamar "Data do saldo (fim do dia)", com esta dica: "Use o 'Saldo anterior' do extrato com a data do dia anterior ao primeiro lançamento". Quando já houver lançamentos importados nessa mesma data, aparece um aviso: "X lançamentos deste dia serão desconsiderados porque já estariam no saldo".
3. **Brasília:** as contas Asaas e Caixa também têm saldo com data de 01/09 e lançamentos nesse dia. Vou conferir com os extratos se é o mesmo caso. Só mudo algo se for confirmado, e aviso antes.
4. **Conferir na tela** que São Mateus mostra "confere" nas duas contas.

## Detalhes técnicos
- `bank_accounts.saldo_inicial_data` de `f4ee8d06…` (Stone) e `fc18b905…` (Sicredi) passa de `2026-09-01` para `2026-08-31`. A alteração é feita pela ferramenta de dados, com registro no `audit_log`, e depois `sync_bank_cashflow_school`.
- `countsForAccount` continua igual: a regra "lançamento na data do saldo já está contido" está certa, o dado é que estava errado.
- `BankAccountsImports.tsx`: novo rótulo, dica e aviso, que conta as transações com `data = saldoData` da conta em edição.
