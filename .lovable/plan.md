# Manaus Centro: corrigir o cadastro da conta Asaas

## Causa (conferida)
O extrato está certo. O problema é o cadastro da conta Asaas do Manaus Centro na plataforma: no campo **Conta** foi digitado o CNPJ (36.210.951/0001-32) em vez do número da conta. O sistema compara o número da conta do arquivo (**3326357-5**) com o cadastro, vê que são diferentes e bloqueia por achar que o extrato é de outra conta.

Confirmado nos dois arquivos que você mandou: SANTORO ENSINO DE IDIOMAS LTDA, CNPJ 36.210.951/0001-32, agência 0001, conta 3326357-5, de 01/11 a 23/11.

## Correção
1. Ajustar o cadastro da conta "ASSAS" do Manaus Centro:
   - Conta: **3326357-5** (no lugar do CNPJ)
   - CNPJ do titular: **36.210.951/0001-32**, no campo próprio
   - Nome: corrigir para **Asaas**
2. Nenhum lançamento nem saldo muda. É só o cadastro.
3. Conferir com o seu OFX que a verificação do arquivo passa a reconhecer a conta. Depois disso a equipe pode subir o extrato normalmente.
4. Procurar outras contas cadastradas com CNPJ no campo Conta e te mandar a lista, sem alterar nada.

## Detalhe técnico
Atualizar `bank_accounts` id `5d5566f7-576f-464f-8b0d-0b2ec68de62e` (`conta`, `holder_document`, `nome`). Validar rodando a comparação de identidade (`checkStatementIdentity`) com o cabeçalho do OFX (BANKID 461, ACCTID 33263575).
