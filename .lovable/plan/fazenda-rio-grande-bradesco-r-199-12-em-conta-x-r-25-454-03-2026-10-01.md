# Fazenda Rio Grande – Bradesco: R$ 199,12 em conta x R$ 25.454,03

## O que foi confirmado
- O saldo em conta em 31/08 era R$ 1,00, conforme o PDF do Bradesco. Somando os movimentos de setembro do extrato (+R$ 198,12), o saldo em conta fica exatamente **R$ 199,12**.
- O arquivo do Bradesco informa R$ 25.454,03. Esse valor é o **total com a aplicação**, sem separar o que está em conta do que está aplicado. O sistema gravou tudo como "em conta".
- Em 25/09, o saldo inicial foi trocado de R$ 1,00 para R$ 6.098,57, que também era um total com aplicação.

## O que vou fazer
1. **Separar em conta e aplicado** no extrato de 01/10: R$ 199,12 em conta e R$ 25.254,91 aplicado, total de R$ 25.454,03.
2. **Saldo inicial de 31/08:** R$ 1,00 em conta e R$ 6.097,57 em aplicação, mantendo o total de R$ 6.098,57.
3. **Sem repetição:** nas próximas importações do Bradesco por OFX, quando o saldo do arquivo for maior que o saldo calculado em conta, ele será tratado como total com aplicação, com aviso na conferência e sem gravar como "em conta".
4. **Diferença na aplicação:** a aplicação cresceu cerca de R$ 19.157 sem lançamento no extrato. Vou mostrar em quais lançamentos de aplicação e resgate essa diferença aparece. O resgate de CDB de R$ 2.451,00 excluído hoje como duplicado entra nessa conferência. Nada é apagado nem criado sem a sua confirmação.
5. Registrar no histórico, conferir na tela e publicar.

## Detalhes técnicos
- `bank_statement_imports` (import de 01/10): `saldo_final_informado=199.12`, `saldo_aplicado_informado=25454.03`. `bank_accounts`: `saldo_inicial=1`, `has_auto_invest=true`, `auto_invest_saldo_inicial=6097.57`. Registro em `audit_log` e `sync_bank_cashflow_school`.
- Ajuste no fluxo OFX Bradesco em `BankAccountsImports.tsx`/`parsers.ts` para preencher `saldoComAplicacaoInformado` em vez de `saldoFinalInformado` quando a conta tem aplicação automática.
