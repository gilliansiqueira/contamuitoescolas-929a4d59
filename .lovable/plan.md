# São Mateus: saldos iniciais de 31/08 trocados entre Stone e Sicredi

## O que encontrei
O total está certo, mas os saldos iniciais de 31/08 foram cadastrados nas contas trocadas:
- **Sicredi** está com R$ 4.670,81, mas o PDF do banco mostra "SALDO ANTERIOR **R$ 3.378,93**".
- **Stone** está com R$ 3.378,93. O valor certo é **R$ 4.670,81**.

A diferença entre os dois valores é exatamente **R$ 1.291,88**, o mesmo valor dos avisos:
- Stone calculada: −R$ 1.291,88. O extrato mostra R$ 0,00 em 24/09.
- Sicredi calculado: R$ 1.291,88 a mais que o extrato em 28/09.

Nenhum lançamento está faltando ou duplicado.

## O que vou fazer
1. Trocar os saldos iniciais de 31/08: Stone R$ 4.670,81 e Sicredi R$ 3.378,93. A correção fica registrada no histórico.
2. Recalcular o fluxo de São Mateus.
3. Conferir na tela que as duas contas mostram "confere":
   - Stone: R$ 0,00 em 24/09.
   - Sicredi: R$ 1.894,40 em 01/10, conforme o OFX enviado hoje.
4. Os avisos vermelhos devem sumir. Nenhum lançamento será alterado.

## Detalhes técnicos
- Fazer um UPDATE em `bank_accounts.saldo_inicial`:
  - f4ee8d06 (Stone): 4670.81
  - fc18b905 (Sicredi): 3378.93
- Inserir um registro em `audit_log` com a ação `bank_saldo_inicial_corrigido`.
- Executar `sync_bank_cashflow_school`.
