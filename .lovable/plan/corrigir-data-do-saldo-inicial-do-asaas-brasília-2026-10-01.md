# Corrigir data do saldo inicial do Asaas — Brasília

## O que muda
- Conta Asaas de Brasília: a data do saldo inicial passa de 01/09/2026 para 31/08/2026 (fim do dia). O valor de R$ 53.398,57 continua igual.
- Nenhum lançamento é alterado ou excluído.
- Resultado esperado: o saldo do Asaas fecha nos R$ 63.802,44 do extrato (hoje aparece R$ 481,25 a menos).

## O que não muda
- Caixa de Brasília: segue pendente até recebermos o extrato de setembro em PDF.
- Contas do Banco do Brasil: sem alteração.

## Detalhes técnicos
- Atualização de dados (sem migration): `bank_accounts.saldo_inicial_data = '2026-08-31'` para o id `4cf28ffa-d8c8-46d5-b4cb-cd82b8516ccc`.
- Registro em `audit_log` com valor anterior e novo.
- Rodar `sync_bank_cashflow_school` da escola para atualizar o fluxo.
- Conferir por consulta que saldo inicial + lançamentos até o último extrato = R$ 63.802,44.
