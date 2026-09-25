# Dourados: acertar o Sicredi com o extrato de 25/09

## O que o extrato mostra (comparado com o sistema)
- **Lançamentos:** todos os 57 até 25/09 já estão no sistema, inclusive a conta Claro de R$ 290,41.
- **Faltam 2 lançamentos de 25/09**, que entraram depois do último arquivo importado:
  - PIX para CENTER EMBALAGENS: **-R$ 51,19**
  - DEP CHEQUE 24H: **+R$ 2.166,00**. Esse depósito está **bloqueado** (o próprio banco mostra "Saldo bloqueado R$ 2.166,00") e por isso não conta no saldo, igual à regra que já usamos para cheques bloqueados.
- **Conta corrente:** o banco mostra **-R$ 340,60**, e o sistema mostra -R$ 289,41. A diferença é exatamente o PIX de R$ 51,19.
- **Aplicação:** o banco mostra **R$ 907,79**, e o sistema calcula R$ 907,37. A diferença é **R$ 0,42 de rendimento**, que não aparece como lançamento no extrato.

## O que vou fazer
1. **Importar o PIX de -R$ 51,19** de 25/09 (CENTER EMBALAGENS), com origem neste extrato. Ele entra como Pendente para classificação.
2. **Registrar o cheque de R$ 2.166,00 como bloqueado:** ele aparece na conferência, mas fora do saldo até ser liberado.
3. **Gravar os saldos do banco em 25/09:** em conta -R$ 340,60 e aplicação R$ 907,79 (total R$ 567,19). Assim o Sicredi passa a "confere", e os R$ 0,42 de rendimento aparecem em "A confirmar no próximo extrato", sem travar o Painel.
4. **Garantir que o PDF do Sicredi seja lido sozinho na próxima vez**, com os lançamentos, o cheque bloqueado, o saldo atual e o "Saldo de investimentos com resgate automático". Vou testar com este arquivo.

## Como fica o total de Dourados
```text
Bancos antes (depois do cartão do BB)   R$ 207.119,00
PIX Center Embalagens                   -R$     51,19
Rendimento aplicação Sicredi            +R$      0,42
Bancos depois                           R$ 207.068,23
Fechamento de vocês                     R$ 207.106,72
Diferença                               -R$     38,49
```
O fechamento de vocês deve ter sido feito **antes do PIX de R$ 51,19**. Sem ele, a diferença seria de **+R$ 12,70**: são os R$ 12,28 que já tínhamos, mais os R$ 0,42 de rendimento. Então o Sicredi explica só o rendimento, e os **R$ 12,28** continuam sem explicação nos extratos que temos. Vou comparar conta por conta com o fechamento para achar onde estão. Se tiver a planilha do fechamento, eu acho a linha exata.

## O que não muda
Histórico antes de 01/09/2026, os lançamentos já importados e as classificações feitas.

## Detalhes técnicos
- Conta Sicredi `d7a5b97b-15d1-4e36-8fca-16a5d621d0de`: importar o extrato pelo fluxo normal (novo registro em `bank_statement_imports`, com dedup), com `saldo_final_informado = -340.60` e `saldo_aplicado_informado = 567.19`.
- Parser: ler o layout do Sicredi ("Data Descrição Documento Valor Saldo", valor com sinal), "Saldo Atual", "Saldo de investimentos com resgate automático" (somado ao total) e DEP CHEQUE 24H casado com "Saldo bloqueado" como bloqueado. Teste vitest com fixture deste PDF.
- Registro em `audit_log`.
