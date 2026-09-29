# Dourados: aviso de R$ 51,19 no OFX do Sicredi

## O que está acontecendo
Não é aplicação. Conferi o arquivo linha a linha com o que já está gravado no Sicredi:
- Os lançamentos de setembro já gravados batem 100% com o arquivo.
- Faltam só 3 lançamentos de verdade: Pix de R$ 215,00 (28/09), aplicação de R$ 2.221,83 (28/09) e Pix de R$ 170,00 (29/09).
- A tela diz "4 novos" porque trata o **Pix de R$ 51,19 da CENTER EMBALAGENS (25/09)** como novo, embora ele já esteja gravado. Ele entrou primeiro pelo PDF, com outra descrição. Na correção de ontem, ele recebeu o número do banco, mas a conferência ainda compara a descrição e não esse número.
- Com isso, a conferência desconta os R$ 51,19 duas vezes. O saldo calculado fica em R$ 119,81, quando o certo é **R$ 171,00**, igual ao banco.

**Importante:** não clique em "Tratar como aplicação" nem em "Confirmar importação" até a correção. Senão o Pix seria gravado duas vezes.

## O que vou fazer
1. Na conferência, um lançamento do arquivo passa a contar como "já existe" quando a conta já tem uma linha com o mesmo número do banco, mesmo que a descrição seja diferente.
2. Criar um teste automático com esse caso: PDF gravado primeiro, OFX depois.
3. Reenviar pela prévia este mesmo arquivo de Dourados e conferir que aparece assim: **3 novos, 64 já existem, saldo calculado R$ 171,00, sem aviso de aplicação**.
4. Publicar no site oficial.

Nenhum lançamento é alterado ou apagado. A SANESUL de R$ 786,06 (05/10) continua como previsão.

## Detalhes técnicos
- `BankAccountsImports.tsx` (analyze): antes do cálculo de `existing`, buscar `bank_ref` da conta dentro do período do arquivo. Toda transação com `bankRef` presente nesse conjunto recebe `existing.add(hashes[i])`. Isso corrige também `movN` e a contagem de novos.
- O insert já ignora hashes existentes, então o Pix não é regravado.
