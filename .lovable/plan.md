# Cristo Rei – Inter: diferença falsa de R$ 409,60

## Diagnóstico (confirmado)
- O PDF do Inter mostra saldo de **R$ 6.098,45** em 30/09, já com o cheque "Yasser" de R$ 409,60 compensado, e nenhum saldo bloqueado.
- Os lançamentos no sistema estão certos: o cheque de 30/09 aparece uma vez só. O Pix de R$ 409,60 de 28/09 (Leonardo Leite) é outro lançamento, também real.
- O erro está no saldo que o sistema leu do OFX "inter 02.10.ofx": ele gravou **R$ 6.508,05** (R$ 6.098,45 + R$ 409,60).
- Causa: a regra do Inter para "cheques em compensação" soma ao saldo os cheques recebidos no último dia com movimento. Esse arquivo vai até 02/10, mas o último movimento é de 30/09. Por isso o cheque já compensado de 30/09 foi tratado como retido e somado de novo.

## Correção
1. **Leitor do Inter**: só somar cheques como "em compensação" quando forem do **último dia do período do arquivo** (data final do extrato), e não do último dia com movimento. Se o extrato for até 02/10, um cheque de 30/09 já está no saldo.
2. **Teste automático**: arquivo até 02/10 com cheque em 30/09 → saldo informado igual ao do banco, sem somar o cheque. O teste atual de São Carlos continua passando (cheque no último dia do arquivo continua somado).
3. **Dado de Cristo Rei**: corrigir o saldo informado da importação "inter 02.10.ofx" de R$ 6.508,05 para R$ 6.098,45, registrar no histórico de alterações e ressincronizar o fluxo. O aviso vermelho some e o consolidado fica R$ 7.321,01 (Inter R$ 6.098,45 + Stone R$ 1.222,56).
4. **Outras empresas com Inter**: procurar importações em que o saldo lido tenha recebido cheques que não eram do último dia do arquivo e listar as afetadas antes de corrigir.

## Técnico
- `src/lib/bankStatements/parsers.ts` (`parseOFX`, regra Inter / BANKID 077): usar DTEND do BANKTRANLIST como referência; se não houver DTEND, manter o comportamento atual.
- `src/test/bankInterCheques.test.ts`: novo caso com DTEND posterior.
- Atualização de `bank_statement_imports.saldo_final_informado` (id 0af277bf…) + `audit_log` + `sync_bank_cashflow_school`.
