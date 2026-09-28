# Dourados – Sicredi: aviso de R$ 51,19 no OFX

## O que está acontecendo (confirmado no banco)
- O Pix de **R$ 51,19 para CENTER EMBALAGENS (25/09)** já está gravado no Sicredi da Dourados. Ele entrou pelo PDF anterior, que não traz o número do banco.
- O OFX traz o mesmo Pix, agora com o número do banco. O sistema não reconhece que é o mesmo lançamento e tenta gravar de novo.
- Com a cópia, o saldo calculado cai para R$ 1.956,64. O banco informa R$ 2.007,83. A diferença de **R$ 51,19 é essa duplicidade. Não é aplicação.**
- **Não clique em "Tratar R$ 51,19 como aplicação"**: isso esconderia a duplicidade e deixaria o saldo errado.
- Os demais lançamentos estão corretos: 3 resgates automáticos (R$ 340,60), depósito de cheque (R$ 2.166,00) e Pix para ACACIA (R$ 158,17, de 28/09). A CLARO de R$ 290,41 já existia e foi ignorada corretamente.

## O que vou fazer
1. **Reconhecer o mesmo lançamento vindo de PDF e de OFX.** Se a conta já tiver um lançamento sem número do banco com a mesma data, o mesmo valor e o mesmo sentido, o lançamento do OFX aparece como "já existe" e não é gravado. O lançamento antigo passa a guardar o número do banco, para as próximas importações também o reconhecerem.
2. **Não sugerir "aplicação" nesse caso.** Quando a diferença for igual a um lançamento que seria duplicado, a conferência mostra "possível lançamento repetido" com a linha exata, em vez do botão de aplicação.
3. **Depósito de cheque de R$ 2.166,00:** continua a regra atual para cheque bloqueado. Ele fica fora do saldo enquanto estiver bloqueado e não é contado duas vezes quando for liberado.
4. **Teste automático** com este OFX sobre o PDF já importado: 5 novos, 2 já existentes e saldo final igual a R$ 2.007,83, sem diferença.

## O que não muda
- Nenhum lançamento existente é apagado. Nada muda em outras empresas, no Dashboard, no Fluxo Diário nem no histórico.

## Depois de aprovado
- Você reenvia o mesmo OFX. A conferência deve mostrar 6 lançamentos novos (a ACACIA incluída), 2 que já existem e nenhuma diferença.

## Detalhes técnicos
- Na prévia de importação (`BankAccountsImports` / parsers), a busca de duplicidade entre fontes compara `account_id + data + valor + tipo` com linhas em que `bank_ref` é nulo, uma correspondência por vez.
- Ao confirmar, as linhas encontradas recebem o `bank_ref` do OFX com um UPDATE limitado à coluna `bank_ref`. Isso não exige migration.
- A sugestão de aplicação fica suprimida quando o valor da diferença é igual à soma dos lançamentos que seriam duplicados.
