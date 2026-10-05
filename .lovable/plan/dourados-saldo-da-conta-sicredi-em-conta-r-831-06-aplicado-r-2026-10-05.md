# Dourados: saldo da conta Sicredi (em conta -R$ 831,06, aplicado R$ 4.778,05)

## O que o extrato de 05/10 mostra
- Saldo dos lançamentos: -R$ 395,46. O OFX e o PDF concordam nisso.
- "Saldo Atual" no PDF: -R$ 831,06. A diferença de R$ 435,60 é o **DEP CHEQUE 24H de 02/10**, que o Sicredi ainda mantém como **saldo bloqueado**.
- Aplicação com resgate automático: R$ 4.778,05. **Só o PDF traz esse valor. O OFX não traz.**

## Por que não bate hoje (confirmado nos dados)
1. **OFX (enviado às 14:21):** o OFX não traz o valor aplicado e a conta tem aplicação automática. Por isso o sistema não usou esse extrato como saldo oficial e continuou com o PDF de 02/10 (R$ 1,00 em conta + R$ 4.801,64 aplicados). É daí que vêm os R$ 0,00 / R$ 4.405,18 da tela.
2. **PDF de 05/10:** o leitor já tira da conta o cheque bloqueado. Mas o cheque já tinha entrado pelo OFX. A comparação fica então entre -R$ 395,46 do sistema e -R$ 831,06 do PDF, e por isso não fecha. Esse ponto ainda não foi confirmado. Vou rodar o PDF no leitor para confirmar.

## O que será feito
1. **Cheque bloqueado no Sicredi (vale para todas as empresas):** o cheque continua nos lançamentos, porque o Sicredi não cria outra linha quando libera o valor. O valor bloqueado passa a ser guardado como "retido", do mesmo jeito que no Inter.
   - A conferência usa -R$ 395,46 e fecha.
   - A tela mostra **Em conta -R$ 831,06**, com a nota "+ R$ 435,60 de cheque bloqueado (liberação prevista)".
   - O saldo total considera o cheque só quando ele for liberado.
2. **Aplicado:** gravar R$ 4.778,05 a partir do PDF de 05/10. Quando uma empresa com aplicação automática mandar só o OFX, o aviso passa a dizer "Envie também o PDF do Sicredi para atualizar o aplicado", em vez de ignorar o arquivo sem avisar.
3. **Dourados agora:** reprocessar o PDF de 05/10 sem duplicar os lançamentos e conferir o resultado: Sicredi com -R$ 831,06 em conta, R$ 435,60 bloqueado e R$ 4.778,05 aplicado.
4. **Testes:** criar testes com o OFX e o PDF enviados.

## Detalhes técnicos
- `parsers.ts` (bloco Sicredi, cerca da linha 586): não fazer mais o `splice` do cheque. Passar a devolver `saldoRetidoInformado = sicBloq` e `saldoFinalInformado = Saldo Atual + bloqueado`.
- `useBankPilot.ts` já soma o `retido` na âncora. Falta ajustar a exibição em conta e bloqueado no Resumo (`saldo_conta - retido` + nota).
- Na importação, gravar `saldo_retido_informado` do resultado do leitor.
- Nenhuma mudança na classificação nem nos motores SSOT.
